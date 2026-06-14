import { GENRES } from "@/types/book";

// コラムのジャンル見出しタグ。以前は大きなグラデーション帯だったが、
// テンプレ/AIっぽさを避けるため、差し色の小さな罫＋ジャンル名だけの
// 控えめな見出しに変更（カード/記事の上部に置く）。

const ACCENTS: Record<string, string> = {
  "001004008": "#7FA68C", // 小説（日本）
  "001004009": "#B89F73", // 小説（海外）
  "001004001": "#9683AE", // ミステリー
  "001004002": "#7C9BB5", // SF・ホラー
  "001004003": "#C98C6E", // エッセイ
  "001019": "#8A936F", // 文庫
  "001006": "#B59B5E", // ビジネス
};

type Props = {
  genreId?: string | null;
  /** list: 一覧カード用 / detail: 記事ページ用（やや大きめ） */
  variant?: "list" | "detail";
  /** タイトルは互換のため受け取るが表示しない（重複防止） */
  title?: string;
};

export default function ColumnHero({ genreId, variant = "list" }: Props) {
  const accent = (genreId && ACCENTS[genreId]) || "#9c8f86";
  const genre = GENRES.find((g) => g.id === genreId);
  if (!genre) return null;
  const isDetail = variant === "detail";

  return (
    <div className="flex items-center gap-2">
      <span style={{ display: "inline-block", width: "16px", height: "2px", background: accent }} />
      <span
        style={{
          fontSize: isDetail ? "13px" : "11px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: accent,
        }}
      >
        {genre.label}
      </span>
    </div>
  );
}
