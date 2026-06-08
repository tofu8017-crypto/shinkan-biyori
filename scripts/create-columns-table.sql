-- 新刊日和: コラム（記事）テーブル
-- Supabaseの SQL Editor に貼り付けて実行する。
-- 本文はHTMLで保存（執筆スクリプトが生成）。公開はstatus='published'のみ。

create table if not exists columns (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,        -- URL用（例: osusume-mystery-2026-06）
  title         text not null,               -- 記事タイトル
  body_html     text not null,               -- 本文（HTML）
  excerpt       text,                        -- 抜粋（meta description / 一覧の説明）
  target_keyword text,                       -- 狙ったキーワード（ラッコ由来）
  genre_id      text,                        -- 関連ジャンル（任意）
  hero_image_url text,                       -- アイキャッチ画像URL（任意）
  status        text not null default 'draft', -- draft（下書き） | published（公開）
  published_at  timestamptz,                 -- 公開日時
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 公開記事を新しい順で引くためのインデックス
create index if not exists columns_status_published_at_idx
  on columns (status, published_at desc);

-- 行レベルセキュリティ：匿名ユーザーは「公開済み」だけ読める
alter table columns enable row level security;

drop policy if exists "public read published columns" on columns;
create policy "public read published columns"
  on columns for select
  using (status = 'published');

-- 執筆スクリプトは service_role キーで insert するためRLSをバイパスして下書き保存できる。
