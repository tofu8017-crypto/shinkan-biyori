// data/seo-keywords.json から「まだ記事化していない、狙い目のキーワード」を返す。
// 既存コラムの target_keyword と重複しないものだけを、ボリューム高×難易度低の順に出す。
// → 1記事1キーワードを割り当てれば、キーワードのカニバリ（共食い）を構造的に防げる。
// 使い方: node scripts/next-keywords.js [件数] [最大KD]
//   例: node scripts/next-keywords.js 6 35
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const N = Number(process.argv[2]) || 8;
const MAX_KD = Number(process.argv[3]) || 35;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const norm = (s) => (s || "").replace(/[\s　]/g, "").toLowerCase();

async function main() {
  const keywords = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "seo-keywords.json"), "utf8")
  );

  const used = new Set();
  if (SUPABASE_URL && SUPABASE_KEY) {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await sb.from("columns").select("target_keyword");
    for (const c of data || []) if (c.target_keyword) used.add(norm(c.target_keyword));
  }

  const candidates = keywords
    .filter((k) => k.keyword && k.volume > 0 && k.kd <= MAX_KD)
    .filter((k) => !used.has(norm(k.keyword)))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, N);

  console.log(JSON.stringify(candidates, null, 1));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
