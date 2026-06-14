// コラムのアイキャッチ画像プール。public/columns/pool/ に置いた写真を並べる。
// 写真を増やしたいときは、ファイルを public/columns/pool/ に追加し、
// 下のリストにそのパスを1行足すだけでよい（記事ごとのバリエーションが増える）。
export const COLUMN_IMAGE_POOL = [
  "/columns/pool/01.jpg",
  "/columns/pool/02.jpg",
  "/columns/pool/03.jpg",
  "/columns/pool/04.jpg",
  "/columns/pool/05.jpg",
  "/columns/pool/06.jpg",
];

// slug（記事の識別名）から安定して1枚を選ぶ。
// 同じ記事は常に同じ写真／記事ごとに異なる写真になる（決定論的）。
export function pickColumnImage(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  const idx = hash % COLUMN_IMAGE_POOL.length;
  return COLUMN_IMAGE_POOL[idx];
}
