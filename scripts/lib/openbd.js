// openBD の ONIX から書誌の付随情報（内容紹介・価格・レーベル）を拾う共有ヘルパー。
// build-materials.js（X素材/コラム）と backfill-descriptions.js（DBのdescription埋め）が使う。

// 内容紹介文をサイト表示・記事素材に使える形へ整える。
// openBD の Text は <br> 等のHTMLや脚注記号を含むことがあるので落とす。
function cleanDescription(raw) {
  if (!raw) return "";
  let s = String(raw)
    .replace(/<br\s*\/?>/gi, " ")   // 改行タグ→空白
    .replace(/<[^>]+>/g, "")        // 残りのタグ除去
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  // 極端に長い出版社紹介文は表示で崩れるので、最大500字を目安に文末(。)で切る
  if (s.length > 500) {
    const cut = s.slice(0, 500);
    const lastStop = cut.lastIndexOf("。");
    s = (lastStop > 200 ? cut.slice(0, lastStop + 1) : cut) + (lastStop > 200 ? "" : "…");
  }
  return s;
}

// onix から内容紹介(TextType=03=内容紹介 / 02=著者コメント等)を拾ってクリーニング
function pickDescription(item) {
  const tc = item?.onix?.CollateralDetail?.TextContent;
  if (Array.isArray(tc)) {
    const byType = (t) => tc.find((x) => x.TextType === t && x.Text);
    const hit = byType("03") || byType("02") || tc.find((x) => x.Text);
    if (hit && hit.Text) return cleanDescription(hit.Text);
  }
  return "";
}

function pickPrice(item) {
  const p = item?.onix?.ProductSupply?.SupplyDetail?.Price;
  if (Array.isArray(p) && p[0]?.PriceAmount) return `${p[0].PriceAmount}円`;
  return "";
}

function pickLabel(item) {
  const coll = item?.onix?.DescriptiveDetail?.Collection;
  const seq = Array.isArray(coll) ? coll[0] : coll;
  const te = seq?.TitleDetail?.TitleElement;
  const el = Array.isArray(te) ? te[0] : te;
  return el?.TitleText?.content || el?.TitleText || "";
}

// openBD へ ISBN をまとめ取得（1000件/回まで）。失敗は空mapで握りつぶし呼び出し側で続行。
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
  console.error("openBD取得に失敗（続行）:", lastErr?.message);
  return {};
}

module.exports = { cleanDescription, pickDescription, pickPrice, pickLabel, fetchOpenBD };
