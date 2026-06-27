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
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

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

// Xの見出しに出す「コア文芸」ジャンル（ロマンス=ハーレクイン中心は看板に合わないため除外）
const HIGHLIGHT_GENRES = [
  "001004008", // 小説（日本）
  "001004009", // 小説（海外）
  "001004001", // ミステリー
  "001004002", // SF・ホラー
  "001004003", // エッセイ
  "001004004", // ノンフィクション
];

// 文芸らしくないタイトルを除外（成人向け＋ラノベ/なろう/異世界系＋極端に長い題名）。
// 楽天の「小説」ジャンルにはこれらが大量に混ざるため、Xの見出しから外す。
const NG_RE = /射精|官能|エロ|18禁|成人向け|ヌード|AV編集|撮影会/;
const LN_RE = /異世界|転生|転移|令嬢|公爵|侯爵|伯爵|婚約|聖女|勇者|魔王|魔導|スキル|チート|最強|追放|ハーレム|ヤンデレ|ダンジョン|迷宮|攻略|冒険者|辺境|領地|王太子|王女|騎士団|召喚|やり直し|無職|無双|モブ|な件|ざまぁ|二度目|スローライフ|悪役|ギルド|レベル|奴隷|VRMMO|ステータス|側妃|竜帝|世継ぎ|寵愛|嫁いで/;
function looksLikeJunk(title) {
  const t = title || "";
  return NG_RE.test(t) || LN_RE.test(t) || t.length > 32;
}
// 著者データが壊れている本を弾く（著者が空 / 出版社名が著者欄に入っている等）
function goodMeta(b) {
  const a = (b.author || "").trim();
  if (!a) return false;
  if (a === (b.publisher || "")) return false;
  if (/(社|出版|書房|新聞|編集部|刊行会|文庫|新書)$/.test(a)) return false;
  return true;
}

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
// 日付からの通日番号（毎日+1）。紹介本を日替わりでローテーションするのに使う。
function dayNum(isoDate) {
  return Math.floor(new Date(isoDate + "T00:00:00Z").getTime() / 86400000);
}

// X は全角を2文字としてカウントするため、重み付きで概算する（上限280）
function xWeight(s) {
  let w = 0;
  for (const ch of s) w += ch.codePointAt(0) <= 0x7f ? 1 : 2;
  return w;
}
// X上限(280)を超えたら文(。)単位で末尾を削って収める
function trimToWeight(text, limit) {
  if (xWeight(text) <= limit) return text;
  const parts = text.split("。").filter(Boolean);
  let out = "";
  for (const p of parts) {
    const next = out + p + "。";
    if (xWeight(next) > limit) break;
    out = next;
  }
  return out || text.slice(0, 120);
}
// 楽天の書影URL。手動添付用に少し大きめ(_ex)にする
function coverImg(url) {
  if (!url) return null;
  return /_ex=\d+x\d+/.test(url) ? url.replace(/_ex=\d+x\d+/, "_ex=300x300") : url;
}

// 禁止語（quality-check と同じ思想。原稿のlint用・警告のみ）
const BANNED = ["魅力", "必見", "ぜひ", "いかがでしょうか", "話題沸騰", "今すぐ", "間違いなし"];
function lintBanned(text) {
  return BANNED.filter((w) => text.includes(w));
}

// openBDから内容紹介(あらすじ)を1冊ぶん取得（編集者の見立てを書く素材）
async function fetchOpenBDSummary(isbn) {
  try {
    const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`);
    if (!res.ok) return "";
    const arr = await res.json();
    const tc = (arr || [])[0]?.onix?.CollateralDetail?.TextContent;
    if (Array.isArray(tc)) {
      const hit = tc.find((x) => x.TextType === "03" && x.Text) || tc.find((x) => x.Text);
      if (hit?.Text) return String(hit.Text).replace(/\s+/g, " ").trim();
    }
  } catch (_) {}
  return "";
}

// DeepSeekで「編集者の見立て」型のX投稿を1つ生成（事実ベース・煽らない）。失敗時はnull。
async function craftEditorialPost(book, summary) {
  if (!DEEPSEEK_API_KEY) return null;
  const sys =
    "あなたは文芸書にくわしい編集者です。X(旧Twitter)用に新刊を紹介する短い投稿を1つ書きます。\n" +
    "# 必須要素（この順で自然に）\n" +
    "1. 冒頭で『書名』と著者名を必ず出す（例: 『書名』(著者名)。）\n" +
    "2. どんな本か＝主題やジャンルを、内容紹介を“要約”して1〜2文（あらすじの丸写しは禁止）。\n" +
    "3. 末尾に「どんな読者に響くか」を一言（例: 〜が好きな人に。/〜したい夜に。）。\n" +
    "# 声・事実\n" +
    "- 落ち着いた編集者の「見立て」。煽らない。与えられた『内容紹介』の事実だけを使い、捏造・脚色しない。内容紹介が無い場合は書名・著者・版元だけで簡潔に。\n" +
    "# 制約\n" +
    "- 日本語、90〜120字（全角）。絶対に130字を超えない。改行は2〜3回まで。\n" +
    "- ハッシュタグは付けない。絵文字は使わない。『』「」は可。\n" +
    "- 使ってはいけない語: 魅力 必見 ぜひ いかがでしょうか 話題沸騰 今すぐ 絶対 神 感動必至 涙腺崩壊\n" +
    "- 本文だけを返す（説明・引用符・コードブロックなし）。";
  const user =
    `書名: ${book.title}\n著者: ${(book.author || "").split("/")[0]}\n出版社: ${book.publisher}\n発売日: ${book.published_date}\n内容紹介: ${summary || "(なし)"}`;
  try {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    let t = d?.choices?.[0]?.message?.content?.trim();
    if (!t) return null;
    t = t.replace(/^["'`]+|["'`]+$/g, "").trim();
    return trimToWeight(t, 278); // X上限を超えたら文単位で削る
  } catch (_) {
    return null;
  }
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
    // <>で囲まないとDiscordが書影をインライン表示する→長押しで保存→Xに添付しやすい
    if (p.image_url) msg += `\n📎 書影（保存してXに添付）: ${p.image_url}`;
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

  // 最近キットに出した本（重複出し防止。14日以内の全isbn13を除外）。
  // x_posts テーブルがあれば本物の重複防止、無ければ空＝下のローテーションで日替わりにする。
  const recentIsbn = new Set();
  try {
    const { data } = await sb
      .from("x_posts")
      .select("isbn13,created_at")
      .gte("created_at", since14 + "T00:00:00Z");
    for (const r of data || []) if (r.isbn13) recentIsbn.add(r.isbn13);
  } catch (_) {}

  const posts = []; // {kind, isbn13?, slug?, content, image_url?}
  const usedIsbn = new Set(); // このキット内で既に出した本（①②の重複防止）

  // ---- (1) 今日の新刊ダイジェスト（リンク無し・コンテンツ） ----
  try {
    // 今日の文芸書（正確な冊数はcountで取得し、見出し用に数冊だけ実体を引く）
    const SEL = "title,author,publisher,isbn13,image_url,published_date";
    // 写真集/グラビア＋ハーレクイン（恋愛輸入）を除外して文芸らしさを保つ
    const CLEAN = (q) =>
      q.not("title", "ilike", "%写真集%")
        .not("title", "ilike", "%グラビア%")
        .not("publisher", "ilike", "%ハーレクイン%")
        .not("publisher", "ilike", "%ハーパーコリンズ%"); // 現ハーレクイン日本（恋愛輸入）を除外

    let label = `今日 ${mdJP(today)}`;
    let count = 0;
    let pool = [];

    const todayCountQ = CLEAN(
      sb.from("books").select("*", { count: "exact", head: true })
        .eq("published_date", today).in("genre_id", HIGHLIGHT_GENRES)
    );
    count = (await todayCountQ).count || 0;

    if (count > 0) {
      const { data } = await CLEAN(
        sb.from("books").select(SEL).eq("published_date", today).in("genre_id", HIGHLIGHT_GENRES)
      ).limit(120);
      pool = data || [];
    } else {
      // 今日が0冊なら直近7日に切替
      label = "今週";
      const wkStart = addDaysUTC(today, -7);
      count =
        (await CLEAN(
          sb.from("books").select("*", { count: "exact", head: true })
            .gte("published_date", wkStart).lte("published_date", today)
            .in("genre_id", HIGHLIGHT_GENRES)
        )).count || 0;
      const { data } = await CLEAN(
        sb.from("books").select(SEL)
          .gte("published_date", wkStart).lte("published_date", today)
          .in("genre_id", HIGHLIGHT_GENRES)
          .order("published_date", { ascending: false })
      ).limit(200);
      pool = data || [];
    }

    // ラノベ/なろう/成人/長すぎ題名＋著者データ壊れを除外（文芸らしさを保つ）
    pool = pool.filter((b) => !looksLikeJunk(b.title) && goodMeta(b));

    if (pool.length > 0) {
      // 既出本（recentIsbn）を除外し、プール全体から日付でローテーション（毎日違う本に）。
      // 有名著者縛りはしない（該当が少ないと同じ本ばかりになるため。注目著者は②で扱う）
      let fresh = pool.filter((b) => b.isbn13 && !recentIsbn.has(b.isbn13));
      if (fresh.length === 0) fresh = pool; // 全部既出なら諦めてpool全体から
      const base = fresh;
      const off = dayNum(today) % base.length;
      const rotated = base.slice(off).concat(base.slice(0, off));
      const picks = [...new Map(rotated.slice(0, 2).map((b) => [b.isbn13, b])).values()];
      for (const b of picks) if (b.isbn13) usedIsbn.add(b.isbn13);
      const names = picks.map((b) => `『${b.title}』(${(b.author || "").split("/")[0]})`).join("、");
      const content =
        `📚 ${label}発売の文芸書は${count}冊。\n` +
        `注目は${names} など。\n` +
        `#本好きと繋がりたい`;
      posts.push({
        kind: "new_books_digest",
        content,
        image_url: coverImg(picks[0] && picks[0].image_url), // 1冊目の書影を手動添付用に
        isbns: picks.map((b) => b.isbn13).filter(Boolean), // 見出しに出した本も重複防止対象に
      });
    }
  } catch (e) {
    console.error("digest生成スキップ:", e.message);
  }

  // ---- (2) 編集者の見立て（注目の新刊）：あらすじ→DeepSeekで1冊を紹介 ----
  try {
    const { data: recent } = await sb
      .from("books")
      .select("title,author,publisher,isbn13,image_url,published_date")
      .in("genre_id", HIGHLIGHT_GENRES)
      .not("publisher", "ilike", "%ハーレクイン%")
      .not("publisher", "ilike", "%ハーパーコリンズ%")
      .gte("published_date", since21)
      .lte("published_date", today)
      .order("published_date", { ascending: false })
      .limit(200);
    // 良質な候補（ジャンク/著者データ壊れ/既出/①使用を除外）。注目著者を優先、日付でローテ。
    const cands = (recent || []).filter(
      (b) =>
        b.isbn13 && !recentIsbn.has(b.isbn13) && !usedIsbn.has(b.isbn13) && !looksLikeJunk(b.title) && goodMeta(b)
    );
    const notableCands = cands.filter((b) => notable.some((n) => (b.author || "").includes(n)));
    const ordered = notableCands.length ? notableCands : cands;
    const start = ordered.length ? dayNum(today) % ordered.length : 0;
    const rotated = ordered.slice(start).concat(ordered.slice(0, start));
    // あらすじ(openBD)がある本を先頭から探す（最大5冊試す）。見立てには内容が要る。
    let chosen = null;
    let summary = "";
    for (const b of rotated.slice(0, 5)) {
      const s = await fetchOpenBDSummary(b.isbn13);
      if (s) { chosen = b; summary = s; break; }
    }
    if (chosen) {
      const author = (chosen.author || "").split("/")[0];
      const crafted = await craftEditorialPost(chosen, summary); // 編集者の見立て（DeepSeek）
      const content =
        crafted ||
        `『${chosen.title}』${author}（${chosen.publisher}）\n${mdJP(chosen.published_date)}発売。`;
      posts.push({ kind: "spotlight", isbn13: chosen.isbn13, content, image_url: coverImg(chosen.image_url) });
    }
    // あらすじのある本が見つからなければ②は出さない（中身の薄い投稿を作らない）
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
      const content = `コラムを公開しました。\n「${c.title}」\n${url}\n#本好きと繋がりたい`;
      posts.push({ kind: "column_promo", slug: c.slug, content });
    }
  } catch (e) {
    console.error("column_promo生成スキップ:", e.message);
  }

  // ---- (4) 今日が誕生日の作家（事実ベース・リンク無し・フォロワー獲得用） ----
  try {
    const dataDir = path.join(__dirname, "..", "data");
    const birthdays = JSON.parse(
      fs.readFileSync(path.join(dataDir, "author-birthdays.json"), "utf8")
    );
    // 手動上書きを優先（自動で拾えない作家・差し替え用）
    let override = {};
    try {
      override = JSON.parse(fs.readFileSync(path.join(dataDir, "author-birthdays-override.json"), "utf8"));
    } catch (_) {}
    const md = today.slice(5); // MM-DD
    const bd = override[md] || birthdays[md];
    if (bd) {
      const [, m, d] = today.split("-");
      let c = `📚 今日${Number(m)}月${Number(d)}日は、${bd.name}（${bd.year}年生まれ）の誕生日。`;
      if (bd.note) c += `\n${bd.note}。`;
      c += `\n#今日は何の日`;
      posts.push({ kind: "birthday", content: c });
    }
    // 該当作家がいない日は④を出さない（無理に思想ポストを作らない）
  } catch (e) {
    console.error("誕生日ポスト生成スキップ:", e.message);
  }

  // ---- 出力（Job Summary or stdout） ----
  const kindLabel = {
    new_books_digest: "① 今日の新刊ダイジェスト（リンク無し）",
    spotlight: "② 編集者の見立て（注目の新刊・リンク無し）",
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
    if (p.image_url) md += `- 📎 書影（開いて保存→Xに添付）: ${p.image_url}\n`;
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
    const rows = [];
    for (const p of posts) {
      rows.push({
        kind: p.kind,
        isbn13: p.isbn13 || null,
        slug: p.slug || null,
        content: p.content,
        image_url: p.image_url || null,
        status: "queued",
      });
      // ダイジェストで取り上げた本も個別に記録（recentIsbnで再出題を防ぐ）
      if (Array.isArray(p.isbns)) {
        for (const isbn of p.isbns) {
          rows.push({ kind: "digest_book", isbn13: isbn, slug: null, content: p.content, image_url: null, status: "queued" });
        }
      }
    }
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
