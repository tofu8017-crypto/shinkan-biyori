export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import MonthCalendarSection from "@/components/MonthCalendarSection";
import { searchBooks } from "@/lib/supabase";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  // 検索結果ページは無限に組み合わせが生まれるため、検索エンジンには登録させない
  return {
    title: query ? `「${query}」の検索結果` : "検索",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const books = query ? await searchBooks(query) : [];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="max-w-6xl mx-auto w-full px-4 py-14">
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
            {query ? `「${query}」の検索結果` : "検索"}
          </h1>
          {query && (
            <span className="font-bold" style={{ color: "var(--text-muted)" }}>
              {books.length}冊
            </span>
          )}
        </div>

        {!query ? (
          <p
            className="py-8 text-sm font-bold"
            style={{ color: "var(--text-muted)" }}
          >
            上の検索窓に、作家名や書名を入れて検索してください。
          </p>
        ) : books.length === 0 ? (
          <p
            className="py-8 text-sm font-bold"
            style={{ color: "var(--text-muted)" }}
          >
            「{query}」に一致する新刊は見つかりませんでした。表記を変えて試してみてください。
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

      {/* 発売日カレンダー（階層下ページでも最下部に表示） */}
      <MonthCalendarSection />
    </div>
  );
}
