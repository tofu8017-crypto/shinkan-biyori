// コラムをSupabaseのcolumnsテーブルに保存（slugで上書きupsert）。
// service_roleキーで実行するためRLSをバイパスして下書き保存できる。
// 使い方: node -r dotenv/config scripts/save-column.js path/to/column.json dotenv_config_path=.env.local
// column.json: { slug, title, body_html, excerpt?, target_keyword?, genre_id?, hero_image_url?, status? }
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const file = process.argv.slice(2).find((a) => a.endsWith(".json"));
  if (!file) {
    console.error("コラムJSONファイルのパスを指定してください");
    process.exit(1);
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("env未設定（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）");
    process.exit(1);
  }

  const col = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!col.slug || !col.title || !col.body_html) {
    console.error("slug / title / body_html は必須です");
    process.exit(1);
  }

  const status = col.status === "published" ? "published" : "draft";
  const row = {
    slug: col.slug,
    title: col.title,
    body_html: col.body_html,
    excerpt: col.excerpt ?? null,
    target_keyword: col.target_keyword ?? null,
    genre_id: col.genre_id ?? null,
    hero_image_url: col.hero_image_url ?? null,
    status,
    published_at: status === "published" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await sb
    .from("columns")
    .upsert(row, { onConflict: "slug" })
    .select();

  if (error) {
    console.error("保存エラー:", error.message);
    process.exit(1);
  }
  console.log("✅ 保存完了: slug=" + data[0].slug + " / status=" + data[0].status);
  console.log("   URL: https://shinkanbiyori.com/column/" + data[0].slug);
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
