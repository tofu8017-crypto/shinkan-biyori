export const revalidate = 1800;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import MonthCalendarSection from "@/components/MonthCalendarSection";
import JsonLd, { SITE_URL, breadcrumbJsonLd } from "@/components/JsonLd";
import { decodeAuthorSlug, authorSlug } from "@/lib/normalize-author";
import { getBooksByAuthor } from "@/lib/supabase";

function formatDateJP(dateStr: string): string {
  const [y, m, dd] = dateStr.split("-").map(Number);
  return `${y}年${m}月${dd}日`;
}

// 今日（JST）。未来発売＝近刊判定に使う。
function jstToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = decodeAuthorSlug(slug);
  const books = await getBooksByAuthor(name);
  if (books.length === 0) {
    return { title: "ページが見つかりません", robots: { index: false, follow: false } };
  }

  const description = `${name}の新刊・最新刊の一覧。発売日順にまとめています。楽天ブックス・Amazonのリンク付き。｜新刊日和`;
  return {
    title: `${name}の新刊一覧・最新刊【2026年最新】`,
    description,
    alternates: { canonical: `/authors/${authorSlug(name)}` },
    openGraph: {
      title: `${name}の新刊一覧｜新刊日和`,
      description,
      url: `${SITE_URL}/authors/${authorSlug(name)}`,
      images: ["/hero.jpg"],
    },
  };
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const name = decodeAuthorSlug(slug);
  const books = await getBooksByAuthor(name);
  if (books.length === 0) notFound();

  const today = jstToday();
  // 冒頭の強調スニペット用：未来日（近刊）の最も近いものを「次の新刊」とする。
  // 無ければ直近に出た最新刊。
  const upcoming = [...books]
    .filter((b) => b.published_date > today)
    .sort((a, b) => a.published_date.localeCompare(b.published_date))[0];
  const latest = books[0]; // すでに発売日降順
  const lead = upcoming
    ? `${name}の次の新刊は${formatDateJP(upcoming.published_date)}発売の『${upcoming.title}』です。`
    : `${name}の最新刊は${formatDateJP(latest.published_date)}発売の『${latest.title}』です。`;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${name}の新刊一覧`,
    itemListElement: books.slice(0, 30).map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/books/${b.isbn13}`,
      name: b.title,
    })),
  };
  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    url: `${SITE_URL}/authors/${authorSlug(name)}`,
  };
  const crumbs = breadcrumbJsonLd([
    { name: "ホーム", path: "" },
    { name: `${name}の新刊`, path: `/authors/${authorSlug(name)}` },
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <JsonLd data={[personJsonLd, itemListJsonLd, crumbs]} />
      <SiteHeader />

      <main className="max-w-6xl mx-auto w-full px-4 py-14">
        <nav className="text-xs font-bold mb-6" style={{ color: "var(--text-muted)" }}>
          <Link href="/" style={{ color: "inherit" }}>ホーム</Link>
        </nav>

        <div className="mb-8">
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "34px",
              fontWeight: 500,
              letterSpacing: "0.14em",
              color: "var(--text-main)",
              margin: "0 0 12px",
            }}
          >
            {name}の新刊
          </h1>
          <p
            className="text-sm font-bold leading-relaxed"
            style={{ color: "var(--text-sub)" }}
          >
            {lead}
          </p>
          <p className="text-xs font-bold mt-2" style={{ color: "var(--text-muted)" }}>
            全{books.length}冊
          </p>
        </div>

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
      </main>

      {/* 発売日カレンダー（階層下ページでも最下部に表示） */}
      <MonthCalendarSection />
    </div>
  );
}
