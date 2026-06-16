export const revalidate = 1800;

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import BookCard from "@/components/BookCard";
import { getBooksByGenre } from "@/lib/supabase";

const COMIC_GENRE_ID = "001001";

export const metadata: Metadata = {
  title: "コミック版 — 新刊コミックカレンダー",
  description: "今日発売のコミック・マンガを毎日まとめ。Amazon・楽天のリンク付き。",
  alternates: { canonical: "/comics" },
};

async function ComicReleases() {
  const books = await getBooksByGenre(COMIC_GENRE_ID);

  if (books.length === 0) {
    return (
      <p className="py-10 text-sm" style={{ color: "var(--text-muted)" }}>
        新刊コミックは現在データ収集中です。明朝9時に更新されます。
      </p>
    );
  }

  return (
    <div
      className="grid gap-5"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
    >
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}

export default function ComicHomePage() {
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
            <span
              style={{ marginLeft: "10px", padding: "3px 8px", borderRadius: "5px", fontSize: "13px", fontWeight: 800, letterSpacing: "0.1em", color: "#fff", background: "var(--highlight)", verticalAlign: "middle" }}
            >
              COMIC
            </span>
          </a>
          <Link
            href="/"
            className="text-sm font-bold"
            style={{ color: "var(--highlight)", textDecoration: "none" }}
          >
            文芸版へ →
          </Link>
        </div>
      </header>

      {/* ヒーロー（白地＋青の帯） */}
      <section
        style={{
          background: "linear-gradient(135deg, #0b6cb5 0%, #1a86d4 60%, #3aa0e6 100%)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-12">
          <p className="font-bold mb-3" style={{ color: "rgba(255,255,255,0.9)", letterSpacing: "0.1em", fontSize: "14px" }}>
            毎日更新の新刊コミックカレンダー
          </p>
          <h1
            style={{
              fontSize: "clamp(30px, 5vw, 52px)",
              fontWeight: 900,
              letterSpacing: "0.08em",
              lineHeight: 1.4,
              margin: 0,
              color: "#ffffff",
            }}
          >
            あのマンガ、<span style={{ whiteSpace: "nowrap" }}>今日出てた！</span>
          </h1>
        </div>
      </section>

      {/* 新刊コミック一覧 */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12">
        <h2
          className="mb-6"
          style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "0.06em", color: "var(--text-main)", borderLeft: "5px solid var(--highlight)", paddingLeft: "12px" }}
        >
          新着コミック
        </h2>
        <Suspense
          fallback={
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
              {[...Array(12)].map((_, i) => (
                <div key={i} className="animate-pulse" style={{ borderRadius: "9px", background: "var(--bg-subtle)", aspectRatio: "3/5" }} />
              ))}
            </div>
          }
        >
          <ComicReleases />
        </Suspense>
      </main>

      {/* フッター */}
      <footer
        className="text-center border-t"
        style={{ background: "var(--bg-subtle)", padding: "48px 0 36px", borderColor: "var(--border)" }}
      >
        <h2 style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "0.08em", color: "var(--text-main)" }}>
          新刊日和 COMIC — 毎日更新の新刊コミックカレンダー
        </h2>
        <p className="mt-2 font-bold" style={{ color: "var(--text-muted)" }}>
          書誌データ提供：楽天ブックスAPI・openBD
        </p>
      </footer>
    </div>
  );
}
