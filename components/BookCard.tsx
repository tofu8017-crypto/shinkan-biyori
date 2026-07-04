import Link from "next/link";
import type { Book } from "@/types/book";
import { GENRES } from "@/types/book";
import { amazonUrl, amazonSearchUrl } from "@/lib/amazon";
import { detectSeries } from "@/lib/detect-series";
import { ebookjapanUrl } from "@/lib/ebookjapan";
import { hiResCover } from "@/lib/cover";
import FavoriteButton from "@/components/FavoriteButton";
import { effectiveGenreOfBook } from "@/lib/author-genre";

type Props = { book: Book; featured?: boolean; featuredLabel?: string };

const COVER_GRADIENTS: Record<string, string> = {
  "001004008": "linear-gradient(145deg,#dfeade,#a9c6b4)",
  "001004009": "linear-gradient(145deg,#dceaf1,#9fc0d1)",
  "001004001": "linear-gradient(145deg,#eee5f4,#b9a6c9)",
  "001004002": "linear-gradient(145deg,#dfeef5,#9fc0d1)",
  "001004003": "linear-gradient(145deg,#f7e1d8,#e7b49f)",
  "001019": "linear-gradient(145deg,#e6ead9,#b3bb9c)",
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

export default function BookCard({ book, featured = false, featuredLabel = "今日の一冊" }: Props) {
  // 作家オーバーライド＋ラノベ判定を反映した実効ジャンルでラベルを出す（伊坂幸太郎→ミステリー / 無双系→ラノベ等）
  const genre = GENRES.find((g) => g.id === effectiveGenreOfBook(book));
  const azUrl = amazonUrl(book);
  const ebjUrl = ebookjapanUrl(book); // 提携設定が無ければ null＝ボタン非表示
  // 巻数付きタイトルなら「シリーズを全巻見る」導線を出す（Amazon検索＝アフィリンク）。
  const series = detectSeries(book.title);
  const seriesUrl = series ? amazonSearchUrl(series.base) : null;
  const href = azUrl; // 表紙画像クリックの飛び先＝Amazon（楽天は黒の楽天ボタンから）
  // お気に入り保存に必要な最小限の書誌（localStorageに入れる）
  const favBook = {
    isbn13: book.isbn13,
    isbn10: book.isbn10,
    title: book.title,
    author: book.author,
    image_url: book.image_url,
    genre_id: book.genre_id,
    rakuten_url: book.rakuten_url,
    amazon_url: azUrl,
  };

  if (featured) {
    return (
      <article
        className="relative grid featured-card"
        style={{
          background: "var(--bg-card)",
          borderRadius: "9px",
          boxShadow: "0 2px 12px rgba(61,53,48,0.08)",
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
          {featuredLabel}
        </div>

        {/* 書影 */}
        <div className="featured-cover self-start" style={{ position: "relative", borderRadius: "4px", overflow: "hidden", boxShadow: "0 10px 20px rgba(61,53,48,0.12)" }}>
          <FavoriteButton book={favBook} />
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
            {book.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={hiResCover(book.image_url) ?? undefined} alt={book.title} className="w-full object-cover" style={{ aspectRatio: "3/4" }} loading="lazy" />
            ) : (
              <CoverPlaceholder book={book} genre={genre} large />
            )}
          </a>
        </div>

        {/* 書誌（書影が高いので右側は縦中央寄せにして空白の偏りを防ぐ）
            min-w-0: グリッド列が内容の最小幅で広がってカードからはみ出すのを防ぐ */}
        <div className="flex flex-col justify-center min-w-0">
          <h3
            className="featured-title"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "27px",
              fontWeight: 500,
              lineHeight: 1.5,
              margin: "0 0 14px",
              color: "var(--text-main)",
            }}
          >
            <Link href={`/books/${book.isbn13}`} style={{ color: "inherit", textDecoration: "none" }}>
              {book.title}
            </Link>
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
          <div className="flex flex-wrap gap-3 pt-7">
            {book.rakuten_url && (
              <a href={book.rakuten_url} target="_blank" rel="noopener noreferrer sponsored"
                className="text-sm font-bold rounded-full py-2.5 px-4 text-center whitespace-nowrap transition-opacity hover:opacity-80"
                style={{ background: "#111", color: "#fff", textDecoration: "none", flex: "1 1 110px", minWidth: 0 }}>
                楽天ブックス
              </a>
            )}
            {ebjUrl && (
              <a href={ebjUrl} target="_blank" rel="noopener noreferrer sponsored"
                className="text-sm font-bold rounded-full py-2.5 px-4 text-center whitespace-nowrap transition-opacity hover:opacity-80"
                style={{ background: "#D7000F", color: "#fff", textDecoration: "none", flex: "1 1 110px", minWidth: 0 }}>
                ebookjapan
              </a>
            )}
            <a href={azUrl} target="_blank" rel="noopener noreferrer sponsored"
              className="text-sm font-bold rounded-full py-2.5 px-4 text-center whitespace-nowrap transition-opacity hover:opacity-80"
              style={{ background: "#ED8A22", color: "#fff", textDecoration: "none", flex: "1 1 110px", minWidth: 0 }}>
              Amazon
            </a>
          </div>
          {seriesUrl && (
            <a href={seriesUrl} target="_blank" rel="noopener noreferrer sponsored"
              className="text-sm font-bold mt-4 inline-block transition-opacity hover:opacity-80"
              style={{ color: "var(--highlight)", textDecoration: "none" }}>
              📚「{series!.base}」を全巻見る →
            </a>
          )}
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
        boxShadow: "0 2px 12px rgba(61,53,48,0.08)",
        padding: "18px 14px 22px",
      }}
    >
      <div style={{ position: "relative", borderRadius: "4px", overflow: "hidden" }}>
        <FavoriteButton book={favBook} />
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
          {book.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={hiResCover(book.image_url) ?? undefined} alt={book.title} className="w-full object-cover" style={{ aspectRatio: "3/4" }} loading="lazy" />
          ) : (
            <CoverPlaceholder book={book} genre={genre} />
          )}
        </a>
      </div>
      <h3
        className="line-clamp-3 card-title"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "15px",
          fontWeight: 500,
          lineHeight: 1.5,
          margin: "12px 0 8px",
          color: "var(--text-main)",
        }}
      >
        <Link
          href={`/books/${book.isbn13}`}
          style={{ color: "inherit", textDecoration: "none" }}
        >
          {book.title}
        </Link>
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
            className="flex-1 text-center text-xs font-bold rounded-full py-2 transition-opacity hover:opacity-80"
            style={{ background: "#111", color: "#fff", textDecoration: "none" }}>
            楽天
          </a>
        )}
        {ebjUrl && (
          <a href={ebjUrl} target="_blank" rel="noopener noreferrer"
            className="flex-1 text-center text-xs font-bold rounded-full py-2 transition-opacity hover:opacity-80"
            style={{ background: "#D7000F", color: "#fff", textDecoration: "none" }}>
            ebook
          </a>
        )}
        <a href={azUrl} target="_blank" rel="noopener noreferrer"
          className="flex-1 text-center text-xs font-bold rounded-full py-2 transition-opacity hover:opacity-80"
          style={{ background: "#ED8A22", color: "#fff", textDecoration: "none" }}>
          Amazon
        </a>
      </div>
      {seriesUrl && (
        <a href={seriesUrl} target="_blank" rel="noopener noreferrer sponsored"
          className="block text-xs font-bold mt-3 text-center transition-opacity hover:opacity-80"
          style={{ color: "var(--highlight)", textDecoration: "none" }}>
          📚 シリーズを全巻見る →
        </a>
      )}
    </article>
  );
}
