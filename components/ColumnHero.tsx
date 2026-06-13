import { GENRES } from "@/types/book";

// コラムのアイキャッチ（ヘッダー画像）。
// 画像生成の仕組みが無いため外部画像ファイルには依存せず、
// ジャンル色から作るグラデーションのバナーを表示する。
// これにより画像ファイル欠落による「壊れた画像」が出ない。

const GRADIENTS: Record<string, string> = {
  "001004008": "linear-gradient(135deg,#dfeade,#a9c6b4)",
  "001004009": "linear-gradient(135deg,#dceaf1,#9fc0d1)",
  "001004001": "linear-gradient(135deg,#eee5f4,#b9a6c9)",
  "001004002": "linear-gradient(135deg,#dfeef5,#9fc0d1)",
  "001004003": "linear-gradient(135deg,#f7e1d8,#e7b49f)",
  "001019": "linear-gradient(135deg,#e6ead9,#b3bb9c)",
  "001006": "linear-gradient(135deg,#efe7cf,#cdbb8e)",
};

type Props = {
  title: string;
  genreId?: string | null;
  /** list: 一覧カード用の小さめ / detail: 記事ページ用の大きめ */
  variant?: "list" | "detail";
};

export default function ColumnHero({ title, genreId, variant = "list" }: Props) {
  const bg = (genreId && GRADIENTS[genreId]) || "linear-gradient(135deg,#e9efe6,#bcd2c4)";
  const genre = GENRES.find((g) => g.id === genreId);
  const isDetail = variant === "detail";

  return (
    <div
      className="relative w-full flex items-end overflow-hidden"
      style={{
        height: isDetail ? "260px" : "150px",
        background: bg,
        padding: isDetail ? "28px" : "16px",
      }}
    >
      {/* 白の光沢でアイキャッチらしさを出す */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 25% 20%, rgba(255,255,255,0.45), transparent 45%)",
        }}
      />
      <div className="relative">
        {genre && (
          <span
            className="inline-block text-xs font-bold mb-2"
            style={{
              borderRadius: "999px",
              background: "rgba(255,255,255,0.6)",
              color: "var(--text-sub)",
              padding: "2px 12px",
            }}
          >
            {genre.label}
          </span>
        )}
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: isDetail ? "26px" : "16px",
            fontWeight: 600,
            lineHeight: 1.5,
            color: "rgba(61,53,48,0.85)",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: isDetail ? 3 : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </p>
      </div>
    </div>
  );
}
