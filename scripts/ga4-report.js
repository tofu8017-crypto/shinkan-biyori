#!/usr/bin/env node
// GA4のレポートをCLIで出す。GSC(検索の見え方)では分からない「実際に来た人と流入元」を見るためのもの。
// 鍵はGSCと同じサービスアカウントを使い回す（scopeだけ差し替え）。googleapis不要・標準fetchのみ。
//
// 使い方:
//   node scripts/ga4-report.js            直近28日
//   node scripts/ga4-report.js --days 7   直近7日
//   node scripts/ga4-report.js --days 28 --compare  前の同じ期間と比較
//
// 事前準備は2026-08-03に完了済み（Analytics Data APIの有効化 ＋ GA4のアクセス管理に
// サービスアカウントを「閲覧者」で追加）。プロパティIDは下にベタ書きしてあるので設定不要。

const { loadCredentials, getAccessToken } = require("./lib/gsc-client");

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
// 新刊日和（shinkanbiyori.com）のGA4プロパティ。別サイトを見たいときだけ環境変数で上書きする。
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || "545140602";

function parseArgs() {
  const a = process.argv.slice(2);
  const i = a.indexOf("--days");
  return { days: i >= 0 ? Number(a[i + 1]) : 28, compare: a.includes("--compare") };
}

// GA4の相対日付指定を使う（自前で日付計算するとUTC/JSTのズレを踏むため。
// "NdaysAgo"はGA4がプロパティのタイムゾーンで解釈してくれる）。当日は未確定なので昨日で切る。
// offset=1で「前の同じ長さの期間」＝比較用。
function range(days, offset = 0) {
  return {
    startDate: `${days * (offset + 1)}daysAgo`,
    endDate: offset === 0 ? "yesterday" : `${days * offset + 1}daysAgo`,
  };
}

async function runReport(token, body) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const msg = text.slice(0, 400);
    if (res.status === 403 && /SERVICE_DISABLED|has not been used/.test(msg)) {
      throw new Error(`APIが有効化されていません。エラー本文のURLを開いて有効化してください:\n${msg}`);
    }
    if (res.status === 403) {
      throw new Error(`権限がありません。GA4の管理→アクセス管理でサービスアカウントを「閲覧者」に追加してください:\n${msg}`);
    }
    throw new Error(`GA4 APIエラー: ${res.status} ${msg}`);
  }
  return JSON.parse(text);
}

// レポートの行を [ラベル, 数値...] の配列に均す。
// 全体サマリーのようにdimensions無しで問い合わせると dimensionValues 自体が返らないので、無い前提で扱う。
function rows(report) {
  return (report.rows || []).map((r) => [
    ...(r.dimensionValues || []).map((d) => d.value),
    ...(r.metricValues || []).map((m) => Number(m.value)),
  ]);
}

function table(header, data, widths) {
  console.log(header.map((h, i) => String(h).padEnd(widths[i])).join(""));
  console.log(widths.map((w) => "-".repeat(w - 1)).join(" "));
  for (const row of data) {
    console.log(row.map((c, i) => String(c).padEnd(widths[i])).join(""));
  }
}

const pct = (n) => `${(n * 100).toFixed(1)}%`;
const mmss = (sec) => `${Math.floor(sec / 60)}分${String(Math.round(sec % 60)).padStart(2, "0")}秒`;
const diff = (now, before) => {
  if (!before) return "";
  const d = ((now - before) / before) * 100;
  return ` (${d >= 0 ? "+" : ""}${d.toFixed(0)}%)`;
};

async function summary(token, dateRange) {
  const rep = await runReport(token, {
    dateRanges: [dateRange],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "screenPageViews" },
      { name: "engagementRate" },
      { name: "averageSessionDuration" },
    ],
  });
  const [s, u, v, er, dur] = rows(rep)[0] || [0, 0, 0, 0, 0];
  return { sessions: s, users: u, views: v, engagementRate: er, duration: dur };
}

async function main() {
  const { days, compare } = parseArgs();
  const token = await getAccessToken(loadCredentials(), SCOPE);

  const cur = range(days);
  console.log(`=== GA4レポート ${cur.startDate} 〜 ${cur.endDate} (${days}日間) ===\n`);

  const now = await summary(token, cur);
  const before = compare ? await summary(token, range(days, 1)) : null;

  console.log("【全体】");
  console.log(`  セッション数        ${now.sessions}${diff(now.sessions, before?.sessions)}`);
  console.log(`  ユーザー数          ${now.users}${diff(now.users, before?.users)}`);
  console.log(`  ページビュー        ${now.views}${diff(now.views, before?.views)}`);
  console.log(`  エンゲージメント率  ${pct(now.engagementRate)}`);
  console.log(`  平均滞在時間        ${mmss(now.duration)}`);
  if (compare) {
    console.log(
      before.sessions
        ? `  ※ (%)は直前の${days}日間との比較`
        : `  ※ 比較できません（直前の${days}日間にはGA4のデータがありません。計測開始前の可能性）`
    );
  }

  const channels = await runReport(token, {
    dateRanges: [cur],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }, { name: "engagementRate" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });
  console.log("\n【流入元（チャネル別）】GSCでは分からない部分");
  table(
    ["チャネル", "セッション", "エンゲージ率"],
    rows(channels).map(([name, s, er]) => [name, s, pct(er)]),
    [28, 12, 12]
  );

  const referrers = await runReport(token, {
    dateRanges: [cur],
    dimensions: [{ name: "sessionSource" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });
  console.log("\n【参照元 Top10】X・はてなからの流入はここで確認");
  table(["参照元", "セッション"], rows(referrers), [36, 12]);

  const pages = await runReport(token, {
    dateRanges: [cur],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }, { name: "averageSessionDuration" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 15,
  });
  console.log("\n【人気ページ Top15】");
  table(
    ["ページ", "PV", "平均滞在"],
    rows(pages).map(([p, v, d]) => [p.length > 44 ? p.slice(0, 43) + "…" : p, v, mmss(d)]),
    [46, 8, 12]
  );
}

// 期間の境界計算だけは間違えても気づけないので、その場で確かめられるようにしておく
if (process.argv.includes("--selftest")) {
  const assert = require("assert");
  assert.deepStrictEqual(range(7), { startDate: "7daysAgo", endDate: "yesterday" });
  assert.deepStrictEqual(range(7, 1), { startDate: "14daysAgo", endDate: "8daysAgo" });
  assert.deepStrictEqual(range(28, 1), { startDate: "56daysAgo", endDate: "29daysAgo" });
  console.log("selftest OK: 期間の区切りに重複も隙間もありません");
  process.exit(0);
}

main().catch((e) => {
  console.error(`\n[エラー] ${e.message}\n`);
  process.exit(1);
});
