-- ============================================================
-- books に価格カラムを追加する（2026-09-30）
--
-- 目的: 書籍ページに価格を表示し、Product構造化データ（商品スニペット）で
--       通常の検索結果に価格を出せるようにする。
--       ショッピングタブ／販売者リスティングはアフィリエイトサイトのため対象外だが、
--       「商品スニペット」はGoogleが「ユーザーが商品を直接購入できない商品ページ」用と
--       明記している正規の道。 https://developers.google.com/search/docs/appearance/structured-data/product
--
-- price は楽天APIの itemPrice（税込・円）をそのまま入れる。
-- 更新時刻は既存の last_synced_at を使い回すので新しいカラムは足さない。
--
-- 実行方法: Supabaseダッシュボード → SQL Editor にこのファイルの中身を貼って Run
-- 何度実行しても安全（if not exists）。
-- ============================================================

alter table books add column if not exists price integer;

-- 確認用（実行すると price カラムが増えているのが見える）
-- select isbn13, title, price from books order by published_date desc limit 5;
