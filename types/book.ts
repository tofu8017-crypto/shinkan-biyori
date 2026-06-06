export type Genre =
  | "001004008" // 小説（日本）
  | "001004009" // 小説（海外）
  | "001004001" // ミステリー
  | "001004002" // SF・ホラー
  | "001004003" // エッセイ
  | "001006"    // ビジネス・実用書

export const GENRES: { id: Genre; label: string; color: string }[] = [
  { id: "001004008", label: "小説（日本）", color: "#B8D4C4" },
  { id: "001004009", label: "小説（海外）", color: "#D4C8B8" },
  { id: "001004001", label: "ミステリー",  color: "#C8B8D4" },
  { id: "001004002", label: "SF・ホラー",  color: "#B8C8D4" },
  { id: "001004003", label: "エッセイ",    color: "#E8C4B8" },
  { id: "001006",    label: "ビジネス・実用書", color: "#D8C99A" },
]

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
