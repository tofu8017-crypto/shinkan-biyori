// DeepSeek API で「はてなブログ用のナカノ記事」を生成する（Claudeのトークンを使わない執筆役）。
// テーマJSON（keyword/angle/internal_links）を渡すと、ナカノ文体の記事JSONを返し、
// 指定パス（既定 /tmp/hatena-article.json）に保存する。
//
// 使い方:
//   DEEPSEEK_API_KEY=... node scripts/write-hatena-deepseek.js <テーマJSONのパス> [出力JSONのパス]
//
// テーマJSON 例:
//   { "keyword": "海外文学 入門 最初の一冊",
//     "angle": "代表作から入るべき、という主張",
//     "internal_links": ["https://shinkanbiyori.com/genre/001004009", "https://shinkanbiyori.com/column", "https://shinkanbiyori.com"] }

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

async function main() {
  if (!API_KEY) {
    console.error("環境変数 DEEPSEEK_API_KEY が未設定です。");
    process.exit(1);
  }
  const themePath = process.argv[2];
  const outPath = process.argv[3] || "/tmp/hatena-article.json";
  if (!themePath) {
    console.error("使い方: node scripts/write-hatena-deepseek.js <テーマJSONのパス> [出力JSONのパス]");
    process.exit(1);
  }
  const theme = JSON.parse(fs.readFileSync(themePath, "utf8"));
  if (!theme.keyword || !Array.isArray(theme.internal_links)) {
    console.error("テーマJSONに keyword と internal_links(配列) が必要です。");
    process.exit(1);
  }

  const systemPrompt = fs.readFileSync(
    path.join(__dirname, "prompts", "hatena-nakano-writer.md"),
    "utf8"
  );

  const userMessage =
    "以下のテーマで、ルールに沿ったはてな記事JSONを1つ返してください。\n" +
    "internal_links のうち2〜3本を本文に自然に張ってください。\n\n" +
    "```json\n" +
    JSON.stringify(theme, null, 2) +
    "\n```";

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 8000,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error(`DeepSeek APIエラー: ${res.status} ${t.slice(0, 300)}`);
    process.exit(1);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error("DeepSeekの応答が空でした。");
    process.exit(1);
  }

  let article;
  try {
    article = JSON.parse(content);
  } catch (e) {
    console.error("DeepSeek応答のJSONパースに失敗:", e.message);
    console.error(content.slice(0, 400));
    process.exit(1);
  }

  // 最低限のバリデーション
  const errs = [];
  if (!article.title || article.title.length > 40) errs.push("title が無い/長すぎる");
  if (!article.body_markdown || article.body_markdown.length < 1100) errs.push(`body_markdown が短すぎる(${article.body_markdown ? article.body_markdown.length : 0}字 / 1100字以上必要)`);
  if (/^#\s/.test(article.body_markdown || "")) errs.push("本文先頭にH1(#)がある（タイトルは別管理なので不要）");
  // 本文に新刊日和リンクが2本以上あるか
  const linkCount = (article.body_markdown.match(/shinkanbiyori\.com/g) || []).length;
  if (linkCount < 2) errs.push(`本文中の新刊日和リンクが${linkCount}本（2〜3本必要）`);
  if (errs.length) {
    console.error("生成記事の検証に失敗:\n - " + errs.join("\n - "));
    process.exit(2);
  }

  if (!Array.isArray(article.categories) || article.categories.length === 0) {
    article.categories = ["読書"];
  }
  fs.writeFileSync(outPath, JSON.stringify(article, null, 2), "utf8");
  console.log(outPath);
}

main().catch((e) => {
  console.error("予期せぬエラー:", e);
  process.exit(1);
});
