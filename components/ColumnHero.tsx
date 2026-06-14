import { GENRES } from "@/types/book";

// コラムのアイキャッチ。画像生成の仕組みが無いため画像ファイルに依存せず、
// 「紙面（編集）」を思わせるミニマルな見出しブロックで代替する。
// 派手な2色グラデーション・光沢は使わず（テンプレ/AIっぽさを避ける）、
// クリーム地＋ジャンル色は細いアクセント（ラベルと罫線）だけに留める。

// ジャンルごとの差し色（彩度を抑えた一色。背景の極薄ティントと罫線に使う）
const ACCENTS: Record<string, string> = {
  "001004008": "#7FA68C", // 小説（日本）緑
  "001004009": "#B89F73", // 小説（海外）金茶
  "001004001": "#9683AE", // ミステリー 紫
  "001004002": "#7C9BB5", // SF・ホラー 青
  "001004003": "#C98C6E", // エッセイ 橙
  "001019": "#8A936F", // 文庫
  "001006": "#B59B5E", // ビジネス
};

type Props = {
  title: string;
  genreId?: string | null;
  /** list: 一覧カード用 / detail: 記事ページ用 */
  variant?: "list" | "detail";
};

export default function ColumnHero({ title, genreId, variant = "list" }: Props) {
  const accent = (genreId && ACCENTS[genreId]) || "#9c8f86";
  const genre = GENRES.find((g) => g.id === genreId);
  const isDetail = variant === "detail";

  return (
    <div
      style={{
        height: isDetail ? "220px" : "150px",
        // 紙のような微妙な縦グラデ（ほぼ無地・差し色の極薄ティントだけ）
        background: `linear-gradient(180deg, #FBF8F3 0%, ${accent}14 100%)`,
        borderBottom: `2px solid ${accent}`,
        padding: isDetail ? "30px 32px" : "18px 20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: isDetail ? "center" : "flex-start",
      }}
    >
      {genre && (
        <div className="flex items-center gap-2" style={{ marginBottom: isDetail ? "14px" : "10px" }}>
          {/* 小さな差し色の罫（ブックマーク風） */}
          <span style={{ display: "inline-block", width: "14px", height: "2px", background: accent }} />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: accent,
            }}
          >
            {genre.label}
          </span>
        </div>
      )}
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: isDetail ? "26px" : "16px",
          fontWeight: 600,
          lineHeight: 1.6,
          letterSpacing: "0.02em",
          color: "var(--text-main)",
          margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: isDetail ? 3 : 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {title}
      </p>
    </div>
  );
}
