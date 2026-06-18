// SEMrush等のキーワードCSVを data/seo-keywords.json に取り込む。
// 使い方: node scripts/import-keywords.js <CSVパス>
// CSV想定ヘッダー: Keyword,Intent,Related,Volume,Keyword Difficulty,CPC (USD),SERP Features
const fs = require("fs");
const path = require("path");

function parseLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
    } else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("CSVパスを指定してください: node scripts/import-keywords.js <CSV>");
  process.exit(1);
}

const raw = fs.readFileSync(csvPath, "utf8");
const lines = raw.split(/\r?\n/).filter((l) => l.trim());
const rows = lines
  .slice(1)
  .map(parseLine)
  .filter((r) => r.length >= 5 && r[0].trim())
  .map((r) => ({
    keyword: r[0].trim(),
    intent: (r[1] || "").trim(),
    volume: Number(r[3]) || 0,
    kd: Number(r[4]) || 0,
  }));

rows.sort((a, b) => b.volume - a.volume);

const outPath = path.join(__dirname, "..", "data", "seo-keywords.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(rows, null, 1));
console.log(`取り込み ${rows.length} 件 → ${outPath}`);
