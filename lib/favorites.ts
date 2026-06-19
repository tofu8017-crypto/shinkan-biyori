// お気に入り（localStorage 保存）。ログイン不要・端末ごと・キャッシュ(サイトデータ)を
// クリアするまで保持される。表示に必要な最小限の書誌だけを保存し、お気に入り一覧は
// サーバーに問い合わせず localStorage だけで描画できるようにする。

export type FavBook = {
  isbn13: string;
  isbn10: string | null;
  title: string;
  author: string;
  image_url: string | null;
  genre_id: string;
  rakuten_url: string | null;
  amazon_url: string | null;
};

const KEY = "shinkanbiyori:favorites";
// お気に入りが変わったとき各コンポーネントへ知らせるイベント名
export const FAVORITES_EVENT = "shinkanbiyori-favorites-changed";

function read(): FavBook[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FavBook[]) : [];
  } catch {
    return [];
  }
}

function write(list: FavBook[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(FAVORITES_EVENT));
  } catch {
    // 容量超過やプライベートモードでは黙って諦める
  }
}

export function getFavorites(): FavBook[] {
  return read();
}

export function isFavorite(isbn13: string): boolean {
  return read().some((b) => b.isbn13 === isbn13);
}

// お気に入りを切り替え、切り替え後の状態（true=登録済み）を返す。
export function toggleFavorite(book: FavBook): boolean {
  const list = read();
  const idx = list.findIndex((b) => b.isbn13 === book.isbn13);
  if (idx >= 0) {
    list.splice(idx, 1);
    write(list);
    return false;
  }
  list.unshift(book); // 新しく入れたものを先頭へ
  write(list);
  return true;
}
