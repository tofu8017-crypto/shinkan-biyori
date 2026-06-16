export const revalidate = 1800;

import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import Link from "next/link";
import { getBooksByDate, getBookCountByDate, getLatestBooks } from "@/lib/supabase";
import { isLikelyLightNovel } from "@/lib/is-light-novel";
import MonthCalendar from "@/components/MonthCalendar";
import HeroSlideshow from "@/components/HeroSlideshow";

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

async function TodaysBooks() {
  const today = todayJST();
  // まず今日発売の本をすべて取得。今日が0冊の日だけ直近の新刊で補填する。
  let books = await getBooksByDate(today);
  if (books.length === 0) {
    books = await getLatestBooks(today, 6);
  }

  if (books.length === 0) {
    return (
      <p className="py-8 text-sm" style={{ color: "var(--text-muted)" }}>
        新刊情報は現在データ収集中です。明朝9時に更新されます。
      </p>
    );
  }

  // 「今日の一冊」はなるべくライトノベル以外を選ぶ。
  // ① 今日の新刊から非ラノベを探す
  // ② 今日が全部ラノベなら、直近の非ラノベ書籍を代わりに選ぶ
  // ③ それも無ければ今日の先頭にフォールバック
  let featured: typeof books[number];
  let rest: typeof books;
  let featuredLabel = "今日の一冊";
  const featuredIndex = books.findIndex((b) => !isLikelyLightNovel(b));
  if (featuredIndex >= 0) {
    featured = books[featuredIndex];
    rest = books.filter((_, i) => i !== featuredIndex);
  } else {
    const recent = await getLatestBooks(today, 40);
    const pick = recent.find(
      (b) => !isLikelyLightNovel(b) && !books.some((x) => x.id === b.id)
    );
    featured = pick ?? books[0];
    // 代替ピックは今日の本ではないので、今日の本は全部gridに残す
    rest = pick ? books : books.filter((_, i) => i !== 0);
    // 今日以外から選んだ場合はラベルを変える（「今日の一冊」だと不正確なため）
    if (pick) featuredLabel = "注目の一冊";
  }

  return (
    <div className={rest.length > 0 ? "today-grid" : ""}>
      {/* フィーチャーカード（2列分） */}
      <div className={rest.length > 0 ? "featured-cell" : ""}>
        <BookCard book={featured} featured featuredLabel={featuredLabel} />
      </div>
      {/* 残りのカード（今日の分はすべて表示） */}
      {rest.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
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
  const today = todayJST();
  const fmt = formatDateJP(today);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* ヒーロー（縮小・背景3枚を数秒ごとにクロスフェード巡回） */}
      <section
        className="hero-section"
        style={{ position: "relative", height: "320px", overflow: "hidden" }}
      >
        {/* 背景スライドショー（クライアント・3枚巡回） */}
        <HeroSlideshow />
        {/* 左からのグラデーションオーバーレイ（テキスト可読性確保） */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(250,246,241,0.92) 0%, rgba(250,246,241,0.75) 45%, rgba(250,246,241,0.1) 100%)",
          }}
        />
        {/* テキスト */}
        <div className="relative h-full max-w-6xl mx-auto px-4 flex items-center">
          <div style={{ maxWidth: "520px" }}>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 900,
                letterSpacing: "0.14em",
                lineHeight: 1.5,
                margin: "0 0 24px",
                color: "var(--text-main)",
              }}
            >
              あの本、<br /><span style={{ whiteSpace: "nowrap" }}>今日出てたんだ！</span>
            </h1>
            <a
              href="#today"
              className="inline-flex items-center gap-2 font-bold transition-opacity hover:opacity-85"
              style={{
                background: "var(--highlight)",
                color: "#fff",
                borderRadius: "999px",
                padding: "13px 30px",
                fontSize: "16px",
                textDecoration: "none",
                boxShadow: "0 12px 24px rgba(196,149,106,0.25)",
              }}
            >
              今日の新刊を見る <span>↓</span>
            </a>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-14" id="today">

        {/* 今日の新刊 */}
        <section className="mb-16">
          <div className="flex items-baseline gap-x-6 gap-y-1 mb-6 flex-wrap">
            <h2
              className="section-title"
              style={{ fontFamily: "var(--font-serif)", fontSize: "34px", fontWeight: 500, letterSpacing: "0.14em", color: "var(--text-main)", margin: 0, whiteSpace: "nowrap" }}
            >
              今日の新刊
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
            <TodaysBooks />
          </Suspense>
        </section>

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
