#!/usr/bin/env node
/**
 * 日次バッチ: 楽天ブックスAPIから文芸新刊を取得してSupabaseに保存する
 * 実行: node scripts/fetch-books.js
 * 必要な環境変数: RAKUTEN_APP_ID, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require("@supabase/supabase-js");

// ===== 設定 =====

const RAKUTEN_APP_ID       = process.env.RAKUTEN_APP_ID;
const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID ?? "";
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY         = process.env.SUPABASE_SERVICE_ROLE_KEY; // バッチはservice_role

const GENRES = [
  { id: "001004008", label: "小説（日本）" },
  { id: "001004009", label: "小説（海外）" },
  { id: "001004001", label: "ミステリー"  },
  { id: "001004002", label: "SF・ホラー"  },
  { id: "001004003", label: "エッセイ"    },
];

// 過去7日〜今後30日を取得ウィンドウとする
const WINDOW_PAST_DAYS   = 7;
const WINDOW_FUTURE_DAYS = 30;

// ===== ユーティリティ =====

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayJST() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  )
    .toISOString()
    .slice(0, 10);
}

function dateRange() {
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  );
  const from = new Date(today);
  from.setDate(from.getDate() - WINDOW_PAST_DAYS);
  const to = new Date(today);
  to.setDate(to.getDate() + WINDOW_FUTURE_DAYS);
  // 楽天API形式: YYYYMMDD
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  return { from: fmt(from), to: fmt(to) };
}

function parseSalesDate(salesDate) {
  // "2026年06月04日" → "2026-06-04"
  const m = salesDate.match(/(\d{4})年(\d{2})月(\d{2})日/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const m2 = salesDate.match(/(\d{4})年(\d{2})月/);
  if (m2) return `${m2[1]}-${m2[2]}-01`;
  return null;
}

function toISBN10(isbn13) {
  const digits = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * parseInt(digits[i]);
  const check = (11 - (sum % 11)) % 11;
  return digits + (check === 10 ? "X" : String(check));
}

function parseISBN(isbn) {
  const clean = isbn.replace(/-/g, "");
  if (clean.length === 13) {
    return {
      isbn13: clean,
      isbn10: clean.startsWith("978") ? toISBN10(clean) : null,
    };
  }
  return { isbn13: clean, isbn10: null };
}

// ===== 楽天API =====

async function fetchGenrePage(genreId, salesDateFrom, salesDateTo, page) {
  const params = new URLSearchParams({
    applicationId:  RAKUTEN_APP_ID,
    affiliateId:    RAKUTEN_AFFILIATE_ID,
    booksGenreId:   genreId,
    salesDate:      `${salesDateFrom}TO${salesDateTo}`,
    hits:           "30",
    page:           String(page),
    sort:           "salesDate",
    outOfStockFlag: "1",
    formatVersion:  "2",
  });

  const url = `https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?${params}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Rakuten API error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function fetchAllBooksForGenre(genreId, label, from, to) {
  const books = [];
  let page = 1;

  while (true) {
    console.log(`  📖 ${label} — ページ ${page} 取得中...`);
    const data = await fetchGenrePage(genreId, from, to, page);
    const items = data.Items ?? [];

    for (const { Item } of items) {
      const { isbn13, isbn10 } = parseISBN(Item.isbn ?? "");
      const publishedDate = parseSalesDate(Item.salesDate ?? "");
      if (!isbn13 || !publishedDate) continue;

      books.push({
        isbn13,
        isbn10:         isbn10 ?? null,
        title:          Item.title,
        author:         Item.author ?? "",
        publisher:      Item.publisherName ?? "",
        published_date: publishedDate,
        genre_id:       genreId,
        image_url:      Item.largeImageUrl ?? Item.mediumImageUrl ?? null,
        rakuten_url:    Item.affiliateUrl || Item.itemUrl || null,
        amazon_url:     isbn10 ? `https://www.amazon.co.jp/dp/${isbn10}` : null,
        description:    null, // openBDフェーズ2で追加
        last_synced_at: new Date().toISOString(),
      });
    }

    // 次ページがあるか確認
    if (page >= (data.pageCount ?? 1)) break;
    page++;

    // 楽天API規約: 1秒1リクエスト
    await sleep(1100);
  }

  return books;
}

// ===== Supabase upsert =====

async function upsertBooks(supabase, books) {
  if (books.length === 0) return 0;

  // isbn13 で重複除去（ジャンルをまたいで同じ本が来る場合がある）
  const seen = new Set();
  const unique = books.filter((b) => {
    if (seen.has(b.isbn13)) return false;
    seen.add(b.isbn13);
    return true;
  });

  const { error, count } = await supabase
    .from("books")
    .upsert(unique, { onConflict: "isbn13", count: "exact" });

  if (error) throw new Error(`Supabase upsert error: ${error.message}`);
  return count ?? unique.length;
}

// ===== メイン =====

async function main() {
  // 環境変数チェック
  if (!RAKUTEN_APP_ID) {
    console.error("❌ RAKUTEN_APP_ID が設定されていません");
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { from, to } = dateRange();

  console.log(`\n🌸 新刊日和 日次バッチ開始`);
  console.log(`📅 取得期間: ${from} 〜 ${to}`);
  console.log(`📚 対象ジャンル: ${GENRES.length}件\n`);

  const allBooks = [];

  for (const genre of GENRES) {
    try {
      const books = await fetchAllBooksForGenre(genre.id, genre.label, from, to);
      console.log(`  ✅ ${genre.label}: ${books.length}冊取得\n`);
      allBooks.push(...books);
    } catch (err) {
      console.error(`  ⚠️ ${genre.label} 取得エラー: ${err.message}`);
    }

    // ジャンル間も1秒あける
    await sleep(1100);
  }

  console.log(`\n💾 Supabase に保存中... (合計 ${allBooks.length}冊)`);
  const saved = await upsertBooks(supabase, allBooks);
  console.log(`✅ 完了: ${saved}件 upsert\n`);
}

main().catch((err) => {
  console.error("❌ バッチ失敗:", err.message);
  process.exit(1);
});
