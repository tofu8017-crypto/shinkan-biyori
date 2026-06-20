export const revalidate = 86400;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import MonthCalendarSection from "@/components/MonthCalendarSection";
import JsonLd, { SITE_URL, breadcrumbJsonLd } from "@/components/JsonLd";
import { GENRES } from "@/types/book";
import { amazonUrl } from "@/lib/amazon";
import { ebookjapanUrl } from "@/lib/ebookjapan";
import { splitAuthors, authorSlug } from "@/lib/normalize-author";
import { hiResCover } from "@/lib/cover";
import {
  getBookByIsbn,
  getBooksBySameAuthor,
  getBooksSameDay,
} from "@/lib/supabase";

function isValidIsbn(s: string): boolean {
  return /^\d{13}$/.test(s);
}

function formatDateJP(dateStr: string): string {
  const [y, m, dd] = dateStr.split("-").map(Number);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const dow = days[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  return `${y}年${m}月${dd}日（${dow}）`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ isbn: string }>;
}): Promise<Metadata> {
  const { isbn } = await params;
  if (!isValidIsbn(isbn)) {
    return { title: "ページが見つかりません", robots: { index: false, follow: false } };
  }
  const book = await getBookByIsbn(isbn);
  if (!book) {
    return { title: "ページが見つかりません", robots: { index: false, follow: false } };
  }

  const pub = formatDateJP(book.published_date);
  const summary = book.description?.slice(0, 100) ?? `${book.author}の文芸書`;
  const description = `『${book.title}』（${book.author}／${book.publisher}）は${pub}発売。${summary}`;

  return {
    title: `${book.title} の発売日・あらすじ`,
    description,
    alternates: { canonical: `/books/${isbn}` },
    openGraph: {
      title: `${book.title}｜新刊日和`,
      description,
      url: `${SITE_URL}/books/${isbn}`,
      images: [book.image_url ?? "/hero.jpg"],
    },
  };
}

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ isbn: string }>;
}) {
  const { isbn } = await params;
  if (!isValidIsbn(isbn)) notFound();
  const book = await getBookByIsbn(isbn);
  if (!book) notFound();

  const genre = GENRES.find((g) => g.id === book.genre_id);
  const authors = splitAuthors(book.author);
  const pub = formatDateJP(book.published_date);
  const azUrl = amazonUrl(book);
  const ebjUrl = ebookjapanUrl(book); // 提携設定が無ければ null＝ボタン非表示

  const [sameAuthor, sameDay] = await Promise.all([
    getBooksBySameAuthor(book, 6),
    getBooksSameDay(book, 6),
  ]);

  // 構造化データ: Book + BreadcrumbList
  const bookJsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: authors.map((a) => ({ "@type": "Person", name: a })),
    isbn: book.isbn13,
    datePublished: book.published_date,
    publisher: { "@type": "Organization", name: book.publisher },
    inLanguage: "ja",
    ...(book.image_url ? { image: book.image_url } : {}),
    ...(book.description ? { description: book.description } : {}),
    url: `${SITE_URL}/books/${book.isbn13}`,
  };
  const crumbs = breadcrumbJsonLd([
    { name: "ホーム", path: "" },
    { name: `${pub}の新刊`, path: `/date/${book.published_date}` },
    { name: book.title, path: `/books/${book.isbn13}` },
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <JsonLd data={[bookJsonLd, crumbs]} />
      <SiteHeader />

      <main className="max-w-5xl mx-auto w-full px-4 py-12">
        {/* パンくず（表示用） */}
        <nav className="text-xs font-bold mb-6" style={{ color: "var(--text-muted)" }}>
          <Link href="/" style={{ color: "inherit" }}>ホーム</Link>
          {" ／ "}
          <Link href={`/date/${book.published_date}`} style={{ color: "inherit" }}>
            {pub}の新刊
          </Link>
        </nav>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(180px, 260px) 1fr",
            gap: "36px",
            alignItems: "start",
          }}
          className="book-detail-grid"
        >
          {/* 書影 */}
          <div
            style={{
              borderRadius: "6px",
              overflow: "hidden",
              boxShadow: "0 12px 28px rgba(61,53,48,0.16)",
            }}
          >
            {book.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={hiResCover(book.image_url, 600) ?? undefined}
                alt={book.title}
                className="w-full object-cover"
                style={{ aspectRatio: "3/4" }}
              />
            ) : (
              <div
                className="w-full flex items-end p-5"
                style={{
                  aspectRatio: "3/4",
                  background: genre?.color
                    ? `linear-gradient(145deg, ${genre.color}, ${genre.color}aa)`
                    : "linear-gradient(145deg,#ede8e0,#d4ccc4)",
                  fontFamily: "var(--font-serif)",
                  color: "rgba(61,53,48,0.78)",
                }}
              >
                {book.title}
              </div>
            )}
          </div>

          {/* 書誌情報 */}
          <div>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "30px",
                fontWeight: 500,
                lineHeight: 1.5,
                letterSpacing: "0.04em",
                margin: "0 0 14px",
                color: "var(--text-main)",
              }}
            >
              {book.title}
            </h1>

            {/* 著者（著者ページへの内部リンク） */}
            <div className="text-sm font-bold mb-4" style={{ color: "var(--text-muted)" }}>
              {authors.map((a, i) => (
                <span key={a}>
                  {i > 0 && "／"}
                  <Link
                    href={`/authors/${authorSlug(a)}`}
                    style={{ color: "var(--highlight)", textDecoration: "none" }}
                  >
                    {a}
                  </Link>
                </span>
              ))}
            </div>

            {genre && (
              <span
                className="inline-block text-xs font-bold mb-5"
                style={{
                  borderRadius: "999px",
                  background: (genre.color ?? "#E8C4B8") + "44",
                  color: "var(--text-sub)",
                  padding: "3px 14px",
                }}
              >
                {genre.label}
              </span>
            )}

            <dl
              className="text-sm font-bold mb-6"
              style={{
                color: "var(--text-sub)",
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "8px 18px",
              }}
            >
              <dt style={{ color: "var(--text-muted)" }}>発売日</dt>
              <dd style={{ margin: 0 }}>{pub}</dd>
              <dt style={{ color: "var(--text-muted)" }}>出版社</dt>
              <dd style={{ margin: 0 }}>{book.publisher}</dd>
              <dt style={{ color: "var(--text-muted)" }}>ISBN</dt>
              <dd style={{ margin: 0 }}>{book.isbn13}</dd>
            </dl>

            {book.description && (
              <div className="mb-7">
                <h2
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "16px",
                    fontWeight: 600,
                    margin: "0 0 8px",
                    color: "var(--text-main)",
                  }}
                >
                  どんな本？
                </h2>
                <p
                  className="text-sm font-bold leading-relaxed"
                  style={{ color: "var(--text-sub)" }}
                >
                  {book.description}
                </p>
              </div>
            )}

            {/* 購入ボタン */}
            <div className="flex gap-3">
              {book.rakuten_url && (
                <a
                  href={book.rakuten_url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="text-sm font-bold rounded-full px-7 py-3 transition-opacity hover:opacity-80"
                  style={{ background: "#111", color: "#fff", textDecoration: "none" }}
                >
                  楽天ブックスで見る
                </a>
              )}
              {ebjUrl && (
                <a
                  href={ebjUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="text-sm font-bold rounded-full px-7 py-3 transition-opacity hover:opacity-80"
                  style={{ background: "#D7000F", color: "#fff", textDecoration: "none" }}
                >
                  ebookjapanで見る
                </a>
              )}
              <a
                href={azUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="text-sm font-bold rounded-full px-7 py-3 transition-opacity hover:opacity-80"
                style={{ background: "#ED8A22", color: "#fff", textDecoration: "none" }}
              >
                Amazonで見る
              </a>
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              ※最新の価格・在庫は各販売サイトでご確認ください。
            </p>
          </div>
        </div>

        {/* 同じ著者の新刊 */}
        {sameAuthor.length > 0 && (
          <RelatedSection title={`${authors[0]}の他の新刊`} books={sameAuthor} />
        )}

        {/* 同日発売 */}
        {sameDay.length > 0 && (
          <RelatedSection title={`${pub}に発売されたほかの本`} books={sameDay} />
        )}
      </main>

      {/* 発売日カレンダー（階層下ページでも最下部に表示） */}
      <MonthCalendarSection />
    </div>
  );
}

function RelatedSection({
  title,
  books,
}: {
  title: string;
  books: import("@/types/book").Book[];
}) {
  return (
    <section className="mt-14">
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "20px",
          fontWeight: 500,
          letterSpacing: "0.1em",
          margin: "0 0 18px",
          color: "var(--text-main)",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "18px",
        }}
      >
        {books.map((b) => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>
    </section>
  );
}
