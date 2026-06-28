"use client";

import { useState } from "react";
import BookCard from "./BookCard";
import { GENRES } from "@/types/book";
import type { Book } from "@/types/book";
import { effectiveGenreOfBook } from "@/lib/author-genre";
// その日の新刊を、上部のジャンルタブで絞り込んで表示する。
// ラノベは楽天で「日本の小説」等にまとめられるため、実効ジャンルで振り分けて
// 「ライトノベル」タブでも絞り込めるようにする（BookCardのラベルと一致させる）。

function effectiveGenre(b: Book): string {
  return effectiveGenreOfBook(b);
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
