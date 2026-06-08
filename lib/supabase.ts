import type { Book } from "@/types/book";
import type { Column } from "@/types/column";
import { MOCK_BOOKS } from "./mock-data";

function isValidSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") && url !== "https://xxxxxx.supabase.co";
  } catch {
    return false;
  }
}

const useMock = !isValidSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

// トップ（今日の新刊・直近7日間・日付ページ）から除外するジャンル＝ビジネス・実用書。
// 看板が「文芸書の新刊カレンダー」なので、実用書は専用タブ(/genre/001006)からのみ閲覧可とする。
const HOME_EXCLUDED_GENRE = "001006";

// ジャンルページで「直近の新刊」とみなす日数（今日からこの日数前まで）
const GENRE_RECENT_DAYS = 14;

function jstToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
function addDaysUTC(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function getClient() {
  if (useMock) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function getLatestBooks(
  onOrBefore: string,
  limit: number
): Promise<Book[]> {
  if (useMock) {
    return MOCK_BOOKS.filter(
      (b) => b.published_date <= onOrBefore && b.genre_id !== HOME_EXCLUDED_GENRE
    )
      .sort(
        (a, b) =>
          b.published_date.localeCompare(a.published_date) ||
          a.title.localeCompare(b.title, "ja")
      )
      .slice(0, limit);
  }

  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .lte("published_date", onOrBefore)
    .not("title", "ilike", "%写真集%")
    .not("title", "ilike", "%グラビア%")
    .not("title", "ilike", "%アイドル%")
    .neq("genre_id", HOME_EXCLUDED_GENRE)
    .order("published_date", { ascending: false })
    .order("title")
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBooksByDate(date: string): Promise<Book[]> {
  if (useMock) {
    return MOCK_BOOKS.filter(
      (b) => b.published_date === date && b.genre_id !== HOME_EXCLUDED_GENRE
    ).sort((a, b) =>
      a.title.localeCompare(b.title, "ja")
    );
  }

  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .eq("published_date", date)
    .not("title", "ilike", "%写真集%")
    .not("title", "ilike", "%グラビア%")
    .not("title", "ilike", "%アイドル%")
    .neq("genre_id", HOME_EXCLUDED_GENRE)
    .order("title");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBooksByGenre(genreId: string): Promise<Book[]> {
  // ジャンルページは「直近に出た新刊」だけを表示する（背景の古い本は出さない）
  const today = jstToday();
  const since = addDaysUTC(today, -GENRE_RECENT_DAYS);

  if (useMock) {
    return MOCK_BOOKS.filter(
      (b) =>
        b.genre_id === genreId &&
        b.published_date >= since &&
        b.published_date <= today
    ).sort((a, b) => b.published_date.localeCompare(a.published_date));
  }

  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .eq("genre_id", genreId)
    .gte("published_date", since)
    .lte("published_date", today)
    .not("title", "ilike", "%写真集%")
    .not("title", "ilike", "%グラビア%")
    .not("title", "ilike", "%アイドル%")
    .order("published_date", { ascending: false })
    .limit(120);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBooksByDateRange(
  from: string,
  to: string
): Promise<Book[]> {
  if (useMock) {
    return MOCK_BOOKS.filter(
      (b) =>
        b.published_date >= from &&
        b.published_date <= to &&
        b.genre_id !== HOME_EXCLUDED_GENRE
    ).sort((a, b) => a.published_date.localeCompare(b.published_date));
  }

  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .gte("published_date", from)
    .lte("published_date", to)
    .not("title", "ilike", "%写真集%")
    .not("title", "ilike", "%グラビア%")
    .not("title", "ilike", "%アイドル%")
    .neq("genre_id", HOME_EXCLUDED_GENRE)
    .order("published_date");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBookCountByDate(
  from: string,
  to: string
): Promise<Record<string, number>> {
  const books = await getBooksByDateRange(from, to);
  const counts: Record<string, number> = {};
  for (const b of books) {
    counts[b.published_date] = (counts[b.published_date] ?? 0) + 1;
  }
  return counts;
}

// 公開済みコラムを新しい順に取得する。
// "columns" テーブルはまだ存在しない可能性があるため、try/catchで握りつぶし、
// エラー時は空配列を返してページがクラッシュしないようにする
export async function getPublishedColumns(limit = 50): Promise<Column[]> {
  if (useMock) return [];

  try {
    const sb = await getClient();
    const { data, error } = await sb!
      .from("columns")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data ?? [];
  } catch {
    return [];
  }
}

// slug指定で公開済みコラムを1件取得する。見つからない・エラー時はnullを返す
export async function getColumnBySlug(slug: string): Promise<Column | null> {
  if (useMock) return null;

  try {
    const sb = await getClient();
    const { data, error } = await sb!
      .from("columns")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ?? null;
  } catch {
    return null;
  }
}
