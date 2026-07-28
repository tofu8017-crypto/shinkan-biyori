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

// ローカル実行時は generate-hatena-themes.js と同様に .env.local を自動で読む
if (!process.env.DEEPSEEK_API_KEY) {
  try {
    require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
  } catch {}
}

const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

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

  // facts 付きテーマ（「著者名 おすすめ」等）は実在の書誌を渡す。
  // 書名を出してよいのはこの範囲だけ、と明示して捏造を封じる。
  const factsNote = theme.facts
    ? "\n\n【事実】以下は実在の書誌データです。書名・出版社・発売日に触れるときは、必ずこの一覧の中の情報だけを使ってください。" +
      "一覧に無い書名・受賞歴・部数・あらすじの断定は書かないこと（あらすじは知っている範囲でも書かない）。" +
      "5〜7冊を選び、それぞれ「どんな読者に合うか」「どこから読むか」を編集者の視点で書き分けてください。\n" +
      "```json\n" + JSON.stringify(theme.facts, null, 2) + "\n```"
    : "";

  const userMessage =
    "以下のテーマで、ルールに沿ったはてな記事JSONを1つ返してください。\n" +
    "internal_links のうち2〜3本を本文に自然に張ってください。\n\n" +
    "```json\n" +
    JSON.stringify({ ...theme, facts: undefined }, null, 2) +
    "\n```" +
    factsNote;

  // DeepSeekは時々サボって短文・リンク無しを返す。一発勝負だと即失敗するので、
  // 検証に通るまで最大3回リトライし、失敗時は具体的な不足を伝えて作り直させる。
  const MAX_ATTEMPTS = 3;
  let article = null;
  let lastErrs = [];
  let lastLen = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // 2回目以降は前回の不足点を明示して矯正する。
    // 「1100字以上」という遠い目標だけ繰り返すと毎回同じくらい足りない量を生成してしまう
    // （auto-generate.jsで7/9に見つけたのと同じ罠）。前回の実測字数を示し「+400字」の
    // 具体的な上乗せ目標にする。
    const retryNote =
      attempt === 1
        ? ""
        : `\n\n【前回の生成は不合格でした。必ず直してください】\n - ${lastErrs.join("\n - ")}\n` +
          `前回は${lastLen}字しかありませんでした。今回は最低${lastLen + 400}字（1100字は必ず超えること）を目安に、` +
          "各見出しの具体例・編集者としての観察・読者が直面する場面の描写を増やして書き直してください。" +
          "internal_links を本文中に2〜3本(https://shinkanbiyori.com…)をMarkdownリンクで張ること。";

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
          { role: "user", content: userMessage + retryNote },
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

    let candidate;
    try {
      candidate = JSON.parse(content);
    } catch (e) {
      console.error("DeepSeek応答のJSONパースに失敗:", e.message);
      console.error(content.slice(0, 400));
      process.exit(1);
    }

    // 最低限のバリデーション
    const errs = [];
    if (!candidate.title || candidate.title.length > 40) errs.push("title が無い/長すぎる");
    if (!candidate.body_markdown || candidate.body_markdown.length < 1100) errs.push(`body_markdown が短すぎる(${candidate.body_markdown ? candidate.body_markdown.length : 0}字 / 1100字以上必要)`);
    if (/^#\s/.test(candidate.body_markdown || "")) errs.push("本文先頭にH1(#)がある（タイトルは別管理なので不要）");
    // 本文に新刊日和リンクが2本以上あるか
    const linkCount = (candidate.body_markdown.match(/shinkanbiyori\.com/g) || []).length;
    if (linkCount < 2) errs.push(`本文中の新刊日和リンクが${linkCount}本（2〜3本必要）`);

    if (!errs.length) {
      article = candidate;
      if (attempt > 1) console.error(`[hatena-auto] 再生成${attempt}回目で検証通過`);
      break;
    }
    lastErrs = errs;
    lastLen = candidate.body_markdown ? candidate.body_markdown.length : 0;
    console.error(`[hatena-auto] 生成${attempt}/${MAX_ATTEMPTS}回目が検証不合格:\n - ${errs.join("\n - ")}`);
  }

  if (!article) {
    console.error(`生成記事の検証に${MAX_ATTEMPTS}回失敗:\n - ` + lastErrs.join("\n - "));
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
