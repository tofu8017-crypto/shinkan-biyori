// IndexNow にURLを送信して即時インデックスを促す（Bing/Yandex等。無料・キー検証のみ）。
// Google Indexing API はブログ記事に非対応のため使わない（IndexNow＋sitemap＋GSC手動登録が正路）。
//
// 使い方:
//   node scripts/notify-indexnow.js <URL> [URL...]
//   echo -e "url1\nurl2" | node scripts/notify-indexnow.js   # stdinからも可
//
// キーは公開前提（public/<KEY>.txt で配信済み）。env INDEXNOW_KEY で上書き可。

const HOST = "shinkanbiyori.com";
const KEY = process.env.INDEXNOW_KEY || "49b430ea3792226d6a90e9c2a0c8ee66";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve("");
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (d) => (buf += d));
    process.stdin.on("end", () => resolve(buf));
  });
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => /^https?:\/\//.test(a));
  const stdin = await readStdin();
  const fromStdin = stdin.split(/\s+/).filter((u) => /^https?:\/\//.test(u));
  const urlList = [...new Set([...argv, ...fromStdin])];

  if (urlList.length === 0) {
    console.log("送信するURLがありません。");
    return;
  }

  const body = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      });
      // 200/202 が成功。422=URL/keyの不一致, 403=keyファイル未配信 など
      console.log(`IndexNow: HTTP ${res.status} / ${urlList.length}件送信`);
      if (res.status === 200 || res.status === 202) return;
      const t = await res.text().catch(() => "");
      throw new Error(`status ${res.status} ${t.slice(0, 200)}`);
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  console.error("IndexNow送信に失敗:", lastErr?.message);
  process.exit(1);
}

main();
