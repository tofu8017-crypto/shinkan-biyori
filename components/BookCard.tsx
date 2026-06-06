import type { Book } from "@/types/book";
import { GENRES } from "@/types/book";
import { amazonUrl } from "@/lib/amazon";

type Props = { book: Book; featured?: boolean };

const COVER_GRADIENTS: Record<string, string> = {
  "001004008": "linear-gradient(145deg,#dfeade,#a9c6b4)",
  "001004009": "linear-gradient(145deg,#dceaf1,#9fc0d1)",
  "001004001": "linear-gradient(145deg,#eee5f4,#b9a6c9)",
  "001004002": "linear-gradient(145deg,#dfeef5,#9fc0d1)",
  "001004003": "linear-gradient(145deg,#f7e1d8,#e7b49f)",
  "001006": "linear-gradient(145deg,#efe7cf,#cdbb8e)",
};

function CoverPlaceholder({ book, genre, large = false }: { book: Book; genre: typeof GENRES[0] | undefined; large?: boolean }) {
  const bg = COVER_GRADIENTS[book.genre_id] ?? "linear-gradient(145deg,#ede8e0,#d4ccc4)";
  return (
    <div
      className="w-full h-full flex flex-col justify-between relative overflow-hidden"
      style={{
        background: bg,
        aspectRatio: "3/4",
        padding: large ? "20px" : "12px",
        fontFamily: "var(--font-serif)",
      }}
    >
      <div />
      <div>
        <p
          className="leading-snug"
          style={{
            fontSize: large ? "22px" : "11px",
            color: "rgba(61,53,48,0.78)",
            lineHeight: 1.7,
          }}
        >
          {book.title}
        </p>
        <p
          className="mt-2"
          style={{
            fontSize: large ? "12px" : "9px",
            color: "rgba(61,53,48,0.55)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {book.author}
        </p>
      </div>
      {/* ハイライト */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 30% 80%, rgba(255,255,255,0.5), transparent 38%)",
        }}
      />
    </div>
  );
}

export default function BookCard({ book, featured = false }: Props) {
  const genre = GENRES.find((g) => g.id === book.genre_id);
  const azUrl = amazonUrl(book);
  const href = book.rakuten_url ?? azUrl;
  const borderColor = genre?.color ?? "var(--border)";

  if (featured) {
    return (
      <article
        className="relative grid"
        style={{
          background: "var(--bg-card)",
          borderRadius: "9px",
          borderTop: `5px solid ${borderColor}`,
          boxShadow: "0 12px 28px rgba(61,53,48,0.10)",
          padding: "58px 28px 28px",
          gridTemplateColumns: "42% 1fr",
          gap: "28px",
          minHeight: "400px",
        }}
      >
        {/* ラベル */}
        <div
          className="absolute top-0 left-0 font-bold text-sm"
          style={{
            background: "var(--highlight)",
            color: "#fff",
            borderRadius: "8px 0 18px 0",
            padding: "8px 18px",
          }}
        >
          今日の一冊
        </div>

        {/* 書影 */}
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ borderRadius: "4px", overflow: "hidden", boxShadow: "0 10px 20px rgba(61,53,48,0.12)" }}>
          {book.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={book.image_url} alt={book.title} className="w-full h-full object-cover" style={{ aspectRatio: "3/4" }} />
          ) : (
            <CoverPlaceholder book={book} genre={genre} large />
          )}
        </a>

        {/* 書誌 */}
        <div className="flex flex-col">
          <h3
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "31px",
              fontWeight: 500,
              lineHeight: 1.55,
              margin: "10px 0 14px",
              color: "var(--text-main)",
            }}
          >
            {book.title}
          </h3>
          <div className="text-sm font-bold mb-3" style={{ color: "var(--text-muted)" }}>
            {book.author}　｜　{book.publisher}
          </div>
          <span
            className="inline-block text-xs font-bold"
            style={{
              borderRadius: "999px",
              background: (genre?.color ?? "#E8C4B8") + "44",
              color: "var(--text-sub)",
              padding: "2px 12px",
              width: "fit-content",
            }}
          >
            {genre?.label}
          </span>
          {book.description && (
            <p className="text-sm font-bold mt-4 leading-relaxed" style={{ color: "var(--text-sub)" }}>
              {book.description}
            </p>
          )}
          <div className="flex gap-3 mt-auto pt-6">
            {book.rakuten_url && (
              <a href={book.rakuten_url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-bold rounded-full px-5 py-2 transition-opacity hover:opacity-80"
                style={{ background: "#111", color: "#fff", textDecoration: "none" }}>
                楽天
              </a>
            )}
            <a href={azUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm font-bold rounded-full px-5 py-2 transition-opacity hover:opacity-80"
              style={{ background: "#ED8A22", color: "#fff", textDecoration: "none" }}>
              Amazon
            </a>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className="flex flex-col"
      style={{
        background: "var(--bg-card)",
        borderRadius: "9px",
        borderTop: `5px solid ${borderColor}`,
        boxShadow: "0 12px 28px rgba(61,53,48,0.10)",
        padding: "18px 14px 22px",
      }}
    >
      <a href={href} target="_blank" rel="noopener noreferrer"
        style={{ borderRadius: "4px", overflow: "hidden", display: "block" }}>
        {book.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={book.image_url} alt={book.title} className="w-full object-cover" style={{ aspectRatio: "3/4" }} />
        ) : (
          <CoverPlaceholder book={book} genre={genre} />
        )}
      </a>
      <h3
        className="line-clamp-2"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "18px",
          fontWeight: 500,
          lineHeight: 1.55,
          margin: "14px 0 8px",
          color: "var(--text-main)",
        }}
      >
        {book.title}
      </h3>
      <div className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>{book.author}</div>
      <span
        className="inline-block text-xs font-bold mb-4"
        style={{
          borderRadius: "999px",
          background: (genre?.color ?? "#E8C4B8") + "44",
          color: "var(--text-sub)",
          padding: "2px 10px",
          width: "fit-content",
        }}
      >
        {genre?.label}
      </span>
      <div className="flex gap-2 mt-auto">
        {book.rakuten_url && (
          <a href={book.rakuten_url} target="_blank" rel="noopener noreferrer"
            className="text-xs font-bold rounded-full px-3 py-1 transition-opacity hover:opacity-80"
            style={{ background: "#111", color: "#fff", textDecoration: "none" }}>
            楽天
          </a>
        )}
        <a href={azUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs font-bold rounded-full px-3 py-1 transition-opacity hover:opacity-80"
          style={{ background: "#ED8A22", color: "#fff", textDecoration: "none" }}>
          Amazon
        </a>
      </div>
    </article>
  );
}
