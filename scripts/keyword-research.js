// 長尾キーワード深掘り（Googleサジェスト・無料/非公式・少量利用に留める）
// クラスター設計の「材料集め」用。
//
// 使い方:
//   単一シード:      node scripts/keyword-research.js "ミステリー 小説"
//   深掘り(かな/英字も足す): node scripts/keyword-research.js "ミステリー 小説" --deep
//   作家まとめ:      node scripts/keyword-research.js --authors "伊坂幸太郎,辻村深月,米澤穂信"

async function suggest(q) {
  const url =
    "https://suggestqueries.google.com/complete/search?" +
    new URLSearchParams({ client: "firefox", hl: "ja", q });
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return [];
    const d = await res.json();
    return d[1] ?? [];
  } catch {
    return [];
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 文芸・読書系でよく付く絞り込み語
const MODIFIERS = ["おすすめ", "新刊", "2026", "ランキング", "文庫", "順番", "あらすじ", "名作", "シリーズ", "代表作", "一覧", "初心者"];
const KANA = ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ"];
const ALPHA = "abcdefghijklmnopqrstuvwxyz".split("");

async function deepSuggest(seed, deep) {
  const set = new Set();
  for (const s of await suggest(seed)) set.add(s);
  const tails = deep ? [...MODIFIERS, ...KANA, ...ALPHA] : MODIFIERS;
  for (const t of tails) {
    await sleep(250);
    for (const s of await suggest(seed + " " + t)) set.add(s);
  }
  return [...set].filter((s) => s && s !== seed);
}

async function authorMode(authors) {
  const out = {};
  for (const a of authors) {
    const set = new Set();
    for (const seed of [a, a + " 新刊", a + " おすすめ", a + " 順番", a + " 文庫", a + " 代表作"]) {
      await sleep(250);
      for (const s of await suggest(seed)) set.add(s);
    }
    out[a] = [...set].filter(Boolean);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const ai = args.indexOf("--authors");
  if (ai >= 0) {
    const authors = (args[ai + 1] || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!authors.length) {
      console.error('作家名をカンマ区切りで指定してください。例: --authors "伊坂幸太郎,辻村深月"');
      process.exit(1);
    }
    console.log(JSON.stringify({ mode: "authors", data: await authorMode(authors) }, null, 2));
    return;
  }
  const deep = args.includes("--deep");
  const seed = args.filter((a) => !a.startsWith("--")).join(" ").trim();
  if (!seed) {
    console.error('シード語か --authors を指定してください');
    process.exit(1);
  }
  const sug = await deepSuggest(seed, deep);
  console.log(JSON.stringify({ mode: "seed", seed, deep, count: sug.length, suggestions: sug }, null, 2));
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
