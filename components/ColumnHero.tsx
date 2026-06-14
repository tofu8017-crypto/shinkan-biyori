import { GENRES } from "@/types/book";

// コラムのアイキャッチ。ジャンルに合わせた実写の無料写真（public/columns/<genreId>.jpg、
// Unsplashライセンス・自サイト保存で壊れない）を見出し画像として表示し、
// 左下に小さなジャンルラベルを重ねる。グラデーション/光沢のテンプレ感を排した編集的な体裁。

const ACCENTS: Record<string, string> = {
  "001004008": "#7FA68C",
  "001004009": "#B89F73",
  "001004001": "#9683AE",
  "001004002": "#7C9BB5",
  "001004003": "#C98C6E",
  "001019": "#8A936F",
  "001006": "#B59B5E",
};

// 画像を用意しているジャンルID（無いIDは画像を出さず何も表示しない）
const HAS_IMAGE = new Set(Object.keys(ACCENTS));

type Props = {
  genreId?: string | null;
  /** list: 一覧カード用 / detail: 記事ページ用（大きめ） */
  variant?: "list" | "detail";
  /** 互換のため受け取るが未使用 */
  title?: string;
};

export default function ColumnHero({ genreId, variant = "list" }: Props) {
  const genre = GENRES.find((g) => g.id === genreId);
  if (!genre || !genreId || !HAS_IMAGE.has(genreId)) return null;
  const accent = ACCENTS[genreId];
  const isDetail = variant === "detail";

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: isDetail ? "300px" : "168px" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/columns/${genreId}.jpg`}
        alt={`${genre.label}のコラム`}
        className="w-full h-full object-cover"
      />
      {/* 下部に向けた暗いスクリム（ラベルの可読性確保） */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)" }}
      />
      <span
        className="absolute font-bold"
        style={{
          left: isDetail ? "20px" : "14px",
          bottom: isDetail ? "16px" : "12px",
          fontSize: isDetail ? "13px" : "11px",
          letterSpacing: "0.08em",
          color: "#fff",
          borderLeft: `3px solid ${accent}`,
          paddingLeft: "8px",
        }}
      >
        {genre.label}
      </span>
    </div>
  );
}
