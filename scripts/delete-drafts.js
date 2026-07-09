// 読み取り専用ではない: 引数で渡したslugのdraftコラムを削除する（在庫の掃除用・一度きり）。
// 安全策: status='draft'のものだけ削除対象にする（誤って公開済みを消さないように）。
// 使い方: node scripts/delete-drafts.js <slug1> <slug2> ...
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const slugs = process.argv.slice(2);
  if (!SUPABASE_URL || !KEY) {
    console.error("env未設定");
    process.exit(1);
  }
  if (slugs.length === 0) {
    console.error("使い方: node scripts/delete-drafts.js <slug1> <slug2> ...");
    process.exit(1);
  }
  const sb = createClient(SUPABASE_URL, KEY);
  const { data, error } = await sb
    .from("columns")
    .delete()
    .in("slug", slugs)
    .eq("status", "draft")
    .select("slug,title");
  if (error) {
    console.error("削除エラー:", error.message);
    process.exit(1);
  }
  console.log(`削除件数: ${data.length}`);
  for (const d of data) console.log(`- ${d.slug} | ${d.title}`);
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
