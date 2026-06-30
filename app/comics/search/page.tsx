export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import BookCard from "@/components/BookCard";
import ComicHeader from "@/components/ComicHeader";
import ComicCalendarSection from "@/components/ComicCalendarSection";
import { searchBooks } from "@/lib/supabase";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  return {
    title: query ? `「${query}」の検索結果（コミック）` : "コミック検索",
    robots: { index: false, follow: true },
  };
}

export default async function ComicSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  // コミック検索なのでDB側でコミック(genre_id=001001)に絞り、楽天補完もスキップする。
  // （全書籍を舐めるとWorkerのリソース上限超過=Error 1102 になるため）
  const books = query
    ? await searchBooks(query, 200, { genreId: "001001", skipRakuten: true })
    : [];

  return (
    <div className="comic-theme min-h-screen flex flex-col">
      <ComicHeader />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-14">
        <div className="flex items-baseline gap-6 mb-8">
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "30px",
              fontWeight: 500,
              letterSpacing: "0.12em",
              color: "var(--text-main)",
              margin: 0,
            }}
          >
            {query ? `「${query}」の検索結果` : "コミック検索"}
          </h1>
          {query && (
            <span className="font-bold" style={{ color: "var(--text-muted)" }}>
              {books.length}冊
            </span>
          )}
        </div>

        {!query ? (
          <p className="py-8 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            上の検索窓に、作家名や書名を入れて検索してください。
          </p>
        ) : books.length === 0 ? (
          <p className="py-8 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            「{query}」に一致する本は見つかりませんでした。表記を変えて試してみてください。
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: "18px",
            }}
          >
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </main>

      {/* 発売日カレンダー（コミック版・常設） */}
      <ComicCalendarSection />
    </div>
  );
}
