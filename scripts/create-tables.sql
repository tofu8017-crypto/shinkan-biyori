-- Supabaseで実行するSQL
-- 新刊日和 booksテーブル定義

create table if not exists books (
  id              uuid primary key default gen_random_uuid(),
  isbn13          text not null unique,
  isbn10          text,
  title           text not null,
  author          text not null,
  publisher       text not null default '',
  published_date  date not null,
  genre_id        text not null,   -- 楽天ジャンルID（001004008など）
  image_url       text,
  rakuten_url     text,
  amazon_url      text,
  description     text,
  last_synced_at  timestamptz not null default now()
);

-- 発売日でよく絞り込むのでインデックスを張る
create index if not exists books_published_date_idx on books(published_date);
create index if not exists books_genre_id_idx       on books(genre_id);

-- Row Level Security（読み取りは誰でもOK）
alter table books enable row level security;
create policy "books_public_read" on books
  for select using (true);
