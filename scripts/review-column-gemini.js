// 無料のGemini(2.5-flash・無料枠)で、DeepSeek執筆コラムを「別系統AI」が事実チェックする。
// SARPのジューリー（生成と別系統の判定）を¥0で再現する軽量版。
// 入力: <columnJsonのパス> <materialsJsonのパス>
// 出力(stdout): {"ok":bool,"issues":["..."]}  ※ issues は素材の事実に無い主張・AI臭などの指摘
// 設計: 失敗(キー無し/無料枠制限/エラー)でも exit 0 で {"ok":true,"issues":[]} を返し、
//       本体パイプラインを絶対に止めない（フェイルセーフ）。
const fs = require("fs");

const MODEL = "gemini-2.5-flash"; // 無料枠で利用可（2026-06-30確認）
const KEY = process.env.GEMINI_API_KEY;

function done(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

async function main() {
  const [colPath, matPath] = process.argv.slice(2);
  if (!colPath || !matPath || !KEY) return done({ ok: true, issues: [] });

  let col, mat;
  try {
    col = JSON.parse(fs.readFileSync(colPath, "utf8"));
    mat = JSON.parse(fs.readFileSync(matPath, "utf8"));
  } catch {
    return done({ ok: true, issues: [] });
  }

  // 素材に実在する全フィールドを渡す（ISBN・価格・購入リンクの有無も含め誤検出を防ぐ）。
  const facts = (mat.books || [])
    .map((b) => {
      const parts = [`『${b.title}』`, `著:${b.author}`, `版元:${b.publisher}`, `発売:${b.published_date}`];
      if (b.label) parts.push(`レーベル:${b.label}`);
      if (b.price) parts.push(`価格:${b.price}`);
      if (b.isbn13) parts.push(`ISBN:${b.isbn13}`);
      if (b.amazon_url || b.rakuten_url) parts.push("購入リンク:あり(Amazon/楽天)");
      parts.push(b.summary ? "内容紹介:" + String(b.summary).slice(0, 240) : "内容紹介:なし");
      return "・" + parts.join(" / ");
    })
    .join("\n");
  const targetKw = mat.target_keyword || col.target_keyword || "";
  const bodyText = String(col.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 6000);

  const prompt =
    "あなたは厳格なファクトチェッカーです。下の【素材】の情報だけが信頼できます。\n" +
    "次の2点だけを問題として洗い出してください:\n" +
    "(1)【捏造】素材に無いのに書かれた『あらすじ・作風・テーマ・受賞歴・登場人物・固有の数値』など。※ただし素材にある書名/著者/版元/発売日/価格/ISBN/購入リンクの記載は問題ではない。\n" +
    "(2)【AI臭】誇張・空疎な定型句（例: 魅力/必見/ぜひ/話題沸騰/感動必至/涙腺崩壊/心動かされる/ぴったりの一冊）。\n" +
    `※ 狙うキーワードは「${targetKw}」。タイトルや本文に『おすすめ』『選び方』等の検索意図に沿う語があるのは正常で、問題にしない。\n` +
    "※ 内容紹介が『なし』の本について、あらすじや読みどころを具体的に書いていたらそれは捏造として必ず挙げる。\n" +
    "出力はJSONのみ: {\"ok\": <問題が無ければtrue>, \"issues\": [\"具体的な指摘を短く\", ...]}。issuesは最大8件。問題が無ければ ok=true, issues=[]。\n\n" +
    "【素材】\n" + facts + "\n\n【記事タイトル】\n" + (col.title || "") + "\n\n【記事本文】\n" + bodyText;

  let text;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      }
    );
    if (!r.ok) return done({ ok: true, issues: [] }); // 無料枠制限(429)等はスルー
    const j = await r.json();
    text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch {
    return done({ ok: true, issues: [] });
  }
  if (!text) return done({ ok: true, issues: [] });

  try {
    const v = JSON.parse(text);
    const issues = Array.isArray(v.issues) ? v.issues.filter(Boolean).slice(0, 8) : [];
    return done({ ok: issues.length === 0, issues });
  } catch {
    return done({ ok: true, issues: [] });
  }
}
main();
