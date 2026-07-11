// 日次自動収集(fetch-books.js)の日付窓(過去95日〜先45日)から外れる本を、
// 手動リスト(data/manual-books.json)から楽天APIで実データを取得して恒久的にSupabaseへ登録する。
// 完結済み人気作など「新刊ではないが載せたい本」を追加したいときに使う（今後も同じ手順で追加可）。
//
// 使い方: 手動リストにISBN13を足してから
//   node -r dotenv/config scripts/seed-manual-books.js dotenv_config_path=.env.local
// 必要な環境変数: RAKUTEN_APP_ID / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID;
const RAKUTEN_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// fetch-books.js と同じ発売日パース（"2026年06月04日"→"2026-06-04"。月のみなら1日扱い、不明はnull）
function parseSalesDate(salesDate) {
  const m = (salesDate || "").match(/(\d{4})年(\d{2})月(\d{2})日/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const m2 = (salesDate || "").match(/(\d{4})年(\d{2})月/);
  if (m2) return `${m2[1]}-${m2[2]}-01`;
  return null;
}

// fetch-books.js と同じISBN10変換ロジック
function toISBN10(isbn13) {
  const digits = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(digits[i]);
  const check = (11 - (sum % 11)) % 11;
  return digits + (check === 10 ? "X" : String(check));
}

async function fetchByIsbn(isbn13) {
  const params = new URLSearchParams({
    applicationId: RAKUTEN_APP_ID,
    accessKey: RAKUTEN_ACCESS_KEY,
    isbn: isbn13,
    formatVersion: "2",
  });
  const url = `https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404?${params}`;
  const res = await fetch(url, { headers: { Referer: "https://shinkanbiyori.com" } });
  if (!res.ok) throw new Error(`楽天APIエラー ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.Items ?? [])[0] ?? null;
}

async function main() {
  if (!RAKUTEN_APP_ID || !RAKUTEN_ACCESS_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error("env未設定（RAKUTEN_APP_ID / RAKUTEN_ACCESS_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）");
    process.exit(1);
  }
  const list = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "manual-books.json"), "utf8")
  ).books;

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const rows = [];

  for (const entry of list) {
    const isbn13 = entry.isbn13.replace(/-/g, "");
    console.log(`楽天APIで検索中: ${isbn13}`);
    const item = await fetchByIsbn(isbn13);
    if (!item) {
      console.error(`  見つかりませんでした（スキップ）: ${isbn13}`);
      await sleep(1100);
      continue;
    }
    const publishedDate = parseSalesDate(item.salesDate);
    if (!publishedDate) {
      console.error(`  発売日を確認できないためスキップ: ${item.title}（${item.salesDate}）`);
      await sleep(1100);
      continue;
    }

    rows.push({
      isbn13,
      isbn10: isbn13.startsWith("978") ? toISBN10(isbn13) : null,
      title: item.title,
      author: item.author ?? "",
      publisher: item.publisherName ?? "",
      published_date: publishedDate,
      genre_id: entry.genre_id,
      image_url: item.largeImageUrl ?? item.mediumImageUrl ?? null,
      rakuten_url: item.affiliateUrl || item.itemUrl || null,
      amazon_url: isbn13.startsWith("978") ? `https://www.amazon.co.jp/dp/${toISBN10(isbn13)}` : null,
      description: null,
      last_synced_at: new Date().toISOString(),
    });
    console.log(`  取得: 『${item.title}』（${publishedDate}）`);
    await sleep(1100); // 楽天API規約: 1秒1リクエスト
  }

  if (rows.length === 0) {
    console.log("登録できる本がありませんでした。");
    return;
  }

  const { error, count } = await sb.from("books").upsert(rows, { onConflict: "isbn13", count: "exact" });
  if (error) throw new Error(error.message);
  console.log(`\n完了: ${count ?? rows.length}冊をSupabaseへ登録（既存分は上書き更新）`);
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
