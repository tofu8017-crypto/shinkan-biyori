export const revalidate = 1800;

import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import Link from "next/link";
import { getBooksByDate, getBookCountByDate, getLatestBooks } from "@/lib/supabase";
import { isLikelyLightNovel } from "@/lib/is-light-novel";
import MonthCalendar from "@/components/MonthCalendar";

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

// 今月の発売日カレンダー（月間グリッド）。発売がある日に冊数を表示し、
// クリックでその日の一覧へ。前月・翌月は /calendar/[yyyymm] でたどれる。
async function CalendarSection() {
  const today = todayJST();
  const yyyymm = today.slice(0, 7);
  const from = `${yyyymm}-01`;
  const [y, m] = yyyymm.split("-").map(Number);
  const to = `${yyyymm}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const counts = await getBookCountByDate(from, to);
  const prev = shiftMonth(yyyymm, -1);
  const next = shiftMonth(yyyymm, 1);

  return (
    <div className="max-w-md mx-auto">
      {/* 前月・翌月ナビ */}
      <div className="flex items-center justify-between mb-4 text-sm font-bold" style={{ color: "var(--highlight)" }}>
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
      <MonthCalendar yyyymm={yyyymm} counts={counts} today={today} />
    </div>
  );
}

export default async function HomePage() {
  const today = todayJST();
  const fmt = formatDateJP(today);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* 発売日カレンダー（ヒーローより上＝最初に目に入る位置） */}
      <section className="max-w-6xl mx-auto w-full px-4 pt-8 pb-4">
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

      {/* ヒーロー（全面表示） */}
      <section
        className="hero-section"
        style={{
          position: "relative",
          height: "500px",
          overflow: "hidden",
        }}
      >
        {/* 背景画像 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero.jpg"
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
        {/* 左からのグラデーションオーバーレイ（テキスト可読性確保） */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(250,246,241,0.92) 0%, rgba(250,246,241,0.75) 45%, rgba(250,246,241,0.1) 100%)",
          }}
        />
        {/* テキスト */}
        <div
          className="relative h-full max-w-6xl mx-auto px-4 flex items-center"
        >
          <div style={{ maxWidth: "520px" }}>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(36px, 5vw, 58px)",
                fontWeight: 900,
                letterSpacing: "0.16em",
                lineHeight: 1.55,
                margin: "0 0 32px",
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
                padding: "15px 34px",
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
