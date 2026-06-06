export const dynamic = "force-dynamic";

import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import { getBooksByGenre } from "@/lib/supabase";
import { GENRES } from "@/types/book";

export default async function GenrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const genre = GENRES.find((g) => g.id === id);

  if (!genre) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="max-w-6xl mx-auto w-full px-4 py-14">
          <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            ジャンルが見つかりません
          </p>
        </main>
      </div>
    );
  }

  const books = await getBooksByGenre(id);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="max-w-6xl mx-auto w-full px-4 py-14">
        <div className="flex items-baseline gap-6 mb-8">
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "34px",
              fontWeight: 500,
              letterSpacing: "0.14em",
              color: "var(--text-main)",
              margin: 0,
            }}
          >
            {genre.label}
          </h1>
          <span className="font-bold" style={{ color: "var(--text-muted)" }}>
            全{books.length}冊
          </span>
        </div>

        {books.length === 0 ? (
          <p className="py-8 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            この分類の新刊データは現在収集中です。
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
    </div>
  );
}
