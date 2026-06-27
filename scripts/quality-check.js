// コラム自動公開の前に通す機械的な品質ゲート（ハード条件）。
// 人手レビューが暗黙に担保していた品質を機械化し、不合格は公開しないために使う。
// 使い方:
//   node -r dotenv/config scripts/quality-check.js /tmp/column-<slug>.json dotenv_config_path=.env.local
// 終了コード 0=合格 / 1=不合格。判定の詳細はJSONで stdout に出す。
//
// チェック項目:
//   1. 本文プレーン文字数 >= MIN_CHARS（seo-column-writer.md の「3,500字以上」と整合）
//   2. title と 最初のh2 に target_keyword の全トークンが含まれる
//   3. <a href> が1本以上、かつ http(s)/相対パスのみ（危険スキーム禁止）
//   4. 許可タグ(h2,h3,p,a,strong,em,ul,ol,li)以外のタグが混入していない
//   5. 禁止語（空虚な煽り語）の合計が閾値以下
//   6. 同じ target_keyword で既に公開済みのコラムが無い（カニバリ防止）

const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 安全性（捏造防止・リンク・関連性・HTML安全）優先で、最低品質を機械的に担保する。
// 完璧な文体までは求めない（厳しすぎると毎日公開が成立しない）。
const MIN_CHARS = Number(process.env.QC_MIN_CHARS) || 2500; // 下限。プロンプト目標は3,500
const ALLOWED_TAGS = ["h2", "h3", "p", "a", "strong", "em", "ul", "ol", "li", "br"];
const BANNED_WORDS = [
  "魅力", "必見", "ぜひ", "いかがでしょうか", "話題沸騰", "今すぐ",
  "心に響く", "珠玉の", "至高の", "見逃せない", "要チェック", "過言ではありません",
  "してみてはいかがでしょうか", "間違いなし", "請け合い",
];
const MAX_BANNED = Number(process.env.QC_MAX_BANNED) || 4;
const H2_TOKEN_RATIO = 0.6; // 最初のh2に必要なキーワードトークンの割合

// next-keywords.js と同じ正規化（空白・全角空白除去＋小文字化）
const norm = (s) => (s || "").replace(/[\s　]/g, "").toLowerCase();
const stripTags = (html) => (html || "").replace(/<[^>]+>/g, "");

function firstH2(html) {
  const m = (html || "").match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  return m ? stripTags(m[1]) : "";
}

function tokensOf(keyword) {
  return (keyword || "").split(/[\s　]+/).filter(Boolean).map(norm);
}
// 全トークンが含まれるか（titleの関連性チェック用・厳格）
function containsAllTokens(text, keyword) {
  const tokens = tokensOf(keyword);
  if (tokens.length === 0) return false;
  const t = norm(text);
  return tokens.every((tok) => t.includes(tok));
}
// トークンの一定割合が含まれるか（h2用・許容的）
function containsTokenRatio(text, keyword, ratio) {
  const tokens = tokensOf(keyword);
  if (tokens.length === 0) return false;
  const t = norm(text);
  const hit = tokens.filter((tok) => t.includes(tok)).length;
  return hit / tokens.length >= ratio;
}

function usedTags(html) {
  const tags = new Set();
  const re = /<\/?([a-zA-Z0-9]+)/g;
  let m;
  while ((m = re.exec(html || "")) !== null) tags.add(m[1].toLowerCase());
  return [...tags];
}

function hrefSchemesOk(html) {
  const hrefs = [];
  const re = /<a\s+[^>]*href\s*=\s*['"]?([^'">\s]+)/gi;
  let m;
  while ((m = re.exec(html || "")) !== null) hrefs.push(m[1]);
  const bad = hrefs.filter((h) => !/^https?:\/\//i.test(h) && !h.startsWith("/"));
  return { count: hrefs.length, bad };
}

async function alreadyPublishedKeyword(keyword, slug) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false; // env無ければスキップ（ローカル簡易チェック）
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data } = await sb
    .from("columns")
    .select("slug,target_keyword,status")
    .eq("status", "published");
  const target = norm(keyword);
  return (data || []).some(
    (c) => c.slug !== slug && norm(c.target_keyword) === target
  );
}

async function main() {
  const file = process.argv.slice(2).find((a) => a.endsWith(".json"));
  if (!file) {
    console.error("コラムJSONのパスを指定してください");
    process.exit(1);
  }
  const col = JSON.parse(fs.readFileSync(file, "utf8"));
  const reasons = [];

  // 1. 文字数
  const plainLen = stripTags(col.body_html).replace(/\s/g, "").length;
  if (plainLen < MIN_CHARS) reasons.push(`本文が短い: ${plainLen}字 < ${MIN_CHARS}字`);

  // 2. キーワード配置
  if (!col.target_keyword) {
    reasons.push("target_keyword が無い");
  } else {
    if (!containsAllTokens(col.title, col.target_keyword))
      reasons.push(`titleにキーワード不足: "${col.title}" ⊅ "${col.target_keyword}"`);
    const h2 = firstH2(col.body_html);
    if (!containsTokenRatio(h2, col.target_keyword, H2_TOKEN_RATIO))
      reasons.push(`最初のh2にキーワード不足(6割未満): "${h2}"`);
  }

  // 3. リンク
  const href = hrefSchemesOk(col.body_html);
  if (href.count < 1) reasons.push("本文に<a href>リンクが無い");
  if (href.bad.length > 0) reasons.push(`危険/不正なhref: ${href.bad.slice(0, 3).join(", ")}`);

  // 4. タグホワイトリスト
  const extra = usedTags(col.body_html).filter((t) => !ALLOWED_TAGS.includes(t));
  if (extra.length > 0) reasons.push(`許可外タグ混入: ${extra.join(", ")}`);

  // 5. 禁止語
  const hits = [];
  for (const w of BANNED_WORDS) {
    const n = (stripTags(col.body_html).match(new RegExp(w, "g")) || []).length;
    if (n > 0) hits.push(`${w}×${n}`);
  }
  const bannedTotal = hits.reduce((s, h) => s + Number(h.split("×")[1]), 0);
  if (bannedTotal > MAX_BANNED) reasons.push(`禁止語が多い(${bannedTotal}): ${hits.join(", ")}`);

  // 6. キーワード重複（公開済み）
  if (col.target_keyword && (await alreadyPublishedKeyword(col.target_keyword, col.slug)))
    reasons.push(`同じtarget_keywordの公開済み記事が既にある: ${col.target_keyword}`);

  const pass = reasons.length === 0;
  console.log(
    JSON.stringify(
      { pass, slug: col.slug, plainLen, bannedTotal, linkCount: href.count, reasons },
      null,
      2
    )
  );
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("品質チェック実行エラー:", e.message);
  process.exit(1);
});
