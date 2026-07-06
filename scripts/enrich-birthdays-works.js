// 一回きりの補強スクリプト: data/author-birthdays.json の各作家に
// Wikidataの「代表作」(P800) を works: ["書名", ...] として追記する。
// 名前(ja) + 誕生日の月日(P569) の両方で照合し、同姓同名の別人を弾く。
// 使い方: node scripts/enrich-birthdays-works.js
// ponytail: 手動実行の使い捨て。cron組み込みは反応を見てから

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "author-birthdays.json");
const SPARQL = "https://query.wikidata.org/sparql";
const UA = "shinkanbiyori-birthday-enricher/1.0 (https://shinkanbiyori.com)";

async function queryChunk(names) {
  const values = names.map((n) => `"${n.replace(/"/g, '\\"')}"@ja`).join(" ");
  // ?work は「書かれた作品」(Q47461344配下=小説・詩集・評論等)に限定。
  // 映画監督・音楽家などの映像/楽曲の代表作を弾き、文芸サイトの看板に合う書物だけ拾う
  const q = `
SELECT ?name ?dob ?workLabel WHERE {
  VALUES ?name { ${values} }
  ?person rdfs:label ?name ; wdt:P569 ?dob ; wdt:P800 ?work .
  ?work wdt:P31/wdt:P279* wd:Q47461344 .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja". }
}`;
  let res;
  for (let tryN = 0; tryN < 4; tryN++) {
    try {
      res = await fetch(SPARQL + "?format=json&query=" + encodeURIComponent(q), {
        headers: { "User-Agent": UA, Accept: "application/sparql-results+json" },
      });
      if (res.ok) break;
    } catch (_) {
      res = null;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (!res || !res.ok) throw new Error(`SPARQL ${res ? res.status : "fetch failed"}`);
  const d = await res.json();
  return d.results.bindings.map((b) => ({
    name: b.name.value,
    dob: b.dob.value, // 例 1952-07-06T00:00:00Z
    work: b.workLabel.value,
  }));
}

async function main() {
  const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const entries = Object.entries(data); // [["07-06", {name, year, ...}], ...]
  const byName = new Map(); // name -> {md, year}
  for (const [md, v] of entries) byName.set(v.name, { md, year: v.year });

  const names = [...byName.keys()];
  const rows = [];
  for (let i = 0; i < names.length; i += 50) {
    const chunk = names.slice(i, i + 50);
    rows.push(...(await queryChunk(chunk)));
    console.log(`SPARQL ${Math.min(i + 50, names.length)}/${names.length}`);
    await new Promise((r) => setTimeout(r, 1000)); // Wikidataに優しく
  }

  // 名前＋月日(＋年があれば年も)一致だけ採用。ja表記が無い作品(QIDやローマ字)は捨てる
  const worksByName = new Map();
  for (const r of rows) {
    const meta = byName.get(r.name);
    if (!meta) continue;
    const [y, m, d] = r.dob.slice(0, 10).split("-");
    if (`${m}-${d}` !== meta.md) continue; // 別人（月日不一致）
    if (meta.year && Number(y) !== meta.year) continue; // 別人（年不一致）
    if (/^Q\d+$/.test(r.work)) continue; // jaラベル無し
    if (!/[ぁ-んァ-ヶ一-龠]/.test(r.work)) continue; // 日本語表記の作品名だけ
    if (r.work.length > 30) continue;
    const arr = worksByName.get(r.name) || [];
    if (!arr.includes(r.work)) arr.push(r.work);
    worksByName.set(r.name, arr);
  }

  let hit = 0;
  for (const [, v] of entries) {
    delete v.works; // 再実行時に前回の残骸（書物以外の代表作）を消す
    const w = worksByName.get(v.name);
    if (w && w.length) {
      v.works = w.slice(0, 2); // 投稿に載せるのは最大2作
      hit++;
    }
  }
  fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + "\n");
  console.log(`works付与: ${hit}/${entries.length}人`);
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
