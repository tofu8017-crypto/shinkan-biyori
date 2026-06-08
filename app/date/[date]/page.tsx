export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import { getBooksByDate } from "@/lib/supabase";
import { notFound } from "next/navigation";

function formatDateJP(dateStr: string) {
  // dateStrは "YYYY-MM-DD"。サーバーのTZに依存しないよう、曜日はUTC基準で算出し、
  // 月日は文字列から直接組み立てる（getDate/getDay等のローカル時刻ゲッターは使わない）
  const [y, m, dd] = dateStr.split("-").map(Number);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const dow = days[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  return {
    mmdd: `${m}/${dd}`,
    dow,
    full: `${y}年${m}月${dd}日（${dow}）`,
  };
}

// "YYYY-MM-DD" 形式かつ実在する日付かを検証（不正なURLは404にするため）
function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDateStr(date)) {
    return { title: "ページが見つかりません", robots: { index: false, follow: false } };
  }
  const fmt = formatDateJP(date);
  const description = `${fmt.full}に発売された文芸書の新刊一覧。楽天ブックス・Amazonのリンク付き。`;

  return {
    title: `${fmt.full}の新刊`,
    description,
    alternates: {
      canonical: `/date/${date}`,
    },
    openGraph: {
      title: `${fmt.full}の新刊｜新刊日和`,
      description,
      url: `https://shinkanbiyori.com/date/${date}`,
      images: ["/hero.jpg"],
    },
  };
}

export default async function DatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidDateStr(date)) notFound();
  const fmt = formatDateJP(date);
  const books = await getBooksByDate(date);

  // パンくずの構造化データ：ホーム > 日付ページ
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
        name: `${fmt.full}の新刊`,
        item: `https://shinkanbiyori.com/date/${date}`,
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
        <div className="mb-8">
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "34px",
              fontWeight: 500,
              letterSpacing: "0.14em",
              color: "var(--text-main)",
              margin: "0 0 4px",
            }}
          >
            {fmt.full}の新刊
          </h1>
          <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            全{books.length}冊
          </p>
        </div>

        {books.length === 0 ? (
          <p className="py-8 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            この日の新刊データは現在収集中です。
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
