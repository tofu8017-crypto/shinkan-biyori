export const revalidate = 3600;

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import BookCard from "@/components/BookCard";
import MonthCalendar from "@/components/MonthCalendar";
import ComicHeader from "@/components/ComicHeader";
import DateStripScroller from "@/components/DateStripScroller";
import { getComicsByDate, getComicCountByDate } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "コミック版 — 新刊コミックカレンダー",
  description: "今日発売のコミック・マンガを毎日まとめ。Amazon・楽天のリンク付き。",
  alternates: { canonical: "/comics" },
};

function todayJST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
function formatDateJP(dateStr: string) {
  const [y, m, dd] = dateStr.split("-").map(Number);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const dow = days[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  return { mmdd: `${m}/${dd}`, dow, full: `${y}年${m}月${dd}日（${dow}）` };
}
function shiftDate(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function shiftMonth(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  return `${y}年${m}月`;
}
function monthRange(yyyymm: string): { from: string; to: string } {
  const [y, m] = yyyymm.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${yyyymm}-01`, to: `${yyyymm}-${String(last).padStart(2, "0")}` };
}

// トップ本体（文芸版TodaySectionのコミック版）。日付見出し＋前後日付ストリップ＋今日のコミック。
async function TodaysComicsSection() {
  const today = todayJST();
  const fmt = formatDateJP(today);
  const books = await getComicsByDate(today);

  const stripStart = shiftDate(today, -5);
  const stripEnd = shiftDate(today, 5);
  const counts = await getComicCountByDate(stripStart, stripEnd);
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
          {fmt.full}の新刊コミック
        </h1>
        <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
          全{books.length}冊
        </p>
      </div>

      {/* 前後の日付ストリップ（±5日。クリックでその日のコミック一覧へ）。
          スマホでは本日が中央に来るよう自動スクロールする。 */}
      <DateStripScroller className="flex items-stretch gap-2 mb-8 overflow-x-auto" style={{ paddingBottom: "4px" }}>
        {stripDates.map((d) => {
          const f = formatDateJP(d);
          const c = counts[d] ?? 0;
          const isCur = d === today;
          return (
            <Link
              key={d}
              href={isCur ? "/comics" : `/comics/date/${d}`}
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

      {books.length === 0 ? (
        <p className="py-8 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
          本日の新刊コミックは現在収集中です。明朝9時に更新されます。
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

// コミック発売カレンダー（前月薄・当月・翌月薄の3カラム）
async function ComicCalendarSection() {
  const today = todayJST();
  const yyyymm = today.slice(0, 7);
  const prev = shiftMonth(yyyymm, -1);
  const next = shiftMonth(yyyymm, 1);

  // ★1102対策: 冊数集計は当月のみ。コミックは最大ジャンルで3カ月ぶんのページング集計が重い。
  const cur = monthRange(yyyymm);
  const counts = await getComicCountByDate(cur.from, cur.to);
  const prevCounts: Record<string, number> = {};
  const nextCounts: Record<string, number> = {};

  const SideMonth = ({ ym, c }: { ym: string; c: Record<string, number> }) => (
    <Link
      href={`/comics/calendar/${ym}`}
      aria-label={`${monthLabel(ym)}のカレンダーへ`}
      className="hidden lg:block flex-1 self-start transition-opacity hover:opacity-90"
      style={{ opacity: 0.45, textDecoration: "none", filter: "grayscale(0.2)" }}
    >
      <div
        className="text-center mb-2 font-bold"
        style={{ color: "var(--text-muted)", fontFamily: "var(--font-serif)", fontSize: "15px" }}
      >
        {monthLabel(ym)}
      </div>
      <MonthCalendar yyyymm={ym} counts={c} today={today} muted hrefBase="/comics/date" />
    </Link>
  );

  return (
    <div className="flex items-start justify-center gap-6">
      <SideMonth ym={prev} c={prevCounts} />
      <div className="w-full max-w-md flex-shrink-0">
        <div
          className="hidden lg:block text-center mb-2"
          style={{ color: "var(--text-main)", fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 700 }}
        >
          {monthLabel(yyyymm)}
        </div>
        <MonthCalendar yyyymm={yyyymm} counts={counts} today={today} hrefBase="/comics/date" />
      </div>
      <SideMonth ym={next} c={nextCounts} />
    </div>
  );
}

export default function ComicHomePage() {
  return (
    <div className="comic-theme min-h-screen flex flex-col">
      <ComicHeader />

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
          <TodaysComicsSection />
        </Suspense>
      </main>

      {/* 発売日カレンダー（ページ最下部） */}
      <section className="max-w-6xl mx-auto w-full px-4 pt-4 pb-14">
        <div className="mb-5">
          <h2
            style={{ fontFamily: "var(--font-serif)", fontSize: "30px", fontWeight: 500, letterSpacing: "0.12em", color: "var(--text-main)", margin: "0 0 4px", whiteSpace: "nowrap" }}
          >
            発売日カレンダー
          </h2>
          <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            色のついた日に新刊コミックがあります。日付をクリックでその日の一覧へ。前月・翌月もたどれます。
          </p>
        </div>
        <Suspense fallback={null}>
          <ComicCalendarSection />
        </Suspense>
      </section>

      {/* フッター */}
      <footer
        className="text-center relative border-t mt-8"
        style={{ background: "var(--bg-subtle)", padding: "64px 0 40px", borderColor: "var(--border)" }}
      >
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 500, letterSpacing: "0.12em", color: "var(--text-main)" }}>
          新刊日和 COMIC — 毎日更新の新刊コミックカレンダー
        </h2>
        <p className="mt-2 font-bold" style={{ color: "var(--text-muted)" }}>
          書誌データ提供：楽天ブックスAPI・openBD
        </p>
      </footer>
    </div>
  );
}
