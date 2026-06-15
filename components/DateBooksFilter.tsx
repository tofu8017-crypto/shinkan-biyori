"use client";

import { useState } from "react";
import BookCard from "./BookCard";
import { GENRES } from "@/types/book";
import type { Book } from "@/types/book";
import { isLikelyLightNovel } from "@/lib/is-light-novel";

// その日の新刊を、上部のジャンルタブで絞り込んで表示する。
// ラノベは出版社/レーベル/タイトルで判定し、小説（日本）等から分離して
// 「ライトノベル」タブに寄せる。

const RANOBE_ID = "001017";

function effectiveGenre(b: Book): string {
  // 小説系に紛れたラノベはラノベ扱い
  if (b.genre_id !== "001006" && b.genre_id !== "001001" && isLikelyLightNovel(b)) {
    return RANOBE_ID;
  }
  return b.genre_id;
}

export default function DateBooksFilter({ books }: { books: Book[] }) {
  const [sel, setSel] = useState<string>("all");

  // 実際に存在するジャンルだけタブに出す（GENRESの並び順を維持）
  const presentIds = new Set(books.map(effectiveGenre));
  const tabs = [
    { id: "all", label: "すべて" },
    ...GENRES.filter((g) => presentIds.has(g.id)).map((g) => ({ id: g.id, label: g.short ?? g.label })),
  ];

  const filtered = sel === "all" ? books : books.filter((b) => effectiveGenre(b) === sel);

  return (
    <div>
      {/* ジャンルタブ */}
      <div className="flex flex-wrap gap-2 mb-7">
        {tabs.map((t) => {
          const active = sel === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSel(t.id)}
              className="text-xs font-bold"
              style={{
                borderRadius: "999px",
                padding: "6px 16px",
                cursor: "pointer",
                border: "1px solid var(--border)",
                background: active ? "var(--highlight)" : "var(--bg-card)",
                color: active ? "#fff" : "var(--text-sub)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "18px",
        }}
      >
        {filtered.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </div>
  );
}
