// コラム自動生成オーケストレータ（純Node・Claudeトークン不使用）。
// 従来 daily-column.yml で Claude がやっていた「KW選定→ジャンル判定→本選定→素材組立→執筆→draft保存」を移植。
// 各コラムは独立 try/catch で、1本失敗しても他を止めない。公開はしない（draftのみ）。
//
// 使い方: DEEPSEEK_API_KEY=... node -r dotenv/config scripts/auto-generate.js [本数] dotenv_config_path=.env.local
//   既定2本。

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TAG = "shinkanbiyori-22";
const N = Number(process.argv.find((a) => /^[0-9]$/.test(a))) || 2;
const MAX_KD = Number(process.env.MAX_KD) || 35;
const BOOK_DAYS = Number(process.env.BOOK_DAYS) || 60;

const norm = (s) => (s || "").replace(/[\s　]/g, "").toLowerCase();
// quality-check.js の字数下限と揃える（本文が短いまま公開ゲートに出しても毎回落ちるだけなので、
// ここで一度だけ書き直しのチャンスを与える）
const QC_MIN_CHARS = Number(process.env.QC_MIN_CHARS) || 1800;
const plainLen = (html) => (html || "").replace(/<[^>]+>/g, "").replace(/\s/g, "").length;

// 在庫と噛み合わない/文芸でないKWは生成しない。
// （実データ上 ミステリー001004001・SF001004002・ロマンス001004016 はほぼ0冊で、
//   小説の大半は 001004008 に入る。narrowジャンル看板の記事は中身とズレるため避ける）
const SKIP = [
  "なろう", "ラノベ", "ライトノベル", "電撃", "メディアワークス", "ガガガ", "富士見", "スニーカー", "ga文庫", "オーバーラップ",
  "コミック", "漫画", "マンガ", "コミックス",
  "雑誌", "絵本", "児童", "図鑑", "教科書", "参考書", "資格", "問題集",
  "経済", "ビジネス", "自己啓発",
  "pod", "ハーレクイン", "kindle", "電子書籍リーダー",
  // 出版社・レーベル指定KW（在庫を出版社で絞れず看板とズレるため生成しない）
  "小学館", "集英社", "講談社", "角川", "kadokawa", "新潮", "文藝春秋", "文春", "幻冬舎",
  "ポプラ", "早川", "ハヤカワ", "創元", "宝島", "双葉", "光文社", "徳間", "河出",
  "中央公論", "中公", "ちくま", "岩波", "祥伝社", "アルファポリス", "スターツ",
];

// 生成を許すのは「在庫のある文芸テーマに明確に結びつくKW」だけ（ALLOWゲート）。
const ALLOW = ["小説", "文庫", "エッセイ", "随筆", "単行本", "海外", "翻訳", "ノンフィクション", "文芸", "新刊"];

// キーワード→ジャンルID。中身のあるジャンルだけにマップ（narrowな空ジャンルには振らない）。既定は小説(日本)。
function mapGenre(kw) {
  if (/(文庫)/.test(kw)) return "001019";
  if (/(エッセイ|随筆)/.test(kw)) return "001004003";
  if (/(海外|翻訳)/.test(kw)) return "001004009";
  if (/(ノンフィクション|ルポ|ドキュメント)/.test(kw)) return "001004004";
  return "001004008"; // 小説（日本）：ミステリ/SF含む大半がここ
}

function jstToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
function addDaysUTC(isoDate, n) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function amazonUrl(b) {
  if (b.isbn10) return `https://www.amazon.co.jp/dp/${b.isbn10}?tag=${TAG}`;
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(b.isbn13 || b.title)}&tag=${TAG}`;
}

async function pickKeywords(sb) {
  const all = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "seo-keywords.json"), "utf8")
  );
  const used = new Set();
  const { data } = await sb.from("columns").select("target_keyword");
  for (const c of data || []) if (c.target_keyword) used.add(norm(c.target_keyword));

  return all
    .filter((k) => k.keyword && k.volume > 0 && k.kd <= MAX_KD)
    .filter((k) => !used.has(norm(k.keyword)))
    // SKIP/ALLOW は空白を無視して判定（"メディア ワークス" 等の分かち書き対策）
    .filter((k) => !SKIP.some((s) => norm(k.keyword).includes(norm(s))))
    .filter((k) => ALLOW.some((a) => norm(k.keyword).includes(norm(a))))
    .sort((a, b) => b.volume - a.volume);
}

// 文芸コラムに不適切なタイトルを除外（写真集・グラビア・成人向け等）。
// 成人向け高信号語を強化（「好色村」(竹書房文庫)等の漏れを防ぐ。lib/genre-classifyのADULT_TITLEと揃える）。
const NG_TITLE = [
  "写真集", "グラビア", "アイドル", "ヌード", "av編集", "撮影会",
  "射精", "官能", "エロ", "18禁", "成人向け",
  "好色", "淫", "痴女", "巨乳", "爆乳", "中出", "寝取", "性奴隷", "人妻",
  "媚薬", "牝", "陵辱", "痴漢", "蜜夜", "ふたなり", "発情", "童貞", "絶頂", "性欲",
];

async function getBooks(sb, genreId) {
  const today = jstToday();
  const since = addDaysUTC(today, -BOOK_DAYS);
  let q = sb
    .from("books")
    .select("title,author,publisher,isbn10,isbn13,rakuten_url,published_date,image_url")
    .eq("genre_id", genreId)
    .gte("published_date", since)
    .lte("published_date", today);
  for (const w of NG_TITLE) q = q.not("title", "ilike", `%${w}%`);
  const { data } = await q
    .order("published_date", { ascending: false })
    .limit(6); // 12選リストをやめ少数に絞る（フォールバック時も絞り込み）
  return (data || []).map((b) => ({
    title: b.title,
    author: b.author,
    publisher: b.publisher,
    published_date: b.published_date,
    isbn13: b.isbn13,
    isbn10: b.isbn10,
    amazon_url: amazonUrl(b),
    rakuten_url: b.rakuten_url,
    image_url: b.image_url,
  }));
}

// 通し日数（在庫ローテ・固有名詞日の判定に使う）
function epochDay(isoDate) {
  return Math.floor(Date.parse(isoDate + "T00:00:00Z") / 86400000);
}

// 既に使ったターゲットKW（重複生成防止）
async function getUsedKeywords(sb) {
  const used = new Set();
  const { data } = await sb.from("columns").select("target_keyword");
  for (const c of data || []) if (c.target_keyword) used.add(norm(c.target_keyword));
  return used;
}

// 文芸とみなすジャンル（簿記/資格/ビジネス001006・コミック001001を除外）
const LITERARY_GENRES = ["001004008", "001004009", "001004001", "001004002", "001004003", "001019"];

// 著者名らしくない値を弾く（編集部・教材・資格系・作画など＝文芸の作家ではない）
function looksJunkAuthor(a) {
  return /編集|アンソロジ|作画|イラスト|ｺﾐｯｸ|コミック|ムック|公式|ガイド|attsuxx|画報|学院|会議所|研究会|試験|問題集|検定|資格|スクール|アカデミー|協会|委員会|アソシエーツ|辞典|事典/.test(a);
}

// 版違い（【サイン本】/新装版/文庫版 等）を同一作品とみなすためのタイトルキー。
// 上巻/下巻など巻数は別作品として残す（除去しない）。
function titleKey(t) {
  return (t || "")
    .replace(/[【〔（(\[].*?[】〕）)\]]/g, "")
    .replace(/サイン本|新装版|完全版|愛蔵版|特装版|限定版|文庫版|新版|改訂版/g, "")
    .replace(/[\s　]/g, "")
    .toLowerCase();
}

// 在庫の全作家から「直近に2冊以上ある作家」を拾い、固有名詞コラムのテーマにする。
// 作家名中心（藤澤さん方針 2026-06-30、週5日は固有名詞）。在庫のある本だけで書く前提。
// 文芸ジャンル限定＋ハーレクイン(恋愛輸入)除外で、簿記/資格/ロマンス輸入を排除する。
async function getAuthorTopics(sb, used) {
  const today = jstToday();
  const since = addDaysUTC(today, -180); // 60日だと作家が足りないので広めに
  let q = sb
    .from("books")
    .select("author,title,genre_id,published_date")
    .in("genre_id", LITERARY_GENRES)
    .not("publisher", "ilike", "%ハーレクイン%")
    .not("publisher", "ilike", "%ハーパーコリンズ%")
    .gte("published_date", since)
    .lte("published_date", today);
  for (const w of NG_TITLE) q = q.not("title", "ilike", `%${w}%`);
  const { data } = await q.order("published_date", { ascending: false }).limit(2000);

  const map = new Map(); // normAuthor -> {author, titles:Set, genre:{id:count}}
  for (const b of data || []) {
    const a = (b.author || "").split("/")[0].trim();
    if (!a || a.length < 2 || /[0-9A-Za-z]/.test(a) || looksJunkAuthor(a)) continue;
    const k = norm(a);
    if (!map.has(k)) map.set(k, { author: a, titles: new Set(), genre: {} });
    const e = map.get(k);
    e.titles.add(titleKey(b.title)); // 版違いは1作として数える
    e.genre[b.genre_id] = (e.genre[b.genre_id] || 0) + 1;
  }
  let authors = [...map.values()].filter((e) => e.titles.size >= 2);
  for (const e of authors) {
    e.genre_id = Object.entries(e.genre).sort((x, y) => y[1] - x[1])[0][0];
  }
  // 既出作家は除外。在庫が多い順を基本に、日でローテして毎日違う作家に。
  authors = authors.filter(
    (e) => !used.has(norm(`${e.author} おすすめ`)) && !used.has(norm(e.author))
  );
  authors.sort((a, b) => b.titles.size - a.titles.size);
  const off = authors.length ? epochDay(today) % authors.length : 0;
  const rotated = authors.slice(off).concat(authors.slice(0, off));
  return rotated.map((e) => ({
    keyword: `${e.author} おすすめ`,
    genre_id: e.genre_id,
    author: e.author,
  }));
}

// 指定作家の在庫本（固有名詞コラムの引用材料）。ジャンル横断で集める。
async function getBooksByAuthor(sb, author) {
  const today = jstToday();
  const since = addDaysUTC(today, -180);
  let q = sb
    .from("books")
    .select("title,author,publisher,isbn10,isbn13,rakuten_url,published_date,image_url")
    .ilike("author", `%${author}%`)
    .in("genre_id", LITERARY_GENRES)
    .not("publisher", "ilike", "%ハーレクイン%")
    .not("publisher", "ilike", "%ハーパーコリンズ%")
    .gte("published_date", since)
    .lte("published_date", today);
  for (const w of NG_TITLE) q = q.not("title", "ilike", `%${w}%`);
  const { data } = await q.order("published_date", { ascending: false }).limit(20);
  // 版違い（サイン本等）を1作にまとめる。最新の1冊を代表に。
  const seen = new Set();
  const out = [];
  for (const b of data || []) {
    const k = titleKey(b.title);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      title: b.title,
      author: b.author,
      publisher: b.publisher,
      published_date: b.published_date,
      isbn13: b.isbn13,
      isbn10: b.isbn10,
      amazon_url: amazonUrl(b),
      rakuten_url: b.rakuten_url,
      image_url: b.image_url,
    });
    if (out.length >= 12) break;
  }
  return out;
}

function run(script, args) {
  return execFileSync("node", [path.join(__dirname, script), ...args], {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

async function main() {
  if (!SUPABASE_URL || !KEY) {
    console.error("env未設定（NEXT_PUBLIC_SUPABASE_URL / キー）");
    process.exit(1);
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("DEEPSEEK_API_KEY 未設定");
    process.exit(1);
  }
  const sb = createClient(SUPABASE_URL, KEY);
  const used = await getUsedKeywords(sb);

  // 作家名テーマを基本にする（藤澤さん方針 2026-06-30）。
  // 「日付の新刊◯◯選」リスト型はラノベ/成人が混ざるため廃止し、作家コラムに統一。
  // 作家が足りない日だけ一般KWへフォールバック（その場合も少数・成人除外）。
  const entityDay = true;

  const chosen = []; // {keyword, genre_id, author?}
  const usedGenre = new Set();

  if (entityDay) {
    const topics = await getAuthorTopics(sb, used);
    for (const t of topics) {
      if (chosen.length >= N) break;
      chosen.push({ keyword: t.keyword, genre_id: t.genre_id, author: t.author });
      usedGenre.add(t.genre_id);
    }
    console.log(`固有名詞デー: 作家テーマ ${chosen.length}本（${chosen.map((c) => c.author).join("、") || "該当なし"}）`);
  }

  // 固有名詞で埋まらない分（一般KWデー or 作家が足りない時）は従来の一般KWで補う
  if (chosen.length < N) {
    const candidates = await pickKeywords(sb);
    for (const c of candidates) {
      if (chosen.length >= N) break;
      const g = mapGenre(c.keyword);
      if (usedGenre.has(g)) continue;
      if (chosen.some((x) => x.keyword === c.keyword)) continue;
      chosen.push({ keyword: c.keyword, genre_id: g });
      usedGenre.add(g);
    }
    // 別ジャンルで埋まらなければ重複ジャンル許容で補う
    for (const c of candidates) {
      if (chosen.length >= N) break;
      if (chosen.some((x) => x.keyword === c.keyword)) continue;
      chosen.push({ keyword: c.keyword, genre_id: mapGenre(c.keyword) });
    }
  }

  if (chosen.length === 0) {
    console.log("狙えるテーマが残っていません。今日は生成なし。");
    return;
  }

  let ok = 0;
  for (let i = 0; i < chosen.length; i++) {
    const { keyword, genre_id, author } = chosen[i];
    try {
      console.log(`\n[${i + 1}] KW="${keyword}" genre=${genre_id}${author ? ` (作家:${author})` : ""}`);
      const books = author ? await getBooksByAuthor(sb, author) : await getBooks(sb, genre_id);
      if (books.length < 2) {
        console.log(`  本が${books.length}冊しか無いのでスキップ`);
        continue;
      }
      const inPath = `/tmp/input-${i}.json`;
      const matPath = `/tmp/materials-${i}.json`;
      fs.writeFileSync(inPath, JSON.stringify({ target_keyword: keyword, genre_id, books }));

      run("build-materials.js", [inPath, matPath]);
      const out = run("write-column-deepseek.js", [matPath]);
      const m = out.match(/(\/tmp\/column-[^\s]+\.json)/);
      if (!m) {
        console.error("  生成結果のパスを取得できず");
        continue;
      }
      let colPath = m[1];

      // 本文が品質ゲートの字数下限に届かなければ、届くまで最大2回まで書き直す
      // （プロンプトの目標3,500字に対し、DeepSeekの実出力が1,800字未満に収まりがちで
      //   ゲート不合格→非公開が続いた反省。1回の書き直しでは僅差で届かないことがあり
      //   2026-07-08に1回打ち切り→最大2回に変更）。
      for (let retry = 0; retry < 2; retry++) {
        const len = plainLen(JSON.parse(fs.readFileSync(colPath, "utf8")).body_html);
        if (len >= QC_MIN_CHARS) break;
        console.log(`  本文${len}字で下限(${QC_MIN_CHARS}字)未満 → 書き直し(${retry + 1}/2)を試みる`);
        const lenNotePath = `/tmp/length-note-${i}-${retry}.txt`;
        fs.writeFileSync(
          lenNotePath,
          `本文が${len}字しかなく短すぎます（目標は3,500字以上）。各書籍ブロックを「書誌事実／内容紹介／読みどころ・背景／どんな人に響くか」の4部構成で、資料にある情報を漏らさず具体的に掘り下げて増やしてください（新しい事実は作らない・同じ内容の言い換えで水増ししない）。導入とまとめも具体的に書いてください。`
        );
        try {
          const out3 = run("write-column-deepseek.js", [matPath, lenNotePath]);
          const m3 = out3.match(/(\/tmp\/column-[^\s]+\.json)/);
          if (m3) {
            colPath = m3[1];
            const len2 = plainLen(JSON.parse(fs.readFileSync(colPath, "utf8")).body_html);
            console.log(`  書き直し後: ${len2}字`);
          }
        } catch (e) {
          console.error("  書き直しに失敗（元の下書きで続行）:", e.message);
          break;
        }
      }

      // 無料Gemini(別系統AI)でファクトチェック→指摘があればDeepSeekで1回だけ自己修正。
      // SARPのジューリーを¥0で再現。Geminiが落ちても元コラムで続行（フェイルセーフ）。
      try {
        const rev = JSON.parse(run("review-column-gemini.js", [colPath, matPath]) || "{}");
        if (rev && rev.ok === false && Array.isArray(rev.issues) && rev.issues.length) {
          console.log(`  Geminiファクトチェック: ${rev.issues.length}件の指摘 → 1回修正`);
          const notePath = `/tmp/review-note-${i}.txt`;
          fs.writeFileSync(notePath, rev.issues.map((s, idx) => `${idx + 1}. ${s}`).join("\n"));
          const out2 = run("write-column-deepseek.js", [matPath, notePath]);
          const m2 = out2.match(/(\/tmp\/column-[^\s]+\.json)/);
          if (m2) colPath = m2[1];
        } else {
          console.log("  Geminiファクトチェック: 指摘なし");
        }
      } catch (e) {
        console.error("  Geminiチェックをスキップ（続行）:", e.message);
      }

      // アイキャッチ＝先頭の本の表紙（高解像度化）。無ければ save-column 側がプール画像にフォールバック。
      const lead = books.find((b) => b.image_url);
      if (lead) {
        const hiRes = lead.image_url.replace(/_ex=\d+x\d+/, "_ex=600x600");
        try {
          const col = JSON.parse(fs.readFileSync(colPath, "utf8"));
          col.hero_image_url = hiRes;
          fs.writeFileSync(colPath, JSON.stringify(col));
        } catch (e) {
          console.error("  hero_image_url 付与に失敗（続行）:", e.message);
        }
      }

      run("save-column.js", [colPath]);
      ok++;
    } catch (e) {
      console.error(`  [${i + 1}] 失敗（他は継続）: ${e.message}`);
    }
  }
  console.log(`\n完了: ${ok}/${chosen.length} 本を下書き保存`);
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
