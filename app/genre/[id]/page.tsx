export const revalidate = 1800;

import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import GenreChips from "@/components/GenreChips";
import { getBooksByGenre } from "@/lib/supabase";
import { GENRES } from "@/types/book";
import { notFound } from "next/navigation";

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

  const books = await getBooksByGenre(id);

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
          <span className="font-bold" style={{ color: "var(--text-muted)" }}>
            新刊・近刊 {books.length}冊
          </span>
        </div>

        {/* 全ジャンルへの切替（現在のジャンルを強調） */}
        <GenreChips activeId={id} />

        {books.length === 0 ? (
          <p className="py-8 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
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
      </main>
    </div>
  );
}
