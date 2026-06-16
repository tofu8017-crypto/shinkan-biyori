export const revalidate = 1800;

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import BookCard from "@/components/BookCard";
import MonthCalendar from "@/components/MonthCalendar";
import HeroSlideshow from "@/components/HeroSlideshow";
import { getComicsByDate, getLatestComics, getComicCountByDate } from "@/lib/supabase";

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
  return { full: `${y}年${m}月${dd}日（${dow}）` };
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

// 今日のコミック（フィーチャー1冊＋グリッド）。今日が0冊なら直近で補填。
async function TodaysComics() {
  const today = todayJST();
  let books = await getComicsByDate(today);
  if (books.length === 0) books = await getLatestComics(today, 6);

  if (books.length === 0) {
    return (
      <p className="py-8 text-sm" style={{ color: "var(--text-muted)" }}>
        新刊コミックは現在データ収集中です。明朝9時に更新されます。
      </p>
    );
  }

  const featured = books[0];
  const rest = books.slice(1);

  return (
    <div className={rest.length > 0 ? "today-grid" : ""}>
      <div className={rest.length > 0 ? "featured-cell" : ""}>
        <BookCard book={featured} featured featuredLabel="今日の一冊" />
      </div>
      {rest.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}

// コミック発売カレンダー（前月薄・当月・翌月薄の3カラム）
async function ComicCalendarSection() {
  const today = todayJST();
  const yyyymm = today.slice(0, 7);
  const prev = shiftMonth(yyyymm, -1);
  const next = shiftMonth(yyyymm, 1);

  const cur = monthRange(yyyymm);
  const pr = monthRange(prev);
  const nx = monthRange(next);
  const [counts, prevCounts, nextCounts] = await Promise.all([
    getComicCountByDate(cur.from, cur.to),
    getComicCountByDate(pr.from, pr.to),
    getComicCountByDate(nx.from, nx.to),
  ]);

  const SideMonth = ({ ym, c }: { ym: string; c: Record<string, number> }) => (
    <Link
      href={`/comics/calendar/${ym}`}
      aria-label={`${monthLabel(ym)}のカレンダーへ`}
      className="hidden lg:block flex-1 self-start transition-opacity hover:opacity-90"
      style={{ opacity: 0.45, textDecoration: "none" }}
    >
      <div className="text-center mb-2 font-bold" style={{ color: "var(--text-muted)", fontSize: "15px" }}>
        {monthLabel(ym)}
      </div>
      <MonthCalendar yyyymm={ym} counts={c} today={today} muted hrefBase="/comics/date" />
    </Link>
  );

  return (
    <div className="flex items-start justify-center gap-6">
      <SideMonth ym={prev} c={prevCounts} />
      <div className="w-full max-w-md flex-shrink-0">
        <div className="hidden lg:block text-center mb-2" style={{ color: "var(--text-main)", fontSize: "18px", fontWeight: 700 }}>
          {monthLabel(yyyymm)}
        </div>
        <MonthCalendar yyyymm={yyyymm} counts={counts} today={today} hrefBase="/comics/date" />
      </div>
      <SideMonth ym={next} c={nextCounts} />
    </div>
  );
}

export default function ComicHomePage() {
  const today = todayJST();
  const fmt = formatDateJP(today);

  return (
    <div className="comic-theme min-h-screen flex flex-col">
      {/* 白×青のコミック版ヘッダー（講談社サイト風・ゴシック） */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderColor: "var(--border)" }}
      >
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between" style={{ height: "76px" }}>
          <a
            href="/comics"
            className="leading-none"
            style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "0.1em", color: "var(--text-main)", textDecoration: "none" }}
          >
            新刊日和
            <span style={{ marginLeft: "10px", padding: "3px 8px", borderRadius: "5px", fontSize: "13px", fontWeight: 800, letterSpacing: "0.1em", color: "#fff", background: "var(--highlight)", verticalAlign: "middle" }}>
              COMIC
            </span>
          </a>
          <Link href="/" className="text-sm font-bold" style={{ color: "var(--highlight)", textDecoration: "none" }}>
            文芸版へ →
          </Link>
        </div>
      </header>

      {/* ヒーロー（背景3枚スライドショー＋青オーバーレイ） */}
      <section className="hero-section" style={{ position: "relative", height: "320px", overflow: "hidden" }}>
        <HeroSlideshow />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(11,108,181,0.92) 0%, rgba(11,108,181,0.7) 45%, rgba(26,134,212,0.15) 100%)",
          }}
        />
        <div className="relative h-full max-w-6xl mx-auto px-4 flex items-center">
          <div style={{ maxWidth: "520px" }}>
            <h1
              style={{
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 900,
                letterSpacing: "0.08em",
                lineHeight: 1.5,
                margin: "0 0 24px",
                color: "#ffffff",
              }}
            >
              あのマンガ、<br /><span style={{ whiteSpace: "nowrap" }}>今日出てた！</span>
            </h1>
            <a
              href="#today"
              className="inline-flex items-center gap-2 font-bold transition-opacity hover:opacity-85"
              style={{
                background: "#fff",
                color: "var(--highlight)",
                borderRadius: "999px",
                padding: "13px 30px",
                fontSize: "16px",
                textDecoration: "none",
                boxShadow: "0 12px 24px rgba(11,108,181,0.3)",
              }}
            >
              今日のコミックを見る <span>↓</span>
            </a>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-14" id="today">
        <section className="mb-16">
          <div className="flex items-baseline gap-x-6 gap-y-1 mb-6 flex-wrap">
            <h2
              className="section-title"
              style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "0.06em", color: "var(--text-main)", margin: 0, whiteSpace: "nowrap", borderLeft: "6px solid var(--highlight)", paddingLeft: "14px" }}
            >
              今日のコミック
            </h2>
            <span className="font-bold" style={{ color: "var(--text-main)" }}>{fmt.full}</span>
          </div>
          <Suspense
            fallback={
              <div className="today-grid">
                <div className="featured-cell animate-pulse" style={{ borderRadius: "9px", background: "var(--bg-subtle)", minHeight: "400px" }} />
                {[...Array(4)].map((_, i) => (
                  <div key={i} style={{ borderRadius: "9px", background: "var(--bg-subtle)", aspectRatio: "3/5" }} className="animate-pulse" />
                ))}
              </div>
            }
          >
            <TodaysComics />
          </Suspense>
        </section>
      </main>

      {/* コミック発売カレンダー（ページ最下部） */}
      <section className="max-w-6xl mx-auto w-full px-4 pt-4 pb-14">
        <div className="mb-5">
          <h2
            className="section-title"
            style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "0.06em", color: "var(--text-main)", margin: "0 0 4px", whiteSpace: "nowrap", borderLeft: "6px solid var(--highlight)", paddingLeft: "14px" }}
          >
            発売日カレンダー
          </h2>
          <p className="text-sm font-bold" style={{ color: "var(--text-muted)", paddingLeft: "20px" }}>
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
        <h2 style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "0.08em", color: "var(--text-main)" }}>
          新刊日和 COMIC — 毎日更新の新刊コミックカレンダー
        </h2>
        <p className="mt-2 font-bold" style={{ color: "var(--text-muted)" }}>
          書誌データ提供：楽天ブックスAPI・openBD
        </p>
      </footer>
    </div>
  );
}
