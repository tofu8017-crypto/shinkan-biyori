#!/usr/bin/env node
/**
 * 収集カバレッジ検証: 指定日について「楽天にある新刊」と「DBにある新刊」を比較し、
 * 取りこぼし（楽天にあってDBに無いISBN）を一覧表示する。
 *
 * 実行: node scripts/verify-coverage.js 2026-06-26 [genreId]
 *   日付省略時は今日(JST)。genreId を渡すとそのトップジャンルだけ検証。
 * 必要な環境変数: RAKUTEN_APP_ID, RAKUTEN_ACCESS_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require("@supabase/supabase-js");

const RAKUTEN_APP_ID     = process.env.RAKUTEN_APP_ID;
const RAKUTEN_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
const SUPABASE_URL       = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY;

// fetch-books.js と同じトップジャンル＋split指定
const GENRES = [
  { id: "001004008", label: "小説（日本）", split: true },
  { id: "001004009", label: "小説（海外）", split: true },
  { id: "001004001", label: "ミステリー" },
  { id: "001004002", label: "SF・ホラー" },
  { id: "001004003", label: "エッセイ" },
  { id: "001004004", label: "ノンフィクション" },
  { id: "001004016", label: "ロマンス" },
  { id: "001017",    label: "ライトノベル" },
  { id: "001001",    label: "コミック" },
  { id: "001019",    label: "文庫" },
  { id: "001006",    label: "ビジネス・実用書" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayJST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });

function parseSalesDate(s) {
  let m = (s || "").match(/(\d{4})年(\d{2})月(\d{2})日/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = (s || "").match(/(\d{4})年(\d{2})月/);
  if (m) return `${m[1]}-${m[2]}-01`;
  return null;
}

async function rakutenPage(genreId, page) {
  const params = new URLSearchParams({
    applicationId: RAKUTEN_APP_ID,
    accessKey: RAKUTEN_ACCESS_KEY,
    booksGenreId: genreId,
    hits: "30",
    page: String(page),
    sort: "-releaseDate",
    outOfStockFlag: "1",
    formatVersion: "2",
  });
  const url = `https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404?${params}`;
  const res = await fetch(url, { headers: { Referer: "https://shinkanbiyori.com" } });
  if (!res.ok) throw new Error(`Rakuten API ${res.status}`);
  return res.json();
}

async function getChildGenres(parentId) {
  const params = new URLSearchParams({ applicationId: RAKUTEN_APP_ID, accessKey: RAKUTEN_ACCESS_KEY, booksGenreId: parentId });
  const url = `https://openapi.rakuten.co.jp/services/api/BooksGenre/Search/20121128?${params}`;
  const res = await fetch(url, { headers: { Referer: "https://shinkanbiyori.com" } });
  if (!res.ok) throw new Error(`Genre API ${res.status}`);
  const data = await res.json();
  return (data.children ?? []).map((c) => (c.child ?? c).booksGenreId).filter(Boolean);
}

// queryGenreId の中で、発売日が target の本(isbn13→title)を集める
async function rakutenBooksOnDate(queryGenreId, target, map) {
  let page = 1, pastStreak = 0;
  const MAX = 60;
  while (page <= MAX) {
    let data;
    try { data = await rakutenPage(queryGenreId, page); } catch { break; }
    const items = data.Items ?? [];
    if (items.length === 0) break;
    let maxDate = null;
    for (const it of items) {
      const b = it.Item ?? it;
      const d = parseSalesDate(b.salesDate);
      const isbn = (b.isbn || "").replace(/-/g, "");
      if (!d) continue;
      if (maxDate === null || d > maxDate) maxDate = d;
      if (d === target && isbn.length === 13) map.set(isbn, b.title);
    }
    if (page >= (data.pageCount ?? 1)) break;
    if (maxDate !== null && maxDate < target) { if (++pastStreak >= 2) break; } else pastStreak = 0;
    page++;
    await sleep(1100);
  }
}

async function main() {
  if (!RAKUTEN_APP_ID || !SUPABASE_URL) { console.error("環境変数が未設定です"); process.exit(1); }
  const target = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || todayJST();
  const onlyGenre = process.argv.slice(2).find((a) => /^[0-9]{6,}$/.test(a));
  const genres = onlyGenre ? GENRES.filter((g) => g.id === onlyGenre) : GENRES;

  console.log(`\n🔎 カバレッジ検証: ${target}\n`);
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // DB側
  const { data: dbRows, error } = await supabase.from("books").select("isbn13,title,genre_id").eq("published_date", target);
  if (error) throw new Error(error.message);
  const dbSet = new Set((dbRows ?? []).map((r) => r.isbn13));
  console.log(`DB: ${dbSet.size}件\n`);

  let totalGap = 0;
  for (const g of genres) {
    const map = new Map(); // 楽天側 isbn13 -> title
    let queryIds = [g.id];
    if (g.split) {
      try { queryIds = await getChildGenres(g.id); await sleep(1100); } catch { queryIds = [g.id]; }
    }
    for (const qid of queryIds) { await rakutenBooksOnDate(qid, target, map); await sleep(300); }

    const gaps = [...map.entries()].filter(([isbn]) => !dbSet.has(isbn));
    totalGap += gaps.length;
    console.log(`【${g.label}】楽天 ${map.size}件 / DB欠落 ${gaps.length}件`);
    gaps.slice(0, 10).forEach(([isbn, title]) => console.log(`   ✗ ${isbn}  ${String(title).slice(0, 40)}`));
    if (gaps.length > 10) console.log(`   …他 ${gaps.length - 10}件`);
  }

  console.log(`\n${totalGap === 0 ? "✅ 取りこぼしなし" : `⚠️ 合計 ${totalGap}件の取りこぼし（楽天にあってDBに無い）`}\n`);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
