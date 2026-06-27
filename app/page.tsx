export const revalidate = 3600;

import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import Link from "next/link";
import { getBooksByDate, getBookCountByDate } from "@/lib/supabase";
import BookCard from "@/components/BookCard";
import GenreChips from "@/components/GenreChips";
import DateStripScroller from "@/components/DateStripScroller";
import MonthCalendarSection from "@/components/MonthCalendarSection";

function todayJST(): string {
  // en-CAロケールは "YYYY-MM-DD" 形式を返す。timeZone指定で日本の暦日を正しく取得する
  // （toLocaleString→new Date→toISOStringの二重変換はサーバーのTZ次第で1日ずれるため避ける）
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

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

// "YYYY-MM-DD" を n日ずらす（UTC基準）。日付ストリップ用。
function shiftDate(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// トップの本体。日付ページと同じ「日付見出し＋前後日付ストリップ＋ジャンル絞り込み」を、
// 今日の日付で表示する。実用重視のため装飾ヒーローは置かない。
async function TodaySection() {
  const today = todayJST();
  const fmt = formatDateJP(today);
  const books = await getBooksByDate(today);

  // 前後5日分の日付と冊数（カレンダーに戻らず行き来できる帯ナビ）
  const stripStart = shiftDate(today, -5);
  const stripEnd = shiftDate(today, 5);
  const counts = await getBookCountByDate(stripStart, stripEnd);
  const stripDates = Array.from({ length: 11 }, (_, i) => shiftDate(stripStart, i));

  return (
    <>
      <div className="mb-6">
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

      {/* 前後の日付ストリップ（±5日。クリックでその日の新刊一覧へ）。
          スマホでは本日が中央に来るよう自動スクロールする。 */}
      <DateStripScroller
        className="flex items-stretch gap-2 mb-8 overflow-x-auto"
        style={{ paddingBottom: "4px" }}
      >
        {stripDates.map((d) => {
          const f = formatDateJP(d);
          const c = counts[d] ?? 0;
          const isCur = d === today;
          return (
            <Link
              key={d}
              href={isCur ? "/" : `/date/${d}`}
              data-active={isCur ? "true" : undefined}
              className="flex flex-col items-center justify-center flex-shrink-0"
              style={{
                width: "60px",
                padding: "8px 0",
                borderRadius: "10px",
                textDecoration: "none",
                background: isCur ? "var(--highlight)" : c > 0 ? "var(--accent-sage)" : "var(--bg-subtle)",
                color: isCur ? "#fff" : "var(--text-main)",
                opacity: c > 0 || isCur ? 1 : 0.5,
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 700, lineHeight: 1.1 }}>{f.mmdd}</span>
              <span style={{ fontSize: "10px" }}>{f.dow}</span>
              <span style={{ fontSize: "10px", fontWeight: 700, marginTop: "3px" }}>
                {c > 0 ? `${c}冊` : "—"}
              </span>
            </Link>
          );
        })}
      </DateStripScroller>

      {/* 全ジャンルへの導線（クリックで各ジャンルページへ） */}
      <GenreChips activeId="all" />

      {books.length === 0 ? (
        <p className="py-8 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
          本日の新刊データは現在収集中です。明朝9時に更新されます。
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
    </>
  );
}


export default async function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-14" id="today">
        <Suspense
          fallback={
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ borderRadius: "9px", background: "var(--bg-subtle)", aspectRatio: "3/5" }} className="animate-pulse" />
              ))}
            </div>
          }
        >
          <TodaySection />
        </Suspense>
      </main>

      {/* 発売日カレンダー（ページ最下部） */}
      <MonthCalendarSection />
      {/* フッターは全ページ共通の <SiteFooter />（app/layout.tsx）に統一 */}
    </div>
  );
}
