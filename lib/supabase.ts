import type { Book } from "@/types/book";
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
  if (useMock) {
    return MOCK_BOOKS.filter((b) => b.genre_id === genreId).sort((a, b) =>
      b.published_date.localeCompare(a.published_date)
    );
  }

  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .eq("genre_id", genreId)
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
