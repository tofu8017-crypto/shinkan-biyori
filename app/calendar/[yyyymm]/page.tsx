export const revalidate = 86400;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import MonthCalendar from "@/components/MonthCalendar";
import JsonLd, { SITE_URL, breadcrumbJsonLd } from "@/components/JsonLd";
import { GENRES } from "@/types/book";
import type { Book } from "@/types/book";
import { getBooksByMonth } from "@/lib/supabase";

// "YYYY-MM" の妥当性チェック
function isValidYearMonth(s: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(s)) return false;
  const m = Number(s.split("-")[1]);
  return m >= 1 && m <= 12;
}

function labelJP(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  return `${y}年${m}月`;
}

// 前月・翌月の "YYYY-MM" を返す
function shiftMonth(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ yyyymm: string }>;
}): Promise<Metadata> {
  const { yyyymm } = await params;
  if (!isValidYearMonth(yyyymm)) {
    return { title: "ページが見つかりません", robots: { index: false, follow: false } };
  }
  const label = labelJP(yyyymm);
  const description = `${label}に発売される文芸書（小説・ミステリー・SF/ホラー・エッセイ）の新刊一覧。ジャンル別にまとめています。｜新刊日和`;
  return {
    title: `${label}の文芸新刊一覧｜発売日順`,
    description,
    alternates: { canonical: `/calendar/${yyyymm}` },
    openGraph: {
      title: `${label}の文芸新刊一覧｜新刊日和`,
      description,
      url: `${SITE_URL}/calendar/${yyyymm}`,
      images: ["/hero.jpg"],
    },
  };
}

export default async function CalendarMonthPage({
  params,
}: {
  params: Promise<{ yyyymm: string }>;
}) {
  const { yyyymm } = await params;
  if (!isValidYearMonth(yyyymm)) notFound();

  const label = labelJP(yyyymm);
  const books = await getBooksByMonth(yyyymm);
  const prev = shiftMonth(yyyymm, -1);
  const next = shiftMonth(yyyymm, 1);

  // ジャンルごとに仕分け（GENRESの並び順を維持。ビジネスは母集団から除外済み）
  const byGenre = GENRES.filter((g) => g.id !== "001006").map((g) => ({
    genre: g,
    items: books.filter((b) => b.genre_id === g.id),
  }));

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${label}の文芸新刊`,
    itemListElement: books.slice(0, 50).map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/books/${b.isbn13}`,
      name: b.title,
    })),
  };
  const crumbs = breadcrumbJsonLd([
    { name: "ホーム", path: "" },
    { name: `${label}の新刊`, path: `/calendar/${yyyymm}` },
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <JsonLd data={[itemListJsonLd, crumbs]} />
      <SiteHeader />

      <main className="max-w-6xl mx-auto w-full px-4 py-14">
        {/* 前月・翌月ナビ */}
        <div className="flex justify-between text-sm font-bold mb-6" style={{ color: "var(--highlight)" }}>
          <Link href={`/calendar/${prev}`} style={{ color: "inherit", textDecoration: "none" }}>
            ← {labelJP(prev)}
          </Link>
          <Link href={`/calendar/${next}`} style={{ color: "inherit", textDecoration: "none" }}>
            {labelJP(next)} →
          </Link>
        </div>

        <div className="mb-8">
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "34px",
              fontWeight: 500,
              letterSpacing: "0.14em",
              color: "var(--text-main)",
              margin: "0 0 6px",
            }}
          >
            {label}の文芸新刊
          </h1>
          <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            全{books.length}冊
          </p>
        </div>

        {/* 月間カレンダー（発売がある日に冊数表示・クリックで日付ページへ） */}
        <div className="max-w-md mx-auto mb-12">
          <MonthCalendar
            yyyymm={yyyymm}
            counts={books.reduce<Record<string, number>>((acc, b) => {
              acc[b.published_date] = (acc[b.published_date] ?? 0) + 1;
              return acc;
            }, {})}
            today={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" })}
          />
        </div>

        {/* ジャンル絞り込みリンク */}
        <div className="flex flex-wrap gap-2 mb-10">
          {byGenre.map(({ genre, items }) =>
            items.length === 0 ? null : (
              <Link
                key={genre.id}
                href={`/calendar/${yyyymm}/${genre.id}`}
                className="text-xs font-bold"
                style={{
                  borderRadius: "999px",
                  background: (genre.color ?? "#E8C4B8") + "44",
                  color: "var(--text-sub)",
                  padding: "4px 14px",
                  textDecoration: "none",
                }}
              >
                {genre.label}（{items.length}）
              </Link>
            )
          )}
        </div>

        {books.length === 0 ? (
          <p className="py-8 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            この月の新刊データは現在収集中です。
          </p>
        ) : (
          byGenre.map(({ genre, items }) =>
            items.length === 0 ? null : (
              <GenreSection key={genre.id} label={genre.label} items={items} />
            )
          )
        )}
      </main>
    </div>
  );
}

function GenreSection({ label, items }: { label: string; items: Book[] }) {
  return (
    <section className="mb-14">
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "20px",
          fontWeight: 500,
          letterSpacing: "0.1em",
          margin: "0 0 16px",
          color: "var(--text-main)",
        }}
      >
        {label}（{items.length}冊）
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "18px",
        }}
      >
        {items.map((b) => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>
    </section>
  );
}
