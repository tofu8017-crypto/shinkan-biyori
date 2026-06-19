export const revalidate = 1800;

import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import GenreChips from "@/components/GenreChips";
import MonthCalendarSection from "@/components/MonthCalendarSection";
import { getBooksByGenre, getBooksByDateAndGenre, getBookCountByDate } from "@/lib/supabase";
import { GENRES } from "@/types/book";
import DateStrip from "@/components/DateStrip";
import { notFound } from "next/navigation";

function todayJST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
function todayLabelJP(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}月${d}日`;
}
function shiftDate(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const genre = GENRES.find((g) => g.id === id);

  if (!genre) {
    return { title: "ページが見つかりません", robots: { index: false, follow: false } };
  }

  const description = `${genre.label}の最新の新刊を発売日順にまとめてチェック。楽天ブックス・Amazonのリンク付き。`;

  return {
    title: `${genre.label}の新刊一覧`,
    description,
    alternates: {
      canonical: `/genre/${id}`,
    },
    openGraph: {
      title: `${genre.label}の新刊一覧｜新刊日和`,
      description,
      url: `https://shinkanbiyori.com/genre/${id}`,
      images: ["/hero.jpg"],
    },
  };
}

export default async function GenrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const genre = GENRES.find((g) => g.id === id);

  if (!genre) {
    notFound();
  }

  const today = todayJST();
  // TOPと同じ ±5日の日付バー用（その日「全体」の冊数。ジャンル別ではなく日付ナビ）
  const stripDates = Array.from({ length: 11 }, (_, i) => shiftDate(today, i - 5));
  const [todayBooks, books, stripCounts] = await Promise.all([
    getBooksByDateAndGenre(today, id),
    getBooksByGenre(id),
    getBookCountByDate(shiftDate(today, -5), shiftDate(today, 5)),
  ]);

  // パンくずの構造化データ：ホーム > ジャンル
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "ホーム",
        item: "https://shinkanbiyori.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: genre.label,
        item: `https://shinkanbiyori.com/genre/${id}`,
      },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
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
        </div>

        {/* 全ジャンルへの切替（現在のジャンルを強調） */}
        <GenreChips activeId={id} />

        {/* TOPと同じ横並びの日付バー（±5日）。クリックでその日の新刊一覧へ。 */}
        <DateStrip dates={stripDates} counts={stripCounts} activeDate={today} />

        {/* 本日発売（このジャンル）。発売がない日は下のカレンダーから別日へ。 */}
        <section className="mb-14">
          <div className="flex items-baseline gap-4 mb-6">
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "24px",
                fontWeight: 500,
                letterSpacing: "0.1em",
                color: "var(--text-main)",
                margin: 0,
              }}
            >
              本日発売（{todayLabelJP(today)}）
            </h2>
            <span className="font-bold" style={{ color: "var(--text-muted)" }}>
              {todayBooks.length}冊
            </span>
          </div>
          {todayBooks.length === 0 ? (
            <p className="py-4 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
              本日発売の{genre.label}はありません。下のカレンダーから発売日を選べます。
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: "18px",
              }}
            >
              {todayBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </section>

        {/* 発売日カレンダー（本日発売の直下に置き、戻らず別の日へ移動できる） */}
        <MonthCalendarSection />

        {/* 最近の新刊・近刊（検索流入を支える一覧。常設） */}
        <section>
          <div className="flex items-baseline gap-4 mb-6">
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "24px",
                fontWeight: 500,
                letterSpacing: "0.1em",
                color: "var(--text-main)",
                margin: 0,
              }}
            >
              最近の新刊・近刊
            </h2>
            <span className="font-bold" style={{ color: "var(--text-muted)" }}>
              {books.length}冊
            </span>
          </div>
          {books.length === 0 ? (
            <p className="py-4 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
              新刊・近刊は今のところありません。
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
        </section>
      </main>
    </div>
  );
}
