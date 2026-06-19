"use client";

import { useEffect, useState } from "react";
import { type FavBook, isFavorite, toggleFavorite, FAVORITES_EVENT } from "@/lib/favorites";

// 書影の上に重ねるハート型のお気に入りボタン。クリックでlocalStorageに登録/解除する。
// SSRと食い違わないよう、初期描画は常に未登録（♡）にして、マウント後に実状態へ更新する。
export default function FavoriteButton({ book }: { book: FavBook }) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    setFav(isFavorite(book.isbn13));
    // 別カードや別タブでの変更にも追従する
    const sync = () => setFav(isFavorite(book.isbn13));
    window.addEventListener(FAVORITES_EVENT, sync);
    return () => window.removeEventListener(FAVORITES_EVENT, sync);
  }, [book.isbn13]);

  return (
    <button
      type="button"
      aria-label={fav ? "お気に入りから外す" : "お気に入りに追加"}
      aria-pressed={fav}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setFav(toggleFavorite(book));
      }}
      className="absolute flex items-center justify-center transition-transform hover:scale-110"
      style={{
        top: "8px",
        right: "8px",
        width: "32px",
        height: "32px",
        borderRadius: "999px",
        border: "none",
        cursor: "pointer",
        background: "rgba(255,255,255,0.9)",
        boxShadow: "0 1px 4px rgba(61,53,48,0.25)",
        color: fav ? "#e0245e" : "rgba(61,53,48,0.55)",
        zIndex: 5,
      }}
    >
      {/* フォント依存で細長くなる絵文字♥を避け、標準的なハート形のSVGにする */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={fav ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
