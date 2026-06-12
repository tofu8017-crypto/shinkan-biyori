export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import JsonLd, { SITE_URL, breadcrumbJsonLd } from "@/components/JsonLd";
import { seriesSlug, detectSeries } from "@/lib/detect-series";
import { getSeriesBySlug } from "@/lib/supabase";

function formatDateJP(dateStr: string): string {
  const [y, m, dd] = dateStr.split("-").map(Number);
  return `${y}年${m}月${dd}日`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) {
    return { title: "ページが見つかりません", robots: { index: false, follow: false } };
  }
  const maxVol =
    series.books
      .map((b) => detectSeries(b.title)?.volume ?? 0)
      .reduce((a, b) => Math.max(a, b), 0) || series.books.length;
  const description = `『${series.base}』シリーズの最新刊・続刊情報。現在${maxVol}巻まで発売中。発売日順にまとめています。｜新刊日和`;
  return {
    title: `${series.base} 最新刊・続刊情報（${maxVol}巻まで発売中）`,
    description,
    alternates: { canonical: `/series/${seriesSlug(series.base)}` },
    openGraph: {
      title: `${series.base} 最新刊情報｜新刊日和`,
      description,
      url: `${SITE_URL}/series/${seriesSlug(series.base)}`,
      images: ["/hero.jpg"],
    },
  };
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) notFound();

  // 巻数降順で「最新刊」を特定する
  const withVol = series.books.map((b) => ({
    book: b,
    volume: detectSeries(b.title)?.volume ?? 0,
  }));
  const maxVol = withVol.reduce((a, x) => Math.max(a, x.volume), 0) || series.books.length;
  const latest = [...withVol].sort((a, b) => b.volume - a.volume)[0]?.book;
  const lead = latest
    ? `『${series.base}』の最新刊は${maxVol}巻（${formatDateJP(latest.published_date)}発売）です。`
    : `『${series.base}』シリーズの巻一覧です。`;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${series.base} シリーズ`,
    itemListElement: series.books.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/books/${b.isbn13}`,
      name: b.title,
    })),
  };
  const seriesJsonLd = {
    "@context": "https://schema.org",
    "@type": "BookSeries",
    name: series.base,
    url: `${SITE_URL}/series/${seriesSlug(series.base)}`,
  };
  const crumbs = breadcrumbJsonLd([
    { name: "ホーム", path: "" },
    { name: `${series.base}`, path: `/series/${seriesSlug(series.base)}` },
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <JsonLd data={[seriesJsonLd, itemListJsonLd, crumbs]} />
      <SiteHeader />

      <main className="max-w-6xl mx-auto w-full px-4 py-14">
        <nav className="text-xs font-bold mb-6" style={{ color: "var(--text-muted)" }}>
          <Link href="/" style={{ color: "inherit" }}>ホーム</Link>
        </nav>

        <div className="mb-8">
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "32px",
              fontWeight: 500,
              letterSpacing: "0.12em",
              color: "var(--text-main)",
              margin: "0 0 12px",
            }}
          >
            『{series.base}』シリーズ
          </h1>
          <p
            className="text-sm font-bold leading-relaxed"
            style={{ color: "var(--text-sub)" }}
          >
            {lead}
          </p>
          <p className="text-xs font-bold mt-2" style={{ color: "var(--text-muted)" }}>
            把握している巻: {series.books.length}冊
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: "18px",
          }}
        >
          {series.books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </main>
    </div>
  );
}
