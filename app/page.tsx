import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import BookCard from "@/components/BookCard";
import { getBooksByDate, getBooksByDateRange } from "@/lib/supabase";

function todayJST(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  )
    .toISOString()
    .slice(0, 10);
}

async function TodaysBooks() {
  const today = todayJST();
  const books = await getBooksByDate(today);

  if (books.length === 0) {
    return (
      <p className="text-sm py-8" style={{ color: "var(--text-muted)" }}>
        今日の新刊情報は現在データ収集中です。
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}

async function RecentBooks() {
  const today = todayJST();
  const sevenDaysAgo = new Date(
    new Date(today).getTime() - 7 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  const books = await getBooksByDateRange(sevenDaysAgo, today);
  const grouped = books.reduce<Record<string, typeof books>>((acc, book) => {
    (acc[book.published_date] ??= []).push(book);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort().reverse().slice(1); // 今日は上で表示済み

  if (dates.length === 0) return null;

  return (
    <section className="mt-12">
      <h2
        className="text-xl mb-6"
        style={{ fontFamily: "var(--font-serif)", color: "var(--text-main)" }}
      >
        直近7日間の新刊
      </h2>
      <div className="flex flex-col gap-10">
        {dates.map((date) => (
          <div key={date}>
            <h3
              className="text-sm font-medium mb-3 pb-2 border-b"
              style={{ color: "var(--text-sub)", borderColor: "var(--border)" }}
            >
              {date.replace(/-/g, "/")}
              <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                {grouped[date].length}冊
              </span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {grouped[date].map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const today = todayJST();

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <section>
          <div className="flex items-baseline gap-3 mb-6">
            <h1
              className="text-2xl"
              style={{ fontFamily: "var(--font-serif)", color: "var(--text-main)" }}
            >
              今日の新刊
            </h1>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              {today.replace(/-/g, "/")}
            </span>
          </div>
          <Suspense
            fallback={
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border animate-pulse"
                    style={{
                      aspectRatio: "3/5",
                      background: "var(--bg-subtle)",
                      borderColor: "var(--border)",
                    }}
                  />
                ))}
              </div>
            }
          >
            <TodaysBooks />
          </Suspense>
        </section>

        <Suspense fallback={null}>
          <RecentBooks />
        </Suspense>
      </main>

      <footer
        className="text-center py-8 text-xs border-t"
        style={{
          color: "var(--text-muted)",
          borderColor: "var(--border)",
          background: "var(--bg-subtle)",
        }}
      >
        新刊日和 — 毎日更新の文芸書新刊カレンダー
        <br />
        書誌データ提供：楽天ブックスAPI・openBD
      </footer>
    </div>
  );
}
