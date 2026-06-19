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
        color: fav ? "#e0245e" : "rgba(61,53,48,0.5)",
        fontSize: "16px",
        lineHeight: 1,
        zIndex: 5,
      }}
    >
      {fav ? "♥" : "♡"}
    </button>
  );
}
