// コラム（記事）1件分の型。Supabaseの "columns" テーブルのカラムに対応する。
// テキストは string、NULL許容のカラムは string | null とする（types/book.ts のBookに倣う）
export type Column = {
  id: string
  slug: string
  title: string
  body_html: string             // 記事本文（HTML文字列）
  excerpt: string | null        // 概要・抜粋
  target_keyword: string | null // SEO狙いキーワード
  genre_id: string | null       // 関連ジャンル
  hero_image_url: string | null // アイキャッチ画像URL
  status: string                // "draft" | "published"
  published_at: string | null   // 公開日時（ISOタイムスタンプ）
  created_at: string
  updated_at: string
}
