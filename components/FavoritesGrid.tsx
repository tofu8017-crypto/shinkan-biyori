"use client";

import { useEffect, useState } from "react";
import BookCard from "./BookCard";
import { getFavorites, FAVORITES_EVENT, type FavBook } from "@/lib/favorites";
import type { Book } from "@/types/book";

// localStorageの最小書誌を BookCard が必要とする Book 型に補完する。
// 発売日・出版社などは一覧表示に使わないため空で良い。
function toBook(f: FavBook): Book {
  return {
    id: f.isbn13,
    isbn13: f.isbn13,
    isbn10: f.isbn10,
    title: f.title,
    author: f.author,
    publisher: "",
    published_date: "",
    genre_id: f.genre_id as Book["genre_id"],
    image_url: f.image_url,
    rakuten_url: f.rakuten_url,
    amazon_url: f.amazon_url,
    description: null,
    last_synced_at: "",
  };
}

// お気に入り一覧。comicOnly=true ならコミックのみ、false ならコミック以外を表示する
// （文芸版・コミック版それぞれのスキンに合わせて出し分ける）。
export default function FavoritesGrid({ comicOnly = false }: { comicOnly?: boolean }) {
  const [favs, setFavs] = useState<FavBook[] | null>(null);

  useEffect(() => {
    const load = () => setFavs(getFavorites());
    load();
    window.addEventListener(FAVORITES_EVENT, load);
    return () => window.removeEventListener(FAVORITES_EVENT, load);
  }, []);

  // SSR時・マウント前は何も出さない（localStorageはクライアントのみ）
  if (favs === null) return null;

  const list = favs.filter((f) =>
    comicOnly ? f.genre_id === "001001" : f.genre_id !== "001001"
  );

  if (list.length === 0) {
    return (
      <p className="py-8 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
        まだお気に入りがありません。本の表紙の♡を押すと、ここに保存されます（この端末に保存され、ログイン不要です）。
      </p>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: "18px",
      }}
    >
      {list.map((f) => (
        <BookCard key={f.isbn13} book={toBook(f)} />
      ))}
    </div>
  );
}
