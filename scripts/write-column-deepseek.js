// DeepSeek API でコラム本文を生成する（Claudeのトークンを使わない執筆役）。
// column-writer スキルが集めた「素材JSON」を渡すと、SEOペルソナのプロンプトで
// 記事JSON(slug/title/body_html/excerpt/target_keyword/genre_id/status)を返し、
// /tmp/column-<slug>.json に保存する。保存後は既存の save-column.js でDBへ。
//
// 使い方:
//   DEEPSEEK_API_KEY=... node scripts/write-column-deepseek.js <素材JSONのパス>
//   （素材JSONの形は下の REQUIRED 参照）
//
// 素材JSON 例:
//   {
//     "target_keyword": "ミステリー 新刊 おすすめ",
//     "genre_id": "001004001",
//     "suggests": ["...", "..."],            // 任意: Googleサジェスト等
//     "books": [                              // 取り上げる本（資料はそのまま渡す）
//       { "title": "...", "author": "...", "publisher": "...", "label": "...",
//         "published_date": "2026-07-01", "price": "...", "isbn13": "...",
//         "amazon_url": "...", "rakuten_url": "...", "summary": "openBD等の内容紹介",
//         "author_facts": "著者の過去作・受賞歴など（無ければ『未確認』）" }
//     ]
//   }

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

async function main() {
  if (!API_KEY) {
    console.error("環境変数 DEEPSEEK_API_KEY が未設定です。.env.local に追加してください。");
    process.exit(1);
  }
  const materialsPath = process.argv[2];
  if (!materialsPath) {
    console.error("使い方: node scripts/write-column-deepseek.js <素材JSONのパス>");
    process.exit(1);
  }
  const materials = JSON.parse(fs.readFileSync(materialsPath, "utf8"));
  if (!materials.target_keyword || !materials.genre_id || !Array.isArray(materials.books)) {
    console.error("素材JSONに target_keyword / genre_id / books(配列) が必要です。");
    process.exit(1);
  }

  const systemPrompt = fs.readFileSync(
    path.join(__dirname, "prompts", "seo-column-writer.md"),
    "utf8"
  );

  // 任意: Geminiファクトチェックの指摘（第2引数のファイル）を渡されたら、修正指示として足す。
  const reviseNotePath = process.argv[3];
  let reviseNote = "";
  if (reviseNotePath && fs.existsSync(reviseNotePath)) {
    const note = fs.readFileSync(reviseNotePath, "utf8").trim();
    if (note) {
      reviseNote =
        "\n\n【前回の記事に次の指摘がありました。素材の事実だけを使って必ず直してください】\n" +
        note +
        "\n（素材に無い固有名詞・数値・主張は書かない。AI臭い定型句は避ける。）";
    }
  }

  const userMessage =
    "以下の素材だけを使って、ルールに沿ったコラムJSONを1つ返してください。\n\n" +
    "```json\n" +
    JSON.stringify(materials, null, 2) +
    "\n```" +
    reviseNote;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      // v4-flashは既定で思考ONなので、旧deepseek-chat相当（非思考）に戻す。max_tokensを思考に食われないため。
      thinking: { type: "disabled" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
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
  } catch {
    console.error("DeepSeekの出力がJSONとして解釈できませんでした。出力先頭:\n" + content.slice(0, 300));
    process.exit(1);
  }

  // 最低限の検証＋既定値の補完
  for (const key of ["slug", "title", "body_html", "excerpt"]) {
    if (!article[key] || typeof article[key] !== "string") {
      console.error(`生成結果に ${key} がありません。`);
      process.exit(1);
    }
  }
  article.target_keyword = article.target_keyword || materials.target_keyword;
  article.genre_id = article.genre_id || materials.genre_id;
  article.status = "draft";
  article.slug = article.slug.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").toLowerCase();
  article.body_html = article.body_html.replace(/[\r\n\t]+/g, " ").trim();

  const outPath = `/tmp/column-${article.slug}.json`;
  fs.writeFileSync(outPath, JSON.stringify(article));
  console.log(`保存しました: ${outPath}`);
  console.log(`タイトル: ${article.title}`);
  console.log(`狙うKW: ${article.target_keyword} / ジャンル: ${article.genre_id}`);
  console.log(`本文の長さ: 約${article.body_html.replace(/<[^>]+>/g, "").length}字`);
  if (data.usage) {
    console.log(`DeepSeekトークン: 入力${data.usage.prompt_tokens} 出力${data.usage.completion_tokens}`);
  }
  console.log(`\n次: node -r dotenv/config scripts/save-column.js ${outPath} dotenv_config_path=.env.local`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
