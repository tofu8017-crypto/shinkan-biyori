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
  const q = encodeURIComponent(book.isbn13 || book.title);
  return `https://www.amazon.co.jp/s?k=${q}&tag=${AMAZON_ASSOCIATE_TAG}`;
}
