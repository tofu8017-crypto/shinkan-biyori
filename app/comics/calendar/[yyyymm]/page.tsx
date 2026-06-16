export const revalidate = 1800;

import type { Metadata } from "next";
import Link from "next/link";
import MonthCalendar from "@/components/MonthCalendar";
import { getComicCountByDate } from "@/lib/supabase";
import { notFound } from "next/navigation";

function todayJST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
function isValidYM(s: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(s)) return false;
  const m = Number(s.split("-")[1]);
  return m >= 1 && m <= 12;
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

export async function generateMetadata({ params }: { params: Promise<{ yyyymm: string }> }): Promise<Metadata> {
  const { yyyymm } = await params;
  if (!isValidYM(yyyymm)) {
    return { title: "ページが見つかりません", robots: { index: false, follow: false } };
  }
  return {
    title: `${monthLabel(yyyymm)}の新刊コミックカレンダー`,
    description: `${monthLabel(yyyymm)}に発売されるコミック・マンガの新刊カレンダー。`,
    alternates: { canonical: `/comics/calendar/${yyyymm}` },
  };
}

export default async function ComicCalendarPage({ params }: { params: Promise<{ yyyymm: string }> }) {
  const { yyyymm } = await params;
  if (!isValidYM(yyyymm)) notFound();

  const today = todayJST();
  const prev = shiftMonth(yyyymm, -1);
  const next = shiftMonth(yyyymm, 1);
  const { from, to } = monthRange(yyyymm);
  const counts = await getComicCountByDate(from, to);

  return (
    <div className="comic-theme min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderColor: "var(--border)" }}
      >
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between" style={{ height: "76px" }}>
          <a href="/comics" className="leading-none" style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "0.1em", color: "var(--text-main)", textDecoration: "none" }}>
            新刊日和
            <span style={{ marginLeft: "10px", padding: "3px 8px", borderRadius: "5px", fontSize: "13px", fontWeight: 800, letterSpacing: "0.1em", color: "#fff", background: "var(--highlight)", verticalAlign: "middle" }}>
              COMIC
            </span>
          </a>
          <Link href="/comics" className="text-sm font-bold" style={{ color: "var(--highlight)", textDecoration: "none" }}>
            ← コミックトップ
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12">
        <h1 style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "0.04em", color: "var(--text-main)", borderLeft: "6px solid var(--highlight)", paddingLeft: "14px", margin: "0 0 24px" }}>
          {monthLabel(yyyymm)}の新刊コミックカレンダー
        </h1>

        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4 text-sm font-bold" style={{ color: "var(--highlight)" }}>
            <Link href={`/comics/calendar/${prev}`} style={{ color: "inherit", textDecoration: "none" }}>← {monthLabel(prev)}</Link>
            <span style={{ color: "var(--text-main)", fontSize: "18px", fontWeight: 700 }}>{monthLabel(yyyymm)}</span>
            <Link href={`/comics/calendar/${next}`} style={{ color: "inherit", textDecoration: "none" }}>{monthLabel(next)} →</Link>
          </div>
          <MonthCalendar yyyymm={yyyymm} counts={counts} today={today} hrefBase="/comics/date" />
        </div>
      </main>

      <footer className="text-center border-t mt-8" style={{ background: "var(--bg-subtle)", padding: "48px 0 36px", borderColor: "var(--border)" }}>
        <p className="font-bold" style={{ color: "var(--text-muted)" }}>新刊日和 COMIC — 毎日更新の新刊コミックカレンダー</p>
      </footer>
    </div>
  );
}
