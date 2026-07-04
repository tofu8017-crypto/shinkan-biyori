// Amazonアソシエイト・リンク生成
// タグ(shinkanbiyori-22)はURLに載る公開情報なので定数で保持する。
// 変更したくなったらこの1か所だけ直せばサイト全体に反映される。
export const AMAZON_ASSOCIATE_TAG = "shinkanbiyori-22";

const COMIC_GENRE_ID = "001001";

type AmazonLinkable = {
  isbn10: string | null;
  isbn13: string;
  title: string;
  genre_id?: string;
};

/**
 * 書籍からAmazonのアフィリエイトURLを組み立てる。
 * コミックは /dp/ が存在しないケースが多いため常にISBN13検索URLを使う。
 * それ以外は isbn10 → /dp/ で直リンク、なければ isbn13 検索にフォールバック。
 */
export function amazonUrl(book: AmazonLinkable): string {
  if (book.genre_id === COMIC_GENRE_ID) {
    const q = encodeURIComponent(book.isbn13 || book.title);
    return `https://www.amazon.co.jp/s?k=${q}&tag=${AMAZON_ASSOCIATE_TAG}`;
  }
  if (book.isbn10) {
    return `https://www.amazon.co.jp/dp/${book.isbn10}?tag=${AMAZON_ASSOCIATE_TAG}`;
  }
  // フォールバック検索。楽天専売のサイン本等は isbn13 が楽天内部コード(21000…)で
  // 本物のISBN(978/979始まり)ではないため、検索してもAmazonでヒットしない。
  // その場合はタイトル（【サイン本】などの括弧書きを除いた本体）で検索する。
  const isRealIsbn = /^97[89]\d{10}$/.test(book.isbn13 || "");
  const cleanTitle = (book.title || "").replace(/[【〔（(\[].*?[】〕）)\]]/g, "").trim();
  const q = encodeURIComponent(isRealIsbn ? book.isbn13 : cleanTitle || book.title);
  return `https://www.amazon.co.jp/s?k=${q}&tag=${AMAZON_ASSOCIATE_TAG}`;
}

/** 任意の語句でAmazonを検索するアフィリエイトURL（シリーズ全巻導線などに使う）。 */
export function amazonSearchUrl(query: string): string {
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(query)}&tag=${AMAZON_ASSOCIATE_TAG}`;
}
