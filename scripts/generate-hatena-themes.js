// はてなブログのテーマプール（data/hatena-themes.json）が尽きたときに、
// GSCの実際の検索クエリを手がかりにDeepSeekへ新テーマを考えさせ、追記する。
// 「捏造リスクの低い読書論・選び方・入門」という既存の設計は変えない
// （特定の本の内容には触れず、一般的な読書行動についての主張のみ）。
//
// 使い方:
//   node scripts/generate-hatena-themes.js [追加する本数=8] [--dry-run]
//     .env.local と ~/secrets/gsc-shinkan-biyori-key.json をローカルでは自動で読む
//
// 必要な環境変数: GSC_CREDENTIALS_JSON（または鍵ファイル） / DEEPSEEK_API_KEY

const fs = require("fs");
const path = require("path");
const { getAccessToken, gscQuery, loadCredentials } = require("./lib/gsc-client");
const { isCleanText } = require("./weekly-optimize");

if (!process.env.DEEPSEEK_API_KEY) {
  try {
    require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
  } catch {}
}

const DRY_RUN = process.argv.includes("--dry-run");
const COUNT = Number(process.argv.find((a) => /^[0-9]+$/.test(a))) || 8;

const THEMES_PATH = path.join(__dirname, "..", "data", "hatena-themes.json");
const POSTS_LOG_PATH = path.join(
  __dirname,
  "..",
  ".claude",
  "skills",
  "hatena-auto-poster",
  "data",
  "posts.log"
);

const DEEPSEEK_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

function jstToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
function addDaysUTC(isoDate, n) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const norm = (s) => (s || "").replace(/[\s　]/g, "").toLowerCase();
const tokens = (s) => (s || "").split(/[\s　]+/).filter(Boolean).map((t) => t.toLowerCase());

// 新規候補が既存テーマ・既投稿と「近すぎないか」を語の重なりで判定する
// （check-dup.sh と同じ発想: 2語以上重なれば同じネタとみなす）
function isTooSimilar(candidateKeyword, avoidTokenSets) {
  const cand = new Set(tokens(candidateKeyword));
  for (const avoid of avoidTokenSets) {
    let hits = 0;
    for (const t of avoid) if (cand.has(t)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

// キーワードから関連ジャンルを推定し、内部リンクを組み立てる（AIにURLを作らせない＝リンク切れ防止）
function pickInternalLinks(keyword) {
  if (/(海外|翻訳)/.test(keyword)) return ["https://shinkanbiyori.com/genre/001004009", "https://shinkanbiyori.com/column"];
  if (/(ミステリ)/.test(keyword)) return ["https://shinkanbiyori.com/genre/001004001", "https://shinkanbiyori.com/column"];
  if (/(sf|ホラー|ファンタジー)/i.test(keyword)) return ["https://shinkanbiyori.com/genre/001004002", "https://shinkanbiyori.com/column"];
  if (/(エッセイ|随筆)/.test(keyword)) return ["https://shinkanbiyori.com/genre/001004003", "https://shinkanbiyori.com/column"];
  if (/(時代小説|歴史)/.test(keyword)) return ["https://shinkanbiyori.com/genre/jidai", "https://shinkanbiyori.com/column"];
  if (/(文庫)/.test(keyword)) return ["https://shinkanbiyori.com/genre/001019", "https://shinkanbiyori.com/column"];
  return ["https://shinkanbiyori.com", "https://shinkanbiyori.com/column"];
}

// ── 「著者名 おすすめ」テーマ ───────────────────────────
// 実在の書名を楽天APIから取ってきて facts として渡す（AIに書名を発明させない）。
// 著者ページが200で存在するものだけ採用する（run側のリンク200チェックで落ちないように）。
const AUTHOR_LIST_PATH = path.join(__dirname, "..", "data", "notable-authors.json");
const BIRTHDAYS_PATH = path.join(__dirname, "..", "data", "author-birthdays.json");

function candidateAuthors() {
  const notable = JSON.parse(fs.readFileSync(AUTHOR_LIST_PATH, "utf8"));
  const bd = Object.values(JSON.parse(fs.readFileSync(BIRTHDAYS_PATH, "utf8")))
    .flat()
    .filter((a) => a && a.jp && a.name)
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .map((a) => a.name);
  return [...new Set([...notable, ...bd])];
}

async function rakutenBooksByAuthor(name) {
  if (!process.env.RAKUTEN_APP_ID || !process.env.RAKUTEN_ACCESS_KEY) return [];
  const params = new URLSearchParams({
    applicationId: process.env.RAKUTEN_APP_ID,
    accessKey: process.env.RAKUTEN_ACCESS_KEY,
    author: name,
    hits: "12",
    sort: "-releaseDate",
    outOfStockFlag: "1",
    formatVersion: "2",
  });
  const res = await fetch(
    `https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404?${params}`,
    { headers: { Referer: "https://shinkanbiyori.com" } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.Items || [])
    .map((b) => ({ title: b.title, publisher: b.publisherName, salesDate: b.salesDate }))
    .filter((b) => b.title && isCleanText(b.title));
}

async function authorPageUrl(name) {
  const url = `https://shinkanbiyori.com/authors/${encodeURIComponent(name.replace(/[\s　]/g, ""))}`;
  try {
    const res = await fetch(url);
    return res.status === 200 ? url : null;
  } catch {
    return null;
  }
}

// 上から順に試し、count件そろうか候補を使い切るまで。1件ごとに2回fetchするので上限を切る
async function buildAuthorThemes(avoidTokenSets, count) {
  const out = [];
  let tried = 0;
  for (const name of candidateAuthors()) {
    if (out.length >= count || tried >= 40) break;
    const keyword = `${name} おすすめ`;
    if (isTooSimilar(keyword, avoidTokenSets)) continue;
    tried++;
    const url = await authorPageUrl(name);
    if (!url) continue;
    const books = await rakutenBooksByAuthor(name);
    if (books.length < 3) continue;
    out.push({
      keyword,
      angle: `${name}をこれから読む人に向けて、どの作品から入るか・どんな読者に合うかを、実在の書誌の範囲で示す`,
      internal_links: [url, "https://shinkanbiyori.com/column"],
      facts: { author: name, books },
    });
    avoidTokenSets.push(tokens(keyword));
    console.log(`  + ${keyword}（書誌${books.length}件）`);
  }
  return out;
}

async function fetchRealQueries() {
  const today = jstToday();
  const startDate = addDaysUTC(today, -90); // サイトが若いのでウィンドウを広めに
  const endDate = addDaysUTC(today, -1);
  const token = await getAccessToken(loadCredentials());
  const rows = await gscQuery(token, {
    startDate,
    endDate,
    dimensions: ["query"],
    rowLimit: 1000,
    dataState: "all",
  });
  return rows
    .filter((r) => isCleanText(r.keys[0]))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 40)
    .map((r) => `「${r.keys[0]}」(表示${r.impressions}回)`);
}

async function generateThemes(existingList, realQueries, count) {
  const system = `あなたは書籍系ブログの編集者です。文芸書サイト「新刊日和」の被リンク用ブログ(はてなブログ)の新しい記事テーマを考えます。
必ずJSONだけを返す: {"themes": [{"keyword": "...", "angle": "..."}, ...]}
ルール:
- keywordは検索されそうな2〜4語（例: "読書 習慣 続かない"）
- angleは1文で、記事の主張・切り口を説明する
- 【最重要】特定の本のタイトル・著者・内容の具体的な話は書かない（捏造リスク回避のため）。書くのは「選び方」「入門」「読み方」「向き合い方」といった一般的な読書行動についての主張だけ
- ライトノベル・なろう系・成人向けの話題は避ける
- 既存テーマと重複しない、新しい切り口にする
- 「初心者」は使わない（読書は資格や技能ではないので不自然。「はじめて読む人」「入門」等に言い換える）`;

  const user = `【実際にサイトで検索されている語（読者の関心の手がかり。特定の本の話は書かないこと）】
${realQueries.join("、") || "（データなし）"}

【既存テーマ（このリストと被らない新しい切り口で ${count} 件考えて）】
${existingList.map((t) => `- ${t.keyword}: ${t.angle}`).join("\n")}`;

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek APIエラー: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const out = JSON.parse((await res.json()).choices?.[0]?.message?.content || "{}");
  return Array.isArray(out.themes) ? out.themes : [];
}

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("環境変数 DEEPSEEK_API_KEY が未設定です");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(THEMES_PATH, "utf8"));
  const postedKeywords = fs.existsSync(POSTS_LOG_PATH)
    ? fs
        .readFileSync(POSTS_LOG_PATH, "utf8")
        .split("\n")
        .map((l) => l.split("\t")[2])
        .filter(Boolean)
    : [];
  const avoidTokenSets = [...data.themes.map((t) => t.keyword), ...postedKeywords].map(tokens);

  // まず「著者名 おすすめ」を実データから作る。足りない分だけDeepSeekの一般テーマで埋める
  console.log(`「著者名 おすすめ」テーマを実データから作成中...`);
  const authorThemes = await buildAuthorThemes(avoidTokenSets, COUNT);
  if (authorThemes.length >= COUNT) {
    writeThemes(data, authorThemes);
    return;
  }

  console.log(`GSCの検索クエリを取得中...`);
  const realQueries = await fetchRealQueries();
  console.log(`実データ: ${realQueries.length}件の検索語（サイト直近90日）`);

  console.log(`DeepSeekで新テーマを${COUNT}件発想中...`);
  const generated = await generateThemes(data.themes, realQueries, COUNT - authorThemes.length);

  const accepted = [];
  for (const g of generated) {
    const keyword = (g.keyword || "").trim();
    const angle = (g.angle || "").trim();
    if (!keyword || !angle) continue;
    if (!isCleanText(keyword + angle)) {
      console.log(`  不採用(ラノベ/成人向け語): ${keyword}`);
      continue;
    }
    if (isTooSimilar(keyword, avoidTokenSets)) {
      console.log(`  不採用(既存と類似): ${keyword}`);
      continue;
    }
    if (norm(keyword).length < 4 || keyword.length > 30) {
      console.log(`  不採用(長さ不正): ${keyword}`);
      continue;
    }
    accepted.push({ keyword, angle, internal_links: pickInternalLinks(keyword) });
    avoidTokenSets.push(tokens(keyword)); // 生成内での重複も防ぐ
  }

  console.log(`\n採用: ${accepted.length}件`);
  for (const t of accepted) console.log(`  + ${t.keyword} … ${t.angle}`);

  writeThemes(data, [...authorThemes, ...accepted]);
}

function writeThemes(data, accepted) {
  if (accepted.length === 0) {
    console.log("追加できるテーマがありませんでした。");
    return;
  }

  if (DRY_RUN) {
    console.log("\n(dry-run: data/hatena-themes.json への書き込みはしません)");
    return;
  }

  // 新しいテーマを先頭に入れる（run側は先頭から未投稿の1件を選ぶため、
  // 「著者名 おすすめ」が古い一般テーマより先に消化される）
  data.themes.unshift(...accepted);
  // 既存ファイルと同じ「1テーマ1行」の見た目を保つため、配列全体を手組みで整形する
  // （JSON.stringify(data, null, 2)だと各テーマが多行に展開され差分が読みにくくなる）
  const themeLine = (t) =>
    `    ${JSON.stringify({ keyword: t.keyword, angle: t.angle, internal_links: t.internal_links, ...(t.facts ? { facts: t.facts } : {}) })}`;
  const body = [
    "{",
    `  "_comment": ${JSON.stringify(data._comment)},`,
    `  "themes": [`,
    data.themes.map(themeLine).join(",\n"),
    `  ]`,
    "}",
    "",
  ].join("\n");
  fs.writeFileSync(THEMES_PATH, body);
  console.log(`\ndata/hatena-themes.json に${accepted.length}件追記しました（合計${data.themes.length}件）`);
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
