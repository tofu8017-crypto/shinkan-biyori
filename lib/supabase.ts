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

async function getClient() {
  if (useMock) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function getBooksByDate(date: string): Promise<Book[]> {
  if (useMock) {
    return MOCK_BOOKS.filter((b) => b.published_date === date).sort((a, b) =>
      a.title.localeCompare(b.title, "ja")
    );
  }

  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .eq("published_date", date)
    .order("title");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBooksByDateRange(
  from: string,
  to: string
): Promise<Book[]> {
  if (useMock) {
    return MOCK_BOOKS.filter(
      (b) => b.published_date >= from && b.published_date <= to
    ).sort((a, b) => a.published_date.localeCompare(b.published_date));
  }

  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .gte("published_date", from)
    .lte("published_date", to)
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
