import type { Genre } from "@/types/book";

const APP_ID = process.env.RAKUTEN_APP_ID!;
const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID ?? "";
const BASE_URL = "https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404";

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
  const res = await fetch(`${BASE_URL}?${params}`, { cache: "no-store" });
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
