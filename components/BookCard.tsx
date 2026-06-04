import type { Book } from "@/types/book";
import { GENRES } from "@/types/book";

type Props = { book: Book };

export default function BookCard({ book }: Props) {
  const genre = GENRES.find((g) => g.id === book.genre_id);

  return (
    <div
      className="rounded-xl border overflow-hidden transition-transform hover:-translate-y-0.5"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border)",
        borderTop: genre ? `3px solid ${genre.color}` : undefined,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      {/* 書影 */}
      <a
        href={book.rakuten_url ?? book.amazon_url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        style={{ aspectRatio: "3/4", overflow: "hidden" }}
      >
        {book.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={book.image_url}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-end p-2"
            style={{ background: genre?.color ?? "var(--bg-subtle)" }}
          >
            <span
              className="text-xs leading-tight line-clamp-3"
              style={{ color: "var(--text-main)", fontFamily: "var(--font-serif)" }}
            >
              {book.title}
            </span>
          </div>
        )}
      </a>

      {/* 書誌情報 */}
      <div className="p-3 flex flex-col gap-2">
        <div>
          <p
            className="text-sm leading-snug line-clamp-2"
            style={{ fontFamily: "var(--font-serif)", color: "var(--text-main)" }}
          >
            {book.title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {book.author}
          </p>
        </div>

        {/* 購入ボタン */}
        <div className="flex gap-1.5 flex-wrap">
          {book.rakuten_url && (
            <a
              href={book.rakuten_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1 rounded-full font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--text-main)", color: "#fff" }}
            >
              楽天
            </a>
          )}
          {book.amazon_url && (
            <a
              href={book.amazon_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1 rounded-full font-medium transition-opacity hover:opacity-80"
              style={{ background: "#FF9900", color: "#111" }}
            >
              Amazon
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
