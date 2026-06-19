export type Genre =
  | "001004008" // 日本文学
  | "001004009" // 海外小説
  | "001004001" // ミステリー
  | "001004002" // SF・ホラー・ファンタジー
  | "001004003" // エッセイ
  | "001017"    // ライトノベル
  | "001001"    // コミック
  | "001019"    // 文庫
  | "001006"    // ビジネス・実用書
  | "jidai"     // 歴史・時代小説（楽天ジャンルではなくキーワード分類の派生ジャンル）
  | "adult"     // 成人向け小説（同上）

// label: 書籍カードのジャンルチップやジャンルページ見出しに使う正式名
// short: ヘッダーのタブ表示用の短い名前（無ければlabelを使う）
// 注: "jidai" / "adult" は楽天のジャンルIDではなく、当サイト独自の派生ジャンル。
//     genre-classify.ts のキーワード判定で小説プールから抽出する。
export const GENRES: { id: Genre; label: string; color: string; short?: string }[] = [
  { id: "001004008", label: "日本文学",     color: "#B8D4C4" },
  { id: "001004009", label: "海外小説",     color: "#D4C8B8" },
  { id: "001004001", label: "ミステリー",   color: "#C8B8D4" },
  { id: "001004002", label: "SF・ホラー・ファンタジー", color: "#B8C8D4", short: "SF・FT" },
  { id: "jidai",     label: "歴史・時代小説", color: "#CDBBA0", short: "時代小説" },
  { id: "001004003", label: "エッセイ",     color: "#E8C4B8" },
  { id: "001017",    label: "ライトノベル", color: "#D4B8C8", short: "ラノベ" },
  { id: "adult",     label: "成人向け小説", color: "#C9A0A8", short: "成人向け" },
  { id: "001001",    label: "コミック",     color: "#B8C4D4" },
  { id: "001019",    label: "文庫",         color: "#C4C9B8" },
  { id: "001006",    label: "ビジネス・実用書", color: "#D8C99A", short: "ビジネス" },
]

// ラノベの判定で使う「文芸の小説ジャンル」。これらに入っていても
// is-light-novel 判定に当たればラノベ扱いにして 小説（日本）等から外す。
export const RANOBE_GENRE_ID = "001017";

export type Book = {
  id: string
  isbn13: string
  isbn10: string | null
  title: string
  author: string
  publisher: string
  published_date: string      // YYYY-MM-DD
  genre_id: Genre
  image_url: string | null
  rakuten_url: string | null
  amazon_url: string | null
  description: string | null  // openBDの内容紹介を要約したもの
  last_synced_at: string
}
