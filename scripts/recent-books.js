// コラム執筆の素材として、直近の新刊をジャンル別に取得する。
// 使い方: node -r dotenv/config scripts/recent-books.js 001004001 30 dotenv_config_path=.env.local
//   第1引数: ジャンルID（数字6桁以上）/ 第2引数(任意): 何日前まで（既定30）
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TAG = "shinkanbiyori-22";

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

async function main() {
  const args = process.argv.slice(2);
  const genreId = args.find((a) => /^[0-9]{6,}$/.test(a));
  const daysArg = args.find((a) => /^[0-9]{1,3}$/.test(a));
  const days = daysArg ? parseInt(daysArg, 10) : 30;

  if (!genreId) {
    console.error("ジャンルID（数字6桁以上）を指定してください");
    process.exit(1);
  }
  if (!SUPABASE_URL || !KEY) {
    console.error("env未設定（NEXT_PUBLIC_SUPABASE_URL / キー）");
    process.exit(1);
  }

  const today = jstToday();
  const since = addDaysUTC(today, -days);
  const sb = createClient(SUPABASE_URL, KEY);
  let q = sb
    .from("books")
    .select("title,author,publisher,isbn10,isbn13,rakuten_url,published_date")
    .eq("genre_id", genreId)
    .gte("published_date", since)
    .lte("published_date", today);
  // 文芸コラムに不適切なタイトルを除外（写真集・グラビア・成人向け等）
  const NG = ["写真集", "グラビア", "アイドル", "射精", "官能", "エロ", "18禁", "成人向け", "ヌード", "av編集", "撮影会"];
  for (const w of NG) q = q.not("title", "ilike", `%${w}%`);
  const { data, error } = await q
    .order("published_date", { ascending: false })
    .limit(20);

  if (error) {
    console.error("取得エラー:", error.message);
    process.exit(1);
  }

  const books = (data ?? []).map((b) => ({
    title: b.title,
    author: b.author,
    publisher: b.publisher,
    published_date: b.published_date,
    isbn13: b.isbn13,
    isbn10: b.isbn10,
    amazon_url: amazonUrl(b),
    rakuten_url: b.rakuten_url,
  }));

  console.log(JSON.stringify({ genreId, since, today, count: books.length, books }, null, 2));
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
