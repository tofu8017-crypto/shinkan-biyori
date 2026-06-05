export const dynamic = "force-dynamic";

import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import { getBooksByDate, getBooksByDateRange } from "@/lib/supabase";

function todayJST(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  ).toISOString().slice(0, 10);
}

function formatDateJP(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00+09:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return {
    mmdd: `${d.getMonth() + 1}/${d.getDate()}`,
    dow: days[d.getDay()],
    full: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`,
  };
}

async function TodaysBooks() {
  const today = todayJST();
  const books = await getBooksByDate(today);

  if (books.length === 0) {
    return (
      <p className="py-8 text-sm" style={{ color: "var(--text-muted)" }}>
        今日の新刊情報は現在データ収集中です。明朝9時に更新されます。
      </p>
    );
  }

  const [featured, ...rest] = books;
  const gridStyle = rest.length > 0
    ? { display: "grid", gridTemplateColumns: "1.15fr repeat(4, 1fr)", gap: "18px" }
    : {};

  return (
    <div style={gridStyle}>
      {/* フィーチャーカード（2列分） */}
      <div style={rest.length > 0 ? { gridColumn: "span 2" } : {}}>
        <BookCard book={featured} featured />
      </div>
      {/* 残りのカード */}
      {rest.slice(0, 4).map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}

async function WeekDays() {
  const today = todayJST();
  const sevenDaysAgo = new Date(new Date(today).getTime() - 6 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const books = await getBooksByDateRange(sevenDaysAgo, today);
  const grouped = books.reduce<Record<string, typeof books>>((acc, book) => {
    (acc[book.published_date] ??= []).push(book);
    return acc;
  }, {});

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(new Date(today).getTime() - i * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: "16px",
      }}
    >
      {dates.map((date, i) => {
        const fmt = formatDateJP(date);
        const dayBooks = grouped[date] ?? [];
        const isToday = i === 0;

        return (
          <div
            key={date}
            className="text-center"
            style={{
              borderLeft: i > 0 ? "1px solid var(--border)" : undefined,
              padding: "0 14px 8px",
            }}
          >
            {/* 日付バッジ */}
            <div
              className="mx-auto mb-4 flex flex-col items-center justify-center"
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#fff",
                border: `2px solid ${isToday ? "var(--accent-sage)" : "var(--border)"}`,
                fontFamily: "var(--font-serif)",
                fontSize: "19px",
                lineHeight: 1.2,
              }}
            >
              <span style={{ fontSize: "15px" }}>{fmt.mmdd}</span>
              <small style={{ fontSize: "11px", color: "var(--text-muted)" }}>{fmt.dow}</small>
            </div>

            {/* ミニ書影 */}
            {dayBooks.length > 0 ? (
              <>
                <div className="flex justify-center gap-1 mb-3">
                  {dayBooks.slice(0, 3).map((b, j) => (
                    <div
                      key={b.id}
                      style={{
                        width: "38px",
                        height: "58px",
                        borderRadius: "2px",
                        background: ["var(--accent-sage)", "var(--accent-sage)", "var(--accent-rose)"][j] ?? "var(--border)",
                        opacity: 0.75,
                      }}
                    />
                  ))}
                </div>
                <a
                  href={`/date/${date}`}
                  className="text-xs font-bold"
                  style={{ color: "var(--text-sub)", textDecoration: "none" }}
                >
                  {dayBooks.length}冊 〉
                </a>
              </>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>—</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default async function HomePage() {
  const today = todayJST();
  const fmt = formatDateJP(today);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* ヒーロー（全面表示） */}
      <section
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
          <div className="flex items-baseline gap-6 mb-6">
            <h2
              style={{ fontFamily: "var(--font-serif)", fontSize: "34px", fontWeight: 500, letterSpacing: "0.14em", color: "var(--text-main)", margin: 0 }}
            >
              今日の新刊
            </h2>
            <span className="font-bold" style={{ color: "var(--text-main)" }}>{fmt.full}</span>
          </div>
          <Suspense
            fallback={
              <div style={{ display: "grid", gridTemplateColumns: "1.15fr repeat(4, 1fr)", gap: "18px" }}>
                <div style={{ gridColumn: "span 2", borderRadius: "9px", background: "var(--bg-subtle)", minHeight: "400px" }} className="animate-pulse" />
                {[...Array(4)].map((_, i) => (
                  <div key={i} style={{ borderRadius: "9px", background: "var(--bg-subtle)", aspectRatio: "3/5" }} className="animate-pulse" />
                ))}
              </div>
            }
          >
            <TodaysBooks />
          </Suspense>
        </section>

        {/* 直近7日間 */}
        <section>
          <div className="mb-6">
            <h2
              style={{ fontFamily: "var(--font-serif)", fontSize: "34px", fontWeight: 500, letterSpacing: "0.14em", color: "var(--text-main)", margin: "0 0 4px" }}
            >
              直近7日間の新刊
            </h2>
            <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
              日付をクリックするとその日の新刊をすべて表示できます。
            </p>
          </div>
          <Suspense fallback={null}>
            <WeekDays />
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
