export const revalidate = 1800;

import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import Link from "next/link";
import { getBooksByDate, getBookCountByDate } from "@/lib/supabase";
import MonthCalendar from "@/components/MonthCalendar";
import BookCard from "@/components/BookCard";
import GenreChips from "@/components/GenreChips";

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

      {/* 前後の日付ストリップ（±5日。クリックでその日の新刊一覧へ） */}
      <div
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
      </div>

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

function shiftMonth(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  return `${y}年${m}月`;
}

// その月の初日・末日（"YYYY-MM-DD"）を返す
function monthRange(yyyymm: string): { from: string; to: string } {
  const [y, m] = yyyymm.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${yyyymm}-01`, to: `${yyyymm}-${String(last).padStart(2, "0")}` };
}

// 今月の発売日カレンダー（月間グリッド）。発売がある日に冊数を表示し、
// クリックでその日の一覧へ。前月・翌月は /calendar/[yyyymm] でたどれる。
async function CalendarSection() {
  const today = todayJST();
  const yyyymm = today.slice(0, 7);
  const prev = shiftMonth(yyyymm, -1);
  const next = shiftMonth(yyyymm, 1);

  // 当月＋前後月の冊数をまとめて取得（前後月はPC版の薄表示でのみ使う）
  const cur = monthRange(yyyymm);
  const pr = monthRange(prev);
  const nx = monthRange(next);
  const [counts, prevCounts, nextCounts] = await Promise.all([
    getBookCountByDate(cur.from, cur.to),
    getBookCountByDate(pr.from, pr.to),
    getBookCountByDate(nx.from, nx.to),
  ]);

  // 前月・翌月の「薄表示」カラム。月全体を1つのリンクにして、その月のページへ。
  const SideMonth = ({ ym, c }: { ym: string; c: Record<string, number> }) => (
    <Link
      href={`/calendar/${ym}`}
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
      <MonthCalendar yyyymm={ym} counts={c} today={today} muted />
    </Link>
  );

  return (
    <div className="flex items-start justify-center gap-6">
      {/* 前月（PCのみ・薄表示） */}
      <SideMonth ym={prev} c={prevCounts} />

      {/* 当月（常に表示） */}
      <div className="w-full max-w-md flex-shrink-0">
        {/* スマホ用の前後月テキストナビ（PCでは前後カレンダーが見えるので隠す） */}
        <div className="flex lg:hidden items-center justify-between mb-4 text-sm font-bold" style={{ color: "var(--highlight)" }}>
          <Link href={`/calendar/${prev}`} style={{ color: "inherit", textDecoration: "none" }}>
            ← {monthLabel(prev)}
          </Link>
          <span style={{ color: "var(--text-main)", fontFamily: "var(--font-serif)", fontSize: "18px" }}>
            {monthLabel(yyyymm)}
          </span>
          <Link href={`/calendar/${next}`} style={{ color: "inherit", textDecoration: "none" }}>
            {monthLabel(next)} →
          </Link>
        </div>
        {/* PC用の当月ラベル（前後月のラベルと高さを揃える） */}
        <div
          className="hidden lg:block text-center mb-2"
          style={{ color: "var(--text-main)", fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 700 }}
        >
          {monthLabel(yyyymm)}
        </div>
        <MonthCalendar yyyymm={yyyymm} counts={counts} today={today} />
      </div>

      {/* 翌月（PCのみ・薄表示） */}
      <SideMonth ym={next} c={nextCounts} />
    </div>
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
      <section className="max-w-6xl mx-auto w-full px-4 pt-4 pb-14">
        <div className="mb-5">
          <h2
            className="section-title"
            style={{ fontFamily: "var(--font-serif)", fontSize: "30px", fontWeight: 500, letterSpacing: "0.12em", color: "var(--text-main)", margin: "0 0 4px", whiteSpace: "nowrap" }}
          >
            発売日カレンダー
          </h2>
          <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            色のついた日に新刊があります。日付をクリックでその日の新刊一覧へ。前月・翌月もたどれます。
          </p>
        </div>
        <Suspense fallback={null}>
          <CalendarSection />
        </Suspense>
      </section>

      {/* フッター */}
      <footer
        className="text-center relative border-t mt-8"
        style={{
          background: "var(--bg-subtle)",
          padding: "64px 0 40px",
          borderColor: "var(--border)",
        }}
      >
        <h2
          style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 500, letterSpacing: "0.12em", color: "var(--text-main)" }}
        >
          新刊日和 — 毎日更新の文芸書新刊カレンダー
        </h2>
        <p className="mt-2 font-bold" style={{ color: "var(--text-muted)" }}>
          書誌データ提供：楽天ブックスAPI・openBD
        </p>
      </footer>
    </div>
  );
}
