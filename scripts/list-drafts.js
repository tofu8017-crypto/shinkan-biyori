// 読み取り専用: draft状態のコラム一覧を表示する（在庫の棚卸し用）。
// 使い方: node scripts/list-drafts.js
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// build-x-kit.js/auto-generate.jsと同じラノベ検出（在庫の中に旧フィルタ漏れが無いか見る用）
const LN_RE = /異世界|転生|転移|令嬢|公爵|侯爵|伯爵|婚約|聖女|勇者|魔王|魔導|スキル|チート|最強|追放|ハーレム|ヤンデレ|ダンジョン|迷宮|攻略|冒険者|辺境|領地|王太子|王女|騎士団|召喚|やり直し|無職|無双|モブ|な件|ざまぁ|二度目|スローライフ|悪役|ギルド|レベル|奴隷|VRMMO|ステータス|側妃|竜帝|世継ぎ|寵愛|嫁いで/;
const stripTags = (h) => (h || "").replace(/<[^>]+>/g, "").replace(/\s/g, "");

async function main() {
  if (!SUPABASE_URL || !KEY) {
    console.error("env未設定");
    process.exit(1);
  }
  const sb = createClient(SUPABASE_URL, KEY);
  const { data, error } = await sb
    .from("columns")
    .select("slug,title,target_keyword,body_html,created_at")
    .eq("status", "draft")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("取得エラー:", error.message);
    process.exit(1);
  }
  console.log(`draft総数: ${data.length}件\n`);
  for (const c of data) {
    const len = stripTags(c.body_html).length;
    const ln = LN_RE.test(c.title) || LN_RE.test(c.target_keyword || "") ? " [ラノベ疑い]" : "";
    console.log(`- ${c.created_at.slice(0, 16)} | ${len}字 | ${c.title}${ln}`);
    console.log(`  slug=${c.slug} / KW=${c.target_keyword}`);
  }
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
