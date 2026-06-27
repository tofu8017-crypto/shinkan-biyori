-- 新刊日和: グロース用テーブル（X半自動キット / SEO上書き / クリック計測）
-- Supabaseの SQL Editor に貼り付けて1回だけ実行する。
-- 既存 create-columns-table.sql と同じRLS方針：匿名は読めない、書き込みは service_role のみ。

-- ============================================================
-- 1) x_posts : X半自動キットが「素材として出した投稿」を記録する
--    目的は重複出しの防止。owner が実際に投稿したかは status で区別する。
--      status = 'queued'  … キットに出した（まだ貼ったか不明）
--      status = 'posted'  … owner が実際に投稿した（任意で更新）
--      status = 'skipped' … 出したが使わないと決めた
-- ============================================================
create table if not exists x_posts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,                 -- new_books_digest | spotlight | column_promo | opinion
  isbn13      text,                          -- 紹介した本（spotlight等）。digest/opinionはnull
  slug        text,                          -- 紹介したコラム（column_promo）
  content     text not null,                 -- 投稿本文（コピペした原稿）
  image_url   text,                          -- 添付候補のカード画像URL（任意）
  status      text not null default 'queued',-- queued | posted | skipped
  posted_at   timestamptz,                   -- 実際に投稿した日時（任意）
  created_at  timestamptz not null default now()
);

-- 「最近この本/コラムを出したか」を素早く引くためのインデックス
create index if not exists x_posts_isbn13_created_idx on x_posts (isbn13, created_at desc);
create index if not exists x_posts_kind_created_idx   on x_posts (kind, created_at desc);

alter table x_posts enable row level security;
-- 匿名ユーザーには一切公開しない（select ポリシーを作らない＝読めない）。
-- 書き込み・読み取りは service_role キーがRLSをバイパスして行う。


-- ============================================================
-- 2) seo_overrides : ページの title / description / 冒頭文を DB 側で上書きする
--    自律改善ループ（Phase 3）が順位11-30位ページの改善案をここに入れ、
--    ページ側が published 値より優先して表示する。
--      target_type = 'column' | 'book' | 'author' | 'series' | 'calendar'
--      target_key  = slug / isbn13 / author slug など、その種別の識別子
-- ============================================================
create table if not exists seo_overrides (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null,
  target_key   text not null,
  title        text,
  description  text,
  intro        text,
  note         text,                         -- なぜ変えたか（最適化ログ用メモ）
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (target_type, target_key)
);

create index if not exists seo_overrides_target_idx on seo_overrides (target_type, target_key);

alter table seo_overrides enable row level security;
-- 公開ページ(anonキー)からも読めるようにする（上書き表示に使うため）。書き込みは service_role のみ。
drop policy if exists "public read seo_overrides" on seo_overrides;
create policy "public read seo_overrides"
  on seo_overrides for select
  using (true);


-- ============================================================
-- 3) click_events : 楽天/Amazon ボタンのクリックを記録（A-11・任意）
--    /stats の「クリック数推移」用。今は土台だけ作っておく。
-- ============================================================
create table if not exists click_events (
  id          uuid primary key default gen_random_uuid(),
  isbn13      text,
  store       text,                          -- rakuten | amazon
  page        text,                          -- どのページからか（/column/<slug> 等）
  created_at  timestamptz not null default now()
);

create index if not exists click_events_created_idx on click_events (created_at desc);

alter table click_events enable row level security;
-- クライアントからの記録は将来 /app/api/track 経由で service_role で行う想定。
-- いまは匿名の読み書きを許可しない（ポリシー未作成）。
