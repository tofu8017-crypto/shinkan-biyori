export const revalidate = 86400;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import JsonLd, { SITE_URL, breadcrumbJsonLd } from "@/components/JsonLd";
import { GENRES } from "@/types/book";
import { getBooksByMonth } from "@/lib/supabase";

function isValidYearMonth(s: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(s)) return false;
  const m = Number(s.split("-")[1]);
  return m >= 1 && m <= 12;
}

function labelJP(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  return `${y}年${m}月`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ yyyymm: string; genreId: string }>;
}): Promise<Metadata> {
  const { yyyymm, genreId } = await params;
  const genre = GENRES.find((g) => g.id === genreId);
  if (!isValidYearMonth(yyyymm) || !genre) {
    return { title: "ページが見つかりません", robots: { index: false, follow: false } };
  }
  const label = labelJP(yyyymm);
  const description = `${label}に発売される${genre.label}の新刊一覧。発売日順にまとめています。楽天ブックス・Amazonのリンク付き。｜新刊日和`;
  return {
    title: `${label}の${genre.label}新刊一覧｜発売日順`,
    description,
    alternates: { canonical: `/calendar/${yyyymm}/${genreId}` },
    openGraph: {
      title: `${label}の${genre.label}新刊｜新刊日和`,
      description,
      url: `${SITE_URL}/calendar/${yyyymm}/${genreId}`,
      images: ["/hero.jpg"],
    },
  };
}

export default async function CalendarGenrePage({
  params,
}: {
  params: Promise<{ yyyymm: string; genreId: string }>;
}) {
  const { yyyymm, genreId } = await params;
  const genre = GENRES.find((g) => g.id === genreId);
  if (!isValidYearMonth(yyyymm) || !genre) notFound();

  const label = labelJP(yyyymm);
  const books = await getBooksByMonth(yyyymm, genreId);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${label}の${genre.label}新刊`,
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
    { name: genre.label, path: `/calendar/${yyyymm}/${genreId}` },
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <JsonLd data={[itemListJsonLd, crumbs]} />
      <SiteHeader />

      <main className="max-w-6xl mx-auto w-full px-4 py-14">
        <nav className="text-xs font-bold mb-6" style={{ color: "var(--text-muted)" }}>
          <Link href="/" style={{ color: "inherit" }}>ホーム</Link>
          {" ／ "}
          <Link href={`/calendar/${yyyymm}`} style={{ color: "inherit" }}>
            {label}の新刊
          </Link>
        </nav>

        <div className="mb-8">
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "32px",
              fontWeight: 500,
              letterSpacing: "0.12em",
              color: "var(--text-main)",
              margin: "0 0 6px",
            }}
          >
            {label}の{genre.label}新刊
          </h1>
          <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            全{books.length}冊
          </p>
        </div>

        {books.length === 0 ? (
          <p className="py-8 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            この条件の新刊データは現在収集中です。
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
