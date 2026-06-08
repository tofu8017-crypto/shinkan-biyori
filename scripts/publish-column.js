// コラムの公開状態を切り替える（下書き⇔公開）。
// 使い方: node -r dotenv/config scripts/publish-column.js <slug> [published|draft] dotenv_config_path=.env.local
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("dotenv_config"));
  const slug = args[0];
  const status = args[1] === "draft" ? "draft" : "published";

  if (!slug) {
    console.error("slugを指定してください。例: node ... scripts/publish-column.js my-slug published");
    process.exit(1);
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("env未設定（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）");
    process.exit(1);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const patch = {
    status,
    published_at: status === "published" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from("columns").update(patch).eq("slug", slug).select();

  if (error) {
    console.error("更新エラー:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.error("該当slugが見つかりません:", slug);
    process.exit(1);
  }
  console.log("✅ " + slug + " を " + status + " にしました");
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
