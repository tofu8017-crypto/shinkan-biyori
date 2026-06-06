// Amazonアソシエイト・リンク生成
// タグ(shinkanbiyori-22)はURLに載る公開情報なので定数で保持する。
// 変更したくなったらこの1か所だけ直せばサイト全体に反映される。
export const AMAZON_ASSOCIATE_TAG = "shinkanbiyori-22";

type AmazonLinkable = {
  isbn10: string | null;
  isbn13: string;
  title: string;
};

/**
 * 書籍からAmazonのアフィリエイトURLを組み立てる。
 * 書籍のASINはISBN-10と一致するため /dp/{ISBN-10} で商品ページに直リンクできる。
 * ISBN-10が無い場合はISBN-13（なければタイトル）で検索リンクにフォールバックする。
 */
export function amazonUrl(book: AmazonLinkable): string {
  if (book.isbn10) {
    return `https://www.amazon.co.jp/dp/${book.isbn10}?tag=${AMAZON_ASSOCIATE_TAG}`;
  }
  const q = encodeURIComponent(book.isbn13 || book.title);
  return `https://www.amazon.co.jp/s?k=${q}&tag=${AMAZON_ASSOCIATE_TAG}`;
}
