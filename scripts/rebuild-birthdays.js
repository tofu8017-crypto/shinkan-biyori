// 一回きりの再構築スクリプト: data/author-birthdays.json を「知名度」基準で作り直す。
// 手順: Wikidataで各月の「その日生まれの作家(日本語版Wikipedia記事あり・日精度の生年月日)」を
// 収集 → 日ごとに候補上位(日本人3+全体3)へ日本語版Wikipediaの年間閲覧数を照会 →
// 閾値以上で最多の人をその日の作家に採用。閾値未満しかいない日はエントリ無し(キット側が④をスキップ)。
// 使い方: node scripts/rebuild-birthdays.js
// 実行後に scripts/enrich-birthdays-works.js を再実行して代表作(works)を付け直すこと。
// ponytail: 閾値50k/年は勘。反応を見て調整

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "author-birthdays.json");
const SPARQL = "https://query.wikidata.org/sparql";
const UA = "shinkanbiyori-birthday-rebuilder/1.0 (https://shinkanbiyori.com)";
const MIN_VIEWS = 50000; // 年間閲覧数の下限（これ未満は「知られていない」とみなす）
// 閲覧数の集計期間（直近の丸1年・データ未反映月を避けて1ヶ月余裕を持つ）
const PV_RANGE = "2025060100/2026053100";

// 作家系の職業（P106）。サブクラス探索はタイムアウトしやすいので代表IDを列挙
const OCCUPATIONS = [
  "Q6625963", // 小説家
  "Q36180",   // 作家
  "Q49757",   // 詩人
  "Q214917",  // 劇作家
  "Q11774202",// エッセイスト
  "Q4853732", // 児童文学作家
  "Q10297252",// ミステリー作家? (無ければ空振りするだけ)
];

// 職業×月で1クエリずつ（まとめると「作家」の母数が大きすぎて504になる）
async function sparqlMonthOcc(month, occ) {
  const q = `
SELECT ?personLabel ?dob ?sitelinks ?jp ?desc ?title WHERE {
  ?person wdt:P106 wd:${occ} ; wikibase:sitelinks ?sitelinks .
  ?person p:P569 [ psv:P569 [ wikibase:timeValue ?dob ; wikibase:timePrecision 11 ] ] .
  FILTER(MONTH(?dob) = ${month} && YEAR(?dob) > 1600)
  ?article schema:about ?person ; schema:isPartOf <https://ja.wikipedia.org/> ; schema:name ?title .
  BIND(EXISTS { ?person wdt:P27 wd:Q17 } AS ?jp)
  OPTIONAL { ?person schema:description ?desc . FILTER(LANG(?desc) = "ja") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja". }
}
ORDER BY DESC(?sitelinks)
LIMIT 400`;
  for (let tryN = 0; tryN < 3; tryN++) {
    try {
      const res = await fetch(SPARQL + "?format=json&query=" + encodeURIComponent(q), {
        headers: { "User-Agent": UA, Accept: "application/sparql-results+json" },
      });
      if (!res.ok) throw new Error(`SPARQL ${res.status}`);
      const d = await res.json();
      return d.results.bindings.map((b) => ({
        name: b.personLabel.value,
        title: b.title.value, // jawiki記事名（閲覧数照会に使う）
        dob: b.dob.value.slice(0, 10),
        sitelinks: Number(b.sitelinks.value),
        jp: b.jp.value === "true",
        desc: b.desc ? b.desc.value : "",
      }));
    } catch (e) {
      console.error(`month ${month} ${occ} retry${tryN}:`, e.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  console.error(`month ${month} ${occ} 取得失敗（この職業はスキップ）`);
  return [];
}

async function sparqlMonth(month) {
  const rows = [];
  for (const occ of OCCUPATIONS) {
    rows.push(...(await sparqlMonthOcc(month, occ)));
    await new Promise((r) => setTimeout(r, 1500));
  }
  return rows;
}

async function yearViews(title) {
  const enc = encodeURIComponent(title.replace(/ /g, "_"));
  try {
    const res = await fetch(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ja.wikipedia/all-access/user/${enc}/monthly/${PV_RANGE}`,
      { headers: { "User-Agent": UA } }
    );
    if (!res.ok) return 0;
    const d = await res.json();
    return (d.items || []).reduce((a, x) => a + x.views, 0);
  } catch (_) {
    return 0;
  }
}

// Wikidataの職業タグ(P106)は「1冊でも本を出したことがある」レベルの人まで拾ってしまう
// （政治家・スポーツ選手・俳優なども混入）。日本語版Wikipediaの説明(description)が
// 実際に文芸系の肩書きかどうかで足切りする。build-x-kit.jsのWRITER_NOTEと揃える。
const WRITER_NOTE = /作家|小説家|詩人|歌人|俳人|俳諧|劇作家|随筆|エッセイ|評論家|翻訳|文学|漫画家|脚本家|著述|文人|戯作|哲学者|思想家/;
// 「哲学者/思想家」だけの一致は、国家指導者・革命家まで拾ってしまう(毛沢東・カール・マルクス等)。
// 明確な文芸語(小説家・詩人等)が無く思想家/哲学者だけの場合は、政治色の強い肩書きなら除外する。
const POLITICAL_NOTE = /政治家|革命家|指導者|主席|総書記|党首|独裁|国家元首|軍人|将軍/;
const STRONG_LITERARY = /作家|小説家|詩人|歌人|俳人|俳諧|劇作家|随筆|エッセイ|漫画家|脚本家|童話|絵本|文学者|著述|文人|戯作/;
function passesLiteraryFilter(desc) {
  const d = desc || "";
  if (!WRITER_NOTE.test(d)) return false;
  if (/思想家|哲学者/.test(d) && !STRONG_LITERARY.test(d) && POLITICAL_NOTE.test(d)) return false;
  return true;
}

const CACHE = path.join(__dirname, "..", "data", ".birthday-candidates-cache.json");

async function main() {
  // 1) 全月の候補を収集し、日(MM-DD)ごとにまとめる（キャッシュがあれば再取得しない＝閾値調整のたびに
  //    Wikidata/Wikipediaへ再アクセスしなくて済む）
  let byDayObj;
  if (fs.existsSync(CACHE)) {
    console.log("キャッシュを使用（再収集はスキップ）");
    byDayObj = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    // フィルタ強化後の再実行に対応: キャッシュ生成時点の古い判定基準が残っていても、
    // ここで最新の passesLiteraryFilter を再適用する
    for (const md of Object.keys(byDayObj)) {
      byDayObj[md] = byDayObj[md].filter((r) => passesLiteraryFilter(r.desc));
      if (byDayObj[md].length === 0) delete byDayObj[md];
    }
  } else {
    byDayObj = {};
    for (let m = 1; m <= 12; m++) {
      const rows = await sparqlMonth(m);
      for (const r of rows) {
        if (/^Q\d+$/.test(r.name)) continue; // jaラベル無し
        if (!passesLiteraryFilter(r.desc)) continue; // 文芸系の肩書きでない人・政治色の強い「思想家」を除外
        const md = r.dob.slice(5);
        const arr = byDayObj[md] || [];
        if (!arr.some((x) => x.title === r.title)) arr.push(r);
        byDayObj[md] = arr;
      }
      console.log(`SPARQL ${m}月: 候補${rows.length}件`);
      await new Promise((r) => setTimeout(r, 2000));
    }
    fs.writeFileSync(CACHE, JSON.stringify(byDayObj));
  }
  const byDay = new Map(Object.entries(byDayObj));

  // 2) 日ごとに候補を絞って閲覧数を照会（日本人上位3 + 全体上位3。sitelinksは粗い足切りにだけ使う）
  const out = {};
  const days = [...byDay.keys()].sort();
  let done = 0;
  for (const md of days) {
    const all = byDay.get(md).sort((a, b) => b.sitelinks - a.sitelinks);
    const jpTop = all.filter((x) => x.jp).slice(0, 3);
    const candidates = [...new Set([...jpTop, ...all.slice(0, 3)])];
    let best = null;
    for (const c of candidates) {
      const v = await yearViews(c.title);
      if (v >= MIN_VIEWS && (!best || v > best.views)) best = { ...c, views: v };
      await new Promise((r) => setTimeout(r, 60));
    }
    if (best) {
      out[md] = {
        name: best.name,
        note: (best.desc || "").replace(/。$/, ""),
        year: Number(best.dob.slice(0, 4)),
        jp: best.jp,
        views: best.views, // 選定根拠（キットは使わない・デバッグ用）
      };
    }
    done++;
    if (done % 30 === 0) console.log(`閲覧数照会 ${done}/${days.length}日`);
  }

  fs.writeFileSync(FILE, JSON.stringify(out, null, 1) + "\n");
  const jp = Object.values(out).filter((x) => x.jp).length;
  console.log(`完了: ${Object.keys(out).length}日ぶん採用（日本人${jp}）。次に enrich-birthdays-works.js を実行してください。`);
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
