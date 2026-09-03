export const revalidate = 86400;

import type { Metadata } from "next";
import Link from "next/link";
import BookCard from "@/components/BookCard";
import ComicHeader from "@/components/ComicHeader";
import DateStrip from "@/components/DateStrip";
import ComicCalendarSection from "@/components/ComicCalendarSection";
import { getComicsByDate, getComicCountByDate, getLatestComics } from "@/lib/supabase";
import { notFound } from "next/navigation";

function formatDateJP(dateStr: string) {
  const [y, m, dd] = dateStr.split("-").map(Number);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const dow = days[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  return { full: `${y}年${m}月${dd}日（${dow}）` };
}
function shiftDate(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDateStr(date)) {
    return { title: "ページが見つかりません", robots: { index: false, follow: false } };
  }
  const fmt = formatDateJP(date);
  // 検索結果で中身が見えるよう、実際の冊数と代表作をタイトル/説明に入れる。
  // 上位表示なのにCTRがほぼ0だったため（2026-09-03のGSC分析）。
  const books = await getComicsByDate(date); // cache()済みなので本体と合わせて1クエリ
  // 書名は合計60字までで打ち切る（長い書名でdescriptionが検索結果の表示上限を超えないように）
  const titles = books
    .slice(0, 3)
    .map((b) => `『${b.title}』`)
    .reduce((acc, t) => ((acc + t).length > 60 ? acc : acc + t), "");
  return {
    title: books.length
      ? `${fmt.full}発売の新刊コミック${books.length}冊`
      : `${fmt.full}の新刊コミック`,
    description: books.length
      ? `${fmt.full}に発売されたコミック・マンガの新刊${books.length}冊を一覧でまとめました。${titles ? `${titles}ほか。` : ""}書影・楽天ブックス/Amazonのリンク付き。`
      : `${fmt.full}に発売された新刊コミックはありません。直近に発売されたコミック・マンガの新刊をまとめています。書影・楽天ブックス/Amazonのリンク付き。`,
    alternates: { canonical: `/comics/date/${date}` },
  };
}

export default async function ComicDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDateStr(date)) notFound();

  const fmt = formatDateJP(date);
  const prev = shiftDate(date, -1);
  const next = shiftDate(date, 1);
  // ±5日の日付バー（表示中の日を中央に）。コミックの発売数で色付け。
  const stripDates = Array.from({ length: 11 }, (_, i) => shiftDate(date, i - 5));
  const [books, stripCounts] = await Promise.all([
    getComicsByDate(date),
    getComicCountByDate(shiftDate(date, -5), shiftDate(date, 5)),
  ]);
  // 発売0冊の日にも検索流入がある（2026-08-13は21クリック）。空ページで帰さず、
  // その日以前の直近の新刊を代わりに出す。
  const fallback = books.length === 0 ? await getLatestComics(date, 12) : [];

  return (
    <div className="comic-theme min-h-screen flex flex-col">
      <ComicHeader />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12">
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "34px", fontWeight: 500, letterSpacing: "0.14em", color: "var(--text-main)", margin: "0 0 4px" }}>
          {fmt.full}の新刊コミック
        </h1>
        <p className="text-sm font-bold mb-6" style={{ color: "var(--text-muted)" }}>
          全{books.length}冊
        </p>

        {/* TOPと同じ横並びの日付バー（±5日。表示中の日が中央） */}
        <DateStrip dates={stripDates} counts={stripCounts} activeDate={date} hrefBase="/comics/date" />

        {books.length === 0 ? (
          <>
            <p className="py-8 text-sm" style={{ color: "var(--text-muted)" }}>
              この日の新刊コミックはありません。
              {fallback.length > 0 && "直近に発売された新刊コミックをご紹介します。"}
            </p>
            {fallback.length > 0 && (
              <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                {fallback.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}

        {/* 前日・翌日ナビ */}
        <div className="flex items-center justify-between mt-12 text-sm font-bold" style={{ color: "var(--highlight)" }}>
          <Link href={`/comics/date/${prev}`} style={{ color: "inherit", textDecoration: "none" }}>← 前日</Link>
          <Link href={`/comics/date/${next}`} style={{ color: "inherit", textDecoration: "none" }}>翌日 →</Link>
        </div>
      </main>

      {/* 発売日カレンダー（戻らず別の日へ行けるよう常設） */}
      <ComicCalendarSection />

      <footer className="text-center border-t mt-8" style={{ background: "var(--bg-subtle)", padding: "48px 0 36px", borderColor: "var(--border)" }}>
        <p className="font-bold" style={{ color: "var(--text-muted)" }}>新刊日和 COMIC — 毎日更新の新刊コミックカレンダー</p>
      </footer>
    </div>
  );
}
