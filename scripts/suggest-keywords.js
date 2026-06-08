// Googleサジェスト（オートコンプリート・無料/非公式）から実際に検索されているキーワードを取得する。
// コラムのSEOキーワード企画に使う。少量利用に留めること（記事ごとに数回程度）。
// 使い方: node scripts/suggest-keywords.js "ミステリー 小説 おすすめ"

async function suggest(q) {
  const url =
    "https://suggestqueries.google.com/complete/search?" +
    new URLSearchParams({ client: "firefox", hl: "ja", q });
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("suggest HTTP " + res.status);
  const data = await res.json();
  return data[1] ?? [];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const seed = process.argv.slice(2).join(" ").trim();
  if (!seed) {
    console.error('シードキーワードを指定してください。例: node scripts/suggest-keywords.js "ミステリー 小説 おすすめ"');
    process.exit(1);
  }

  const all = new Set();
  // 基本サジェスト
  for (const s of await suggest(seed)) all.add(s);
  // 末尾に1文字足して深掘り（あ行・代表的な絞り込み語）
  const expanders = ["2026", "ランキング", "新刊", "文庫"];
  for (const ex of expanders) {
    await sleep(300);
    try {
      for (const s of await suggest(seed + " " + ex)) all.add(s);
    } catch {
      /* 失敗は無視 */
    }
  }

  const suggestions = [...all].filter((s) => s && s !== seed);
  console.log(JSON.stringify({ seed, count: suggestions.length, suggestions }, null, 2));
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
