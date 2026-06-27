// X半自動キット: 毎朝、コピペ用の投稿原稿を生成して GitHub Actions の Job Summary に出す。
// 投稿はしない（X API不使用）。owner は Actions 画面を開いて貼るだけ（<=10分/日）。
//
// 育成モード（新規アカウント @shinkanbiyori のソフトシャドバン回避）:
//   - リンク無しの読書系コンテンツを中心にする
//   - 自サイトURLは「1日1回まで」（コラム告知の1枚だけに付ける）
//
// 使い方（ローカル確認）:
//   node -r dotenv/config scripts/build-x-kit.js dotenv_config_path=.env.local
// CIでは $GITHUB_STEP_SUMMARY に出力し、x_posts に「素材として出した」記録を残す。
//
// 必要env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(記録用) または ANON(読取のみ)

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const READ_KEY = SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SITE = "https://shinkanbiyori.com";
const UTM = "utm_source=x&utm_medium=social&utm_campaign=daily";
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || ""; // 設定があればDiscordにも送る

// 文芸ジャンルのみ（ビジネス001006・コミック001001・ラノベ001017は除外）。
// fetch-books.js の GENRES と対応。"文芸書"の看板に合うものだけをXに出す。
const LITERARY_GENRES = [
  "001004008", // 小説（日本）
  "001004009", // 小説（海外）
  "001004001", // ミステリー
  "001004002", // SF・ホラー
  "001004003", // エッセイ
  "001004004", // ノンフィクション
  "001004016", // ロマンス
  "001019",    // 文庫
];

// ---- 日付ユーティリティ（既存スクリプトと同じJST基準） ----
function jstToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
function addDaysUTC(isoDate, n) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mdJP(isoDate) {
  const [, m, d] = isoDate.split("-");
  return `${Number(m)}/${Number(d)}`;
}

// X は全角を2文字としてカウントするため、重み付きで概算する（上限280）
function xWeight(s) {
  let w = 0;
  for (const ch of s) w += ch.codePointAt(0) <= 0x7f ? 1 : 2;
  return w;
}

function bookCardUrl(b) {
  const q = new URLSearchParams({
    title: b.title || "",
    author: b.author || "",
    publisher: b.publisher || "",
    date: b.published_date || "",
    cover: b.image_url || "",
  });
  return `${SITE}/api/book-card?${q.toString()}`;
}

// 禁止語（quality-check と同じ思想。原稿のlint用・警告のみ）
const BANNED = ["魅力", "必見", "ぜひ", "いかがでしょうか", "話題沸騰", "今すぐ", "間違いなし"];
function lintBanned(text) {
  return BANNED.filter((w) => text.includes(w));
}

// Discord Webhook に投稿キットを送る。各投稿を個別メッセージ（コードブロック）にして
// スマホで長押しコピー→Xに貼りやすくする。
async function postToDiscord(webhook, posts, today, kindLabel) {
  const send = async (content) => {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    if (!res.ok && res.status !== 204) {
      const t = await res.text().catch(() => "");
      throw new Error(`Discord ${res.status} ${t.slice(0, 150)}`);
    }
  };
  await send(
    `🐦 **今日のX投稿キット（${today}）**\n下の枠を長押しコピー → @shinkanbiyori に貼って投稿。リンク付きは③だけ・1日2回まで（朝/夕）。`
  );
  for (const p of posts) {
    const w = xWeight(p.content);
    const label = kindLabel[p.kind] || p.kind;
    let msg = `**${label}**（${w}/280）\n\`\`\`\n${p.content}\n\`\`\``;
    if (p.image_url) msg += `画像候補(任意): <${p.image_url}>`;
    await send(msg);
    await new Promise((r) => setTimeout(r, 600)); // Discordレート制限対策
  }
}

async function main() {
  if (!SUPABASE_URL || !READ_KEY) {
    console.error("env未設定（NEXT_PUBLIC_SUPABASE_URL / キー）");
    process.exit(1);
  }
  const sb = createClient(SUPABASE_URL, READ_KEY);
  const today = jstToday();
  const since14 = addDaysUTC(today, -14);
  const since21 = addDaysUTC(today, -21);

  // 注目著者リスト
  let notable = [];
  try {
    notable = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "data", "notable-authors.json"), "utf8")
    );
  } catch (_) {}

  // 最近 spotlight に出した本（重複出し防止。14日以内のisbn13を除外）
  const recentSpotlightIsbn = new Set();
  try {
    const { data } = await sb
      .from("x_posts")
      .select("isbn13,created_at,kind")
      .eq("kind", "spotlight")
      .gte("created_at", since14 + "T00:00:00Z");
    for (const r of data || []) if (r.isbn13) recentSpotlightIsbn.add(r.isbn13);
  } catch (_) {}

  const posts = []; // {kind, isbn13?, slug?, content, image_url?}
  const usedIsbn = new Set(); // このキット内で既に出した本（①②の重複防止）

  // ---- (1) 今日の新刊ダイジェスト（リンク無し・コンテンツ） ----
  try {
    // 今日の文芸書（正確な冊数はcountで取得し、見出し用に数冊だけ実体を引く）
    const SEL = "title,author,publisher,isbn13,image_url,published_date";
    const NOT_PHOTO = (q) =>
      q.not("title", "ilike", "%写真集%").not("title", "ilike", "%グラビア%");

    let label = `今日 ${mdJP(today)}`;
    let count = 0;
    let pool = [];

    const todayCountQ = NOT_PHOTO(
      sb.from("books").select("*", { count: "exact", head: true })
        .eq("published_date", today).in("genre_id", LITERARY_GENRES)
    );
    count = (await todayCountQ).count || 0;

    if (count > 0) {
      const { data } = await NOT_PHOTO(
        sb.from("books").select(SEL).eq("published_date", today).in("genre_id", LITERARY_GENRES)
      ).limit(60);
      pool = data || [];
    } else {
      // 今日が0冊なら直近7日に切替
      label = "今週";
      const wkStart = addDaysUTC(today, -7);
      count =
        (await NOT_PHOTO(
          sb.from("books").select("*", { count: "exact", head: true })
            .gte("published_date", wkStart).lte("published_date", today)
            .in("genre_id", LITERARY_GENRES)
        )).count || 0;
      const { data } = await NOT_PHOTO(
        sb.from("books").select(SEL)
          .gte("published_date", wkStart).lte("published_date", today)
          .in("genre_id", LITERARY_GENRES)
          .order("published_date", { ascending: false })
      ).limit(100);
      pool = data || [];
    }

    if (pool.length > 0) {
      // 見出しは有名著者の本を優先、無ければ先頭から
      const famous = pool.filter((b) => notable.some((n) => (b.author || "").includes(n)));
      const picks = (famous.length ? famous : pool).slice(0, 2);
      for (const b of picks) if (b.isbn13) usedIsbn.add(b.isbn13);
      const names = picks.map((b) => `『${b.title}』(${(b.author || "").split("/")[0]})`).join("、");
      const content =
        `📚 ${label}発売の文芸書は${count}冊。\n` +
        `注目は${names} など。\n` +
        `#新刊 #読書 #本好きと繋がりたい`;
      posts.push({ kind: "new_books_digest", content, image_url: picks[0] ? bookCardUrl(picks[0]) : null });
    }
  } catch (e) {
    console.error("digest生成スキップ:", e.message);
  }

  // ---- (2) 注目著者スポットライト（リンク無し・事実ベース） ----
  try {
    const { data: recent } = await sb
      .from("books")
      .select("title,author,publisher,isbn13,image_url,published_date")
      .in("genre_id", LITERARY_GENRES)
      .gte("published_date", since21)
      .lte("published_date", today)
      .order("published_date", { ascending: false })
      .limit(200);
    const hit = (recent || []).find((b) => {
      if (!b.isbn13 || recentSpotlightIsbn.has(b.isbn13) || usedIsbn.has(b.isbn13)) return false;
      return notable.some((n) => (b.author || "").includes(n));
    });
    if (hit) {
      const author = (hit.author || "").split("/")[0];
      const content =
        `【注目の新刊】\n` +
        `『${hit.title}』${author}（${hit.publisher}）\n` +
        `${mdJP(hit.published_date)}発売。${author}さんの新作です。\n` +
        `#新刊 #読書 #${author}`;
      posts.push({ kind: "spotlight", isbn13: hit.isbn13, content, image_url: bookCardUrl(hit) });
    }
  } catch (e) {
    console.error("spotlight生成スキップ:", e.message);
  }

  // ---- (3) コラム告知（★この1枚だけ自サイトURLを付ける＝1日1リンク） ----
  try {
    const { data: cols } = await sb
      .from("columns")
      .select("slug,title,published_at,status")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1);
    const c = (cols || [])[0];
    if (c) {
      const url = `${SITE}/column/${c.slug}?${UTM}`;
      const content = `コラムを公開しました。\n「${c.title}」\n${url}\n#読書 #本好きと繋がりたい`;
      posts.push({ kind: "column_promo", slug: c.slug, content });
    }
  } catch (e) {
    console.error("column_promo生成スキップ:", e.message);
  }

  // ---- (4) 今日が誕生日の作家（事実ベース・リンク無し・フォロワー獲得用） ----
  try {
    const birthdays = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "data", "author-birthdays.json"), "utf8")
    );
    const bd = birthdays[today.slice(5)]; // MM-DD
    if (bd) {
      const [, m, d] = today.split("-");
      let c = `📚 今日${Number(m)}月${Number(d)}日は、${bd.name}（${bd.year}年生まれ）の誕生日。`;
      if (bd.note) c += `\n${bd.note}。`;
      c += `\n#今日は何の日 #読書 #本好きと繋がりたい`;
      posts.push({ kind: "birthday", content: c });
    }
    // 該当作家がいない日は④を出さない（無理に思想ポストを作らない）
  } catch (e) {
    console.error("誕生日ポスト生成スキップ:", e.message);
  }

  // ---- 出力（Job Summary or stdout） ----
  const kindLabel = {
    new_books_digest: "① 今日の新刊ダイジェスト（リンク無し）",
    spotlight: "② 注目著者スポットライト（リンク無し）",
    column_promo: "③ コラム告知（★今日の1リンク）",
    birthday: "④ 今日が誕生日の作家（事実）",
  };

  let md = `# 🐦 X投稿キット（${today}）\n\n`;
  md += `各ブロックをそのままコピーして @shinkanbiyori に貼ってください。育成モード中はリンク付きは③の1枚だけにします。朝と夕で2枚に分けて投稿すると安全です。\n\n`;

  for (const p of posts) {
    const w = xWeight(p.content);
    const over = w > 280 ? " ⚠️280超過" : "";
    const banned = lintBanned(p.content);
    md += `## ${kindLabel[p.kind] || p.kind}\n\n`;
    md += "```\n" + p.content + "\n```\n";
    md += `- 文字数(X換算): ${w}/280${over}\n`;
    if (banned.length) md += `- ⚠️ 禁止語: ${banned.join(", ")}（言い換え推奨）\n`;
    if (p.image_url) md += `- 画像候補(任意): ${p.image_url}\n  ※X本文にこのURLを貼っても画像展開はされません。使うならブラウザで開いて保存→手動添付。\n`;
    md += `\n`;
  }

  md += `---\n投稿したら、良い反応のものは X_posts の status を 'posted' にしておくと分析に使えます（任意）。\n`;

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(summaryPath, md);
    console.log("Job Summary に投稿キットを出力しました。");
  } else {
    console.log(md);
  }

  // ---- Discordにも送る（Webhook設定時） ----
  if (DISCORD_WEBHOOK) {
    try {
      await postToDiscord(DISCORD_WEBHOOK, posts, today, kindLabel);
      console.log("Discordに投稿キットを送信しました。");
    } catch (e) {
      console.error("Discord送信スキップ:", e.message);
    }
  }

  // ---- x_posts に「素材として出した」記録（重複出し防止） ----
  if (SERVICE_KEY) {
    const sbW = createClient(SUPABASE_URL, SERVICE_KEY);
    const rows = posts.map((p) => ({
      kind: p.kind,
      isbn13: p.isbn13 || null,
      slug: p.slug || null,
      content: p.content,
      image_url: p.image_url || null,
      status: "queued",
    }));
    const { error } = await sbW.from("x_posts").insert(rows);
    if (error) console.error("x_posts記録スキップ:", error.message);
    else console.log(`x_posts に ${rows.length}件 記録しました。`);
  } else {
    console.log("（SERVICE_ROLE_KEY 無しのため x_posts への記録はスキップ）");
  }
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
