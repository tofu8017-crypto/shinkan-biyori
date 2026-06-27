// recent-books.js の出力（書誌のみ）に openBD の内容紹介をマージして、
// write-column-deepseek.js が要求する「素材JSON」を組み立てる。
// 従来 daily-column.yml では Claude がやっていた知的処理（openBD解釈＋マージ）の移植。
//
// 使い方:
//   node scripts/build-materials.js <入力JSON> [出力JSON]
//   入力JSON: { target_keyword, genre_id, books:[{title,author,publisher,published_date,isbn13,isbn10,amazon_url,rakuten_url}, ...] }
//   出力JSON(省略時 /tmp/materials-<genre>.json): 各bookに summary/author_facts/label/price を付与
//
// openBD は1回のまとめ取得で済ませる（ISBNをカンマ区切り）。原文転載はせず要約用に渡すだけ。

const fs = require("fs");

// onix から内容紹介(TextType=03 = 内容紹介 / 02 = 内容説明 等)を拾う
function pickDescription(item) {
  const summaryText = item?.summary?.title ? "" : "";
  const tc = item?.onix?.CollateralDetail?.TextContent;
  if (Array.isArray(tc)) {
    // 03(内容紹介) > 02(著者からのコメント等) > 先頭 の優先で拾う
    const byType = (t) => tc.find((x) => x.TextType === t && x.Text);
    const hit = byType("03") || byType("02") || tc.find((x) => x.Text);
    if (hit && hit.Text) return String(hit.Text).replace(/\s+/g, " ").trim();
  }
  return summaryText;
}

function pickPrice(item) {
  const p = item?.onix?.ProductSupply?.SupplyDetail?.Price;
  if (Array.isArray(p) && p[0]?.PriceAmount) return `${p[0].PriceAmount}円`;
  return "";
}

function pickLabel(item) {
  // レーベル/シリーズ名（あれば）。無ければ空。
  const coll = item?.onix?.DescriptiveDetail?.Collection;
  const seq = Array.isArray(coll) ? coll[0] : coll;
  const te = seq?.TitleDetail?.TitleElement;
  const el = Array.isArray(te) ? te[0] : te;
  return el?.TitleText?.content || el?.TitleText || "";
}

async function fetchOpenBD(isbns) {
  if (isbns.length === 0) return {};
  const url = `https://api.openbd.jp/v1/get?isbn=${isbns.join(",")}`;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`openBD ${res.status}`);
      const arr = await res.json();
      const map = {};
      for (const item of arr || []) {
        const isbn = item?.summary?.isbn;
        if (isbn) map[isbn] = item;
      }
      return map;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  console.error("openBD取得に失敗（書誌のみで続行）:", lastErr?.message);
  return {};
}

async function main() {
  const inPath = process.argv[2];
  if (!inPath) {
    console.error("使い方: node scripts/build-materials.js <入力JSON> [出力JSON]");
    process.exit(1);
  }
  const input = JSON.parse(fs.readFileSync(inPath, "utf8"));
  if (!input.target_keyword || !input.genre_id || !Array.isArray(input.books)) {
    console.error("入力JSONに target_keyword / genre_id / books(配列) が必要です。");
    process.exit(1);
  }

  const isbns = input.books.map((b) => b.isbn13).filter(Boolean);
  const obd = await fetchOpenBD(isbns);

  const books = input.books.map((b) => {
    const item = obd[b.isbn13];
    const summary = item ? pickDescription(item) : "";
    return {
      title: b.title,
      author: b.author,
      publisher: b.publisher,
      published_date: b.published_date,
      isbn13: b.isbn13,
      isbn10: b.isbn10 || null,
      amazon_url: b.amazon_url || null,
      rakuten_url: b.rakuten_url || null,
      // 以下が記事の厚みを生む（openBD由来。無ければ空/未確認で、捏造はしない）
      summary: summary || "（内容紹介は未取得。書誌事実の範囲で簡潔に紹介すること）",
      author_facts: "未確認",
      label: item ? pickLabel(item) : "",
      price: item ? pickPrice(item) : "",
    };
  });

  const materials = {
    target_keyword: input.target_keyword,
    genre_id: input.genre_id,
    suggests: input.suggests || [],
    books,
  };

  const outPath = process.argv[3] || `/tmp/materials-${input.genre_id}.json`;
  fs.writeFileSync(outPath, JSON.stringify(materials));
  const withSummary = books.filter((b) => !b.summary.startsWith("（内容紹介は未取得")).length;
  console.log(`素材を書きました: ${outPath}`);
  console.log(`本${books.length}冊 / openBD内容紹介あり ${withSummary}冊 / KW: ${input.target_keyword}`);
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
