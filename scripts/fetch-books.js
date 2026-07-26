#!/usr/bin/env node
/**
 * 日次バッチ: 楽天ブックスAPIから文芸新刊を取得してSupabaseに保存する
 * 実行: node scripts/fetch-books.js
 * 必要な環境変数: RAKUTEN_APP_ID, RAKUTEN_ACCESS_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require("@supabase/supabase-js");
const { cleanDescription } = require("./lib/openbd");

// ===== 設定 =====

const RAKUTEN_APP_ID       = process.env.RAKUTEN_APP_ID;
const RAKUTEN_ACCESS_KEY   = process.env.RAKUTEN_ACCESS_KEY;
const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID ?? "";
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY         = process.env.SUPABASE_SERVICE_ROLE_KEY; // バッチはservice_role

// split:true のジャンルは巨大すぎて -releaseDate ページングが不安定になり最近日の本を取りこぼす。
// 楽天の子サブジャンル（著者名の読み等）に分割して収集し、保存時は genre_id を親IDに正規化する。
const GENRES = [
  { id: "001004008", label: "小説（日本）", split: true },
  { id: "001004009", label: "小説（海外）" }, // 子ジャンル無し・総数1.5万で親収集でも取りこぼし無し（検証済）
  { id: "001004001", label: "ミステリー"  },
  { id: "001004002", label: "SF・ホラー"  },
  { id: "001004003", label: "エッセイ"    },
  { id: "001004004", label: "ノンフィクション" },
  { id: "001004016", label: "ロマンス"    },
  { id: "001017",    label: "ライトノベル" },
  { id: "001001",    label: "コミック"    },
  { id: "001019",    label: "文庫"        },
  { id: "001006",    label: "ビジネス・実用書" },
];

// 楽天APIには発売日の絞り込み入力パラメータが無い（salesDateは出力専用）。
// そこで -releaseDate（発売日の新しい順）で取得し、こちら側で「直近〜近刊」の窓だけ保存する。
const WINDOW_PAST_DAYS   = 95;   // 何日前まで保存するか（過去約3ヶ月）
const WINDOW_FUTURE_DAYS = 45;   // 何日先（近刊）まで保存するか（約1ヶ月半先）
const FAR_FUTURE_DAYS    = 120;  // これより先は「発売日未定」のプレースホルダ(例:2225年)とみなし除外

const MAX_PAGE              = 100; // 親ジャンルのページ安全上限（楽天APIの上限）
const MAX_PAGE_CHILD        = 40;  // 子サブジャンルのページ安全上限（小さいので通常はこれより手前で止まる）
const PAST_WINDOW_STREAK_MAX = 2;  // 「ページ内の最新日<窓開始」が連続このページ数続いたら停止（非単調ソートの揺れ吸収）

// ===== ユーティリティ =====

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// en-CAロケールは "YYYY-MM-DD" 形式。timeZone指定で日本の暦日を正しく取得する
function todayJST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 保存対象の日付窓（"YYYY-MM-DD"文字列で比較。この形式は辞書順=日付順なのでそのまま大小比較できる）
function dateWindow() {
  const today = todayJST();
  return {
    start:     addDays(today, -WINDOW_PAST_DAYS),
    end:       addDays(today,  WINDOW_FUTURE_DAYS),
    farFuture: addDays(today,  FAR_FUTURE_DAYS),
  };
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

async function fetchGenrePage(genreId, page) {
  const params = new URLSearchParams({
    applicationId:  RAKUTEN_APP_ID,
    accessKey:      RAKUTEN_ACCESS_KEY,
    affiliateId:    RAKUTEN_AFFILIATE_ID,
    booksGenreId:   genreId,
    // salesDateは入力フィルタとして機能しない（出力専用）ため指定しない。
    // 発売日の新しい順で取得し、保存対象は呼び出し側が日付窓で絞る。
    hits:           "30",
    page:           String(page),
    sort:           "-releaseDate",
    outOfStockFlag: "1",
    formatVersion:  "2",
  });

  const url = `https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404?${params}`;

  // 一時的な "fetch failed" やサーバー側の不調に備えて最大3回リトライ（バックオフ付き）
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Referer: "https://shinkanbiyori.com" } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Rakuten API error ${res.status}: ${text.slice(0, 200)}`);
      }
      return res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await sleep(2000 * attempt); // 2秒, 4秒とバックオフ
    }
  }
  throw lastErr;
}

// 親ジャンルの子サブジャンルID一覧を楽天から取得（split対象のフォールバック兼用）
async function getChildGenres(parentId) {
  const params = new URLSearchParams({
    applicationId: RAKUTEN_APP_ID,
    accessKey:     RAKUTEN_ACCESS_KEY,
    booksGenreId:  parentId,
  });
  const url = `https://openapi.rakuten.co.jp/services/api/BooksGenre/Search/20121128?${params}`;
  const res = await fetch(url, { headers: { Referer: "https://shinkanbiyori.com" } });
  if (!res.ok) throw new Error(`Rakuten Genre API ${res.status}`);
  const data = await res.json();
  return (data.children ?? [])
    .map((c) => (c.child ?? c).booksGenreId)
    .filter(Boolean);
}

// queryGenreId を -releaseDate でページングし、窓内の本を集める。
// storeGenreId に保存用ジャンルID（子分割時は親IDへ正規化）。maxPage は安全上限。
async function fetchAllBooksForGenre(queryGenreId, label, win, storeGenreId = queryGenreId, maxPage = MAX_PAGE) {
  const books = [];
  let page = 1;
  let pastWindowStreak = 0; // 「ページ全体が窓より過去」が続いた回数

  while (page <= maxPage) {
    const data = await fetchGenrePage(queryGenreId, page);
    const items = data.Items ?? [];
    if (items.length === 0) break;

    let maxRealDate = null;  // このページの「未定でない最新の発売日」
    let pageWindowHits = 0;

    for (const Item of items) {
      const { isbn13, isbn10 } = parseISBN(Item.isbn ?? "");
      const publishedDate = parseSalesDate(Item.salesDate ?? "");
      if (!isbn13 || !publishedDate) continue;

      // 遠すぎる未来（2225年等）は「発売日未定」のプレースホルダなので除外（保存もページング判定もしない）
      if (publishedDate > win.farFuture) continue;

      if (maxRealDate === null || publishedDate > maxRealDate) maxRealDate = publishedDate;

      // 保存するのは「直近〜近刊」の窓内だけ
      if (publishedDate >= win.start && publishedDate <= win.end) {
        pageWindowHits++;
        books.push({
          isbn13,
          isbn10:         isbn10 ?? null,
          title:          Item.title,
          author:         Item.author ?? "",
          publisher:      Item.publisherName ?? "",
          published_date: publishedDate,
          genre_id:       storeGenreId,
          image_url:      Item.largeImageUrl ?? Item.mediumImageUrl ?? null,
          rakuten_url:    Item.affiliateUrl || Item.itemUrl || null,
          amazon_url:     isbn10 ? `https://www.amazon.co.jp/dp/${isbn10}` : null,
          // 楽天itemCaption（あらすじ/商品説明）を格納。約7割の本に付く（openBDは約4%と手薄）。
          // HTMLタグ除去・500字整形。窓内の本は毎日再収集されるので順次埋まる。
          description:    cleanDescription(Item.itemCaption) || null,
          last_synced_at: new Date().toISOString(),
        });
      }
    }

    console.log(`  📖 ${label} — ページ${String(page).padStart(3)}（窓内 +${pageWindowHits} / 累計 ${books.length}冊 / 最新 ${maxRealDate ?? "-"}）`);

    // 末尾ページに到達したら終了
    if (page >= (data.pageCount ?? 1)) break;

    // ページ内の最新日すら窓開始より古い＝以降は全て窓より過去。
    // 非単調ソートの揺れを吸収するため、連続 PAST_WINDOW_STREAK_MAX 回で停止。
    // （未来側のページは maxRealDate>=win.start なので、ここでは早期停止しない＝窓に必ず到達する）
    if (maxRealDate !== null && maxRealDate < win.start) {
      pastWindowStreak++;
      if (pastWindowStreak >= PAST_WINDOW_STREAK_MAX) break;
    } else {
      pastWindowStreak = 0;
    }

    page++;
    await sleep(1100); // 楽天API規約: 1秒1リクエスト
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
  if (!RAKUTEN_APP_ID || !RAKUTEN_ACCESS_KEY) {
    console.error("❌ RAKUTEN_APP_ID または RAKUTEN_ACCESS_KEY が設定されていません");
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const win = dateWindow();

  // 引数でジャンルIDを1つ渡すとそれだけ実行（例: node scripts/fetch-books.js 001006）。
  // 数字6桁以上の引数だけをジャンルIDとみなす（-r dotenv/config の dotenv_config_path=... を誤認しないため）
  const onlyGenre = process.argv.slice(2).find((a) => /^[0-9]{6,}$/.test(a));
  const targetGenres = onlyGenre ? GENRES.filter((g) => g.id === onlyGenre) : GENRES;

  console.log(`\n🌸 新刊日和 日次バッチ開始`);
  console.log(`📅 保存対象の発売日: ${win.start} 〜 ${win.end}（${win.farFuture}より先は未定扱いで除外）`);
  console.log(`📚 対象ジャンル: ${targetGenres.length}件\n`);

  const allBooks = [];

  for (const genre of targetGenres) {
    try {
      // split対象: 子サブジャンル単位で収集し、genre_id は親IDへ正規化して保存
      let childIds = null;
      if (genre.split) {
        try {
          childIds = await getChildGenres(genre.id);
          await sleep(1100);
        } catch (e) {
          console.error(`  ⚠️ ${genre.label} 子ジャンル取得失敗(${e.message}) → 親ジャンルで収集`);
          childIds = null;
        }
      }

      if (childIds && childIds.length) {
        console.log(`  🔀 ${genre.label}: ${childIds.length}個の子ジャンルで収集`);
        let genreCount = 0;
        for (const cid of childIds) {
          const books = await fetchAllBooksForGenre(cid, `${genre.label}/${cid.slice(-3)}`, win, genre.id, MAX_PAGE_CHILD);
          genreCount += books.length;
          allBooks.push(...books);
          await sleep(1100);
        }
        console.log(`  ✅ ${genre.label}: 窓内 ${genreCount}冊取得（子${childIds.length}個合計）\n`);
      } else {
        const books = await fetchAllBooksForGenre(genre.id, genre.label, win, genre.id, MAX_PAGE);
        console.log(`  ✅ ${genre.label}: 窓内 ${books.length}冊取得\n`);
        allBooks.push(...books);
      }
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
