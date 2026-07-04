import Link from "next/link";
import { Suspense } from "react";
import MonthCalendar from "@/components/MonthCalendar";
import { getBookCountByDate } from "@/lib/supabase";

// 発売日カレンダー（当月＋前後月の3カラム）。TOPだけでなく、ジャンル・日付・検索など
// 階層下のページの最下部にも置けるよう、見出し・データ取得・Suspenseを内包した部品。

function todayJST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
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

async function CalendarBody() {
  const today = todayJST();
  const yyyymm = today.slice(0, 7);
  const prev = shiftMonth(yyyymm, -1);
  const next = shiftMonth(yyyymm, 1);

  // ★1102対策: 冊数集計は当月のみ取得する。前月・翌月は色付けなし（クリックで各月ページへ）。
  //   3カ月ぶんの全件ページング集計を毎回の再生成で走らせるとWorkerが重くなるため。
  const cur = monthRange(yyyymm);
  const counts = await getBookCountByDate(cur.from, cur.to);
  const prevCounts: Record<string, number> = {};
  const nextCounts: Record<string, number> = {};

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
      <SideMonth ym={prev} c={prevCounts} />

      <div className="w-full max-w-md flex-shrink-0">
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
        <div
          className="hidden lg:block text-center mb-2"
          style={{ color: "var(--text-main)", fontFamily: "var(--font-serif)", fontSize: "18px", fontWeight: 700 }}
        >
          {monthLabel(yyyymm)}
        </div>
        <MonthCalendar yyyymm={yyyymm} counts={counts} today={today} />
      </div>

      <SideMonth ym={next} c={nextCounts} />
    </div>
  );
}

export default function MonthCalendarSection() {
  return (
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
        <CalendarBody />
      </Suspense>
    </section>
  );
}
