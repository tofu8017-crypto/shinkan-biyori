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

async function getBooks(sb, genreId) {
  const today = jstToday();
  const since = addDaysUTC(today, -BOOK_DAYS);
  const { data } = await sb
    .from("books")
    .select("title,author,publisher,isbn10,isbn13,rakuten_url,published_date")
    .eq("genre_id", genreId)
    .gte("published_date", since)
    .lte("published_date", today)
    .not("title", "ilike", "%写真集%")
    .not("title", "ilike", "%グラビア%")
    .not("title", "ilike", "%アイドル%")
    .order("published_date", { ascending: false })
    .limit(12);
  return (data || []).map((b) => ({
    title: b.title,
    author: b.author,
    publisher: b.publisher,
    published_date: b.published_date,
    isbn13: b.isbn13,
    isbn10: b.isbn10,
    amazon_url: amazonUrl(b),
    rakuten_url: b.rakuten_url,
  }));
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
  const candidates = await pickKeywords(sb);
  if (candidates.length === 0) {
    console.log("狙えるキーワードが残っていません。今日は生成なし。");
    return;
  }

  // ジャンルが偏らないよう、できるだけ別ジャンルでN本選ぶ
  const chosen = [];
  const usedGenre = new Set();
  for (const c of candidates) {
    const g = mapGenre(c.keyword);
    if (usedGenre.has(g) && chosen.length < candidates.length) continue;
    chosen.push({ keyword: c.keyword, genre_id: g });
    usedGenre.add(g);
    if (chosen.length >= N) break;
  }
  // 別ジャンルで埋まらなければ重複ジャンル許容で補う
  for (const c of candidates) {
    if (chosen.length >= N) break;
    if (chosen.some((x) => x.keyword === c.keyword)) continue;
    chosen.push({ keyword: c.keyword, genre_id: mapGenre(c.keyword) });
  }

  let ok = 0;
  for (let i = 0; i < chosen.length; i++) {
    const { keyword, genre_id } = chosen[i];
    try {
      console.log(`\n[${i + 1}] KW="${keyword}" genre=${genre_id}`);
      const books = await getBooks(sb, genre_id);
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
      run("save-column.js", [m[1]]);
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
