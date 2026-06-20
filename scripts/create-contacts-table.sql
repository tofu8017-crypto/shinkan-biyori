-- 問い合わせフォームの保存先テーブル。
-- SupabaseのSQL Editorに貼り付けて実行してください。
-- 挿入はサーバー側のサービスロールキー経由で行うため、RLSは有効のままで構いません
-- （匿名キーからは読み書きできない＝公開フォームでも内容が外から見えない）。
create table if not exists contacts (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text,
  message    text not null,
  created_at timestamptz not null default now()
);

alter table contacts enable row level security;
