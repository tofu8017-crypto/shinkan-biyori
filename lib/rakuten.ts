import type { Genre, Book } from "@/types/book";
import { GENRES } from "@/types/book";
import { effectiveGenreId } from "./author-genre";

const APP_ID = process.env.RAKUTEN_APP_ID!;
const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY ?? "";
const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID ?? "";
// 2026年の楽天API刷新で旧ドメイン(app.rakuten.co.jp)は廃止。新方式は
// openapiドメイン＋accessKey＋Refererヘッダーが必須。
const BASE_URL = "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404";
// Refererは登録アプリURLと一致させる必要がある（楽天側で検証されるため）
const API_REFERER = "https://shinkanbiyori.com";

export type RakutenBook = {
  isbn: string
  title: string
  author: string
  publisherName: string
  salesDate: string        // "2026年06月04日"
  largeImageUrl: string
  affiliateUrl: string
  itemUrl: string
  booksGenreId: string
}

type RakutenResponse = {
  Items: { Item: RakutenBook }[]
  pageCount: number
  page: number
}

export async function fetchRakutenBooks(
  genreId: Genre,
  salesDateFrom: string,  // YYYYMMDD
  salesDateTo: string,
  page = 1
): Promise<RakutenResponse> {
  const params = new URLSearchParams({
    applicationId: APP_ID,
    accessKey: ACCESS_KEY,
    affiliateId: AFFILIATE_ID,
    booksGenreId: genreId,
    salesDate: `${salesDateFrom}TO${salesDateTo}`,
    hits: "30",
    page: String(page),
    sort: "salesDate",
    outOfStockFlag: "1",
    formatVersion: "2",
  });

  // 楽天API規約: 1秒1リクエスト遵守のためsleepは呼び出し元で制御
  const res = await fetch(`${BASE_URL}?${params}`, {
    cache: "no-store",
    headers: { Referer: API_REFERER },
  });
  if (!res.ok) throw new Error(`Rakuten API error: ${res.status}`);
  return res.json();
}

export function parseISBN(isbn: string): { isbn13: string; isbn10: string | null } {
  const clean = isbn.replace(/-/g, "");
  if (clean.length === 13) {
    const isbn10 = clean.startsWith("978") ? toISBN10(clean) : null;
    return { isbn13: clean, isbn10 };
  }
  if (clean.length === 10) {
    return { isbn13: toISBN13(clean), isbn10: clean };
  }
  return { isbn13: clean, isbn10: null };
}

function toISBN10(isbn13: string): string {
  const digits = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * parseInt(digits[i]);
  const check = (11 - (sum % 11)) % 11;
  return digits + (check === 10 ? "X" : String(check));
}

function toISBN13(isbn10: string): string {
  const digits = "978" + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return digits + check;
}

export function toAmazonUrl(isbn10: string | null): string | null {
  if (!isbn10) return null;
  return `https://www.amazon.co.jp/dp/${isbn10}`;
}

export function parseSalesDate(salesDate: string): string {
  // "2026年06月04日" → "2026-06-04"
  const m = salesDate.match(/(\d{4})年(\d{2})月(\d{2})日/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // "2026年06月" → "2026-06-01" (月のみの場合)
  const m2 = salesDate.match(/(\d{4})年(\d{2})月/);
  if (m2) return `${m2[1]}-${m2[2]}-01`;
  return salesDate;
}

// ───────── 全カタログ検索（DBに無い旧作も楽天APIから補う） ─────────

const KNOWN_GENRE_IDS = GENRES.map((g) => g.id);
const EXCLUDE_TITLE_WORDS = ["写真集", "グラビア", "アイドル"];

// 楽天のbooksGenreId（"001004008"等、複数なら"/"区切り）を当サイトのジャンルに寄せる。
// 該当が無ければ「小説（日本）」をデフォルトにする。
function mapRakutenGenre(booksGenreId: string | undefined): Genre {
  const raw = booksGenreId ?? "";
  for (const id of KNOWN_GENRE_IDS) {
    if (raw.includes(id)) return id;
  }
  return "001004008";
}

// 楽天の検索結果1件を当サイトのBook型へ変換する。DB未収録なのでISBNを擬似idに使う。
function rakutenItemToBook(item: RakutenBook): Book | null {
  const { isbn13, isbn10 } = parseISBN(item.isbn ?? "");
  if (!isbn13) return null;
  return {
    id: isbn13,
    isbn13,
    isbn10,
    title: item.title ?? "",
    author: item.author ?? "",
    publisher: item.publisherName ?? "",
    published_date: parseSalesDate(item.salesDate ?? ""),
    // 作家オーバーライドを反映（伊坂幸太郎→ミステリー等）。無ければ楽天ジャンルをそのまま。
    genre_id: effectiveGenreId(item.author, mapRakutenGenre(item.booksGenreId)),
    image_url: item.largeImageUrl || null,
    rakuten_url: item.affiliateUrl || item.itemUrl || null,
    amazon_url: toAmazonUrl(isbn10),
    description: null,
    last_synced_at: "",
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// author / title いずれかのフィールドで楽天書籍APIを1ページ（最大30件）検索する。
async function rakutenSearchByField(
  field: "author" | "title",
  query: string
): Promise<RakutenBook[]> {
  const params = new URLSearchParams({
    applicationId: APP_ID,
    accessKey: ACCESS_KEY,
    affiliateId: AFFILIATE_ID,
    [field]: query,
    booksGenreId: "001", // 本（書籍）全体
    sort: "-releaseDate", // 新しい順
    hits: "30",
    outOfStockFlag: "1",
    formatVersion: "2",
  });
  const res = await fetch(`${BASE_URL}?${params}`, {
    cache: "no-store",
    headers: { Referer: API_REFERER },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.Items ?? []) as RakutenBook[];
}

// 作家名・書名で楽天の全カタログを検索する。著者検索＋書名検索を統合し、ISBNで重複排除。
export async function searchRakutenBooks(query: string, limit = 60): Promise<Book[]> {
  const q = query.trim();
  if (!q || !APP_ID) return [];

  let raw: RakutenBook[] = [];
  try {
    raw = await rakutenSearchByField("author", q);
    await sleep(350); // 楽天API規約「1秒1リクエスト」に配慮
    raw = raw.concat(await rakutenSearchByField("title", q));
  } catch {
    // 取得できなくても検索全体は止めない（DB結果のみで返す）
    return [];
  }

  const seen = new Set<string>();
  const books: Book[] = [];
  for (const item of raw) {
    const book = rakutenItemToBook(item);
    if (!book) continue;
    if (seen.has(book.isbn13)) continue;
    if (EXCLUDE_TITLE_WORDS.some((w) => book.title.includes(w))) continue;
    seen.add(book.isbn13);
    books.push(book);
  }
  books.sort((a, b) => b.published_date.localeCompare(a.published_date));
  return books.slice(0, limit);
}

// ISBN13で楽天から1冊取得する。DB未収録の書籍詳細ページのフォールバック用。
export async function fetchRakutenByIsbn(isbn13: string): Promise<Book | null> {
  if (!APP_ID) return null;
  const params = new URLSearchParams({
    applicationId: APP_ID,
    accessKey: ACCESS_KEY,
    affiliateId: AFFILIATE_ID,
    isbn: isbn13,
    hits: "1",
    formatVersion: "2",
  });
  try {
    const res = await fetch(`${BASE_URL}?${params}`, {
      cache: "no-store",
      headers: { Referer: API_REFERER },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const item = ((data.Items ?? []) as RakutenBook[])[0];
    return item ? rakutenItemToBook(item) : null;
  } catch {
    return null;
  }
}
