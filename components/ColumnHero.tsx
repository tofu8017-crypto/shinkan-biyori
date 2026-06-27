import { GENRES } from "@/types/book";
import { pickColumnImage } from "@/lib/column-images";

// コラムのアイキャッチ。記事ごとに public/columns/pool/ のプールから
// slugで安定して1枚を選んで表示し、左下に小さなジャンルラベルを重ねる。
// 写真は自サイト保存なので壊れない。グラデーション/光沢のテンプレ感は排除。

const ACCENTS: Record<string, string> = {
  "001004008": "#7FA68C",
  "001004009": "#B89F73",
  "001004001": "#9683AE",
  "001004002": "#7C9BB5",
  "001004003": "#C98C6E",
  "001019": "#8A936F",
  "001006": "#B59B5E",
};

type Props = {
  /** 記事の識別名。これを元に表示する写真を決める */
  slug: string;
  genreId?: string | null;
  /** DBに保存されたアイキャッチURL。指定があればプール画像より優先 */
  heroImageUrl?: string | null;
  /** list: 一覧カード用 / detail: 記事ページ用（大きめ） */
  variant?: "list" | "detail";
};

export default function ColumnHero({ slug, genreId, heroImageUrl, variant = "list" }: Props) {
  const genre = GENRES.find((g) => g.id === genreId);
  const accent = (genreId && ACCENTS[genreId]) || "#9c8f86";
  const isDetail = variant === "detail";
  const src = heroImageUrl || pickColumnImage(slug);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: isDetail ? "300px" : "168px" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={genre ? `${genre.label}のコラム` : "コラム"}
        className="w-full h-full object-cover"
      />
      {/* 下部の暗いスクリム（ラベルの可読性確保） */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)" }}
      />
      {genre && (
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
      )}
    </div>
  );
}
