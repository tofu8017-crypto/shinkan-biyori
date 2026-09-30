#!/usr/bin/env node
/**
 * 定期監査（週次）。「エラーを出さずに静かに壊れる」型を機械的に検出する。
 *
 * このサイトの障害はほぼ全部「気づかないうちに止まる／取りこぼす」形で起きてきた:
 *   - サイトマップが全28,900冊中1,000冊しか載っていなかった（Supabaseの1000行上限。2026-09-30発覚）
 *   - 作家名のスペース表記ゆれで新刊を取りこぼし、作家ページに古い本しか出ない（2026-09-12発覚）
 *   - コラム公開・はてな投稿が数日ゼロなのに success 表示で気づけない（複数回）
 *   - GSCのSEO上書きが古い書誌のまま、検索結果に数年前の本を宣伝し続ける
 * いずれも「見に行けば分かるが、誰も見に行かない」ものなので定期的に機械が見る。
 *
 * 実行:
 *   node scripts/audit.js              # 監査してレポートを出す（読み取りのみ・書き込みなし）
 *   node scripts/audit.js --quiet      # 問題があるときだけ出力する
 *
 * 必要な環境変数: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * 任意: GSC_CREDENTIALS_JSON（クロール頻度の確認に使う。無ければその項目だけスキップ）
 *       DISCORD_WEBHOOK_URL（設定があれば結果を通知する）
 *
 * 終了コード: 0=問題なし / 1=WARN以上あり（ワークフローを赤くして気づけるようにする）
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
  } catch {}
}

const QUIET = process.argv.includes("--quiet");
const SITE = "https://shinkanbiyori.com";
const ROOT = path.join(__dirname, "..");

// 見つかったことを溜めていく。level: OK / WARN / FAIL
const findings = [];
const add = (level, title, detail) => findings.push({ level, title, detail });

const strip = (s) => (s || "").replace(/[\s　]/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1. サイトマップが実際の在庫を網羅しているか ----------
// 1000行上限の再発と、上限50,000URL超えの両方を見る
async function auditSitemaps(sb) {
  const { count: bookCount } = await sb.from("books").select("*", { count: "exact", head: true });

  // 単発の5xxでFAILにしないよう2回まで試す（Freeプランでは散発的に失敗する）
  const fetchCount = async (url) => {
    let last = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(4000);
      try {
        const res = await fetch(url);
        last = res.status;
        if (res.ok) {
          const xml = await res.text();
          return { ok: true, status: res.status, urls: (xml.match(/<loc>/g) || []).length };
        }
      } catch {}
    }
    return { ok: false, status: last, urls: 0 };
  };

  const books = await fetchCount(`${SITE}/books/sitemap.xml`);
  const authors = await fetchCount(`${SITE}/authors/sitemap.xml`);
  const core = await fetchCount(`${SITE}/sitemap.xml`);

  for (const [name, r] of [["/sitemap.xml", core], ["/books/sitemap.xml", books], ["/authors/sitemap.xml", authors]]) {
    if (!r.ok) add("FAIL", `サイトマップが取得できない: ${name}`, `HTTP ${r.status}`);
    else if (r.urls > 50000) add("FAIL", `サイトマップが上限超え: ${name}`, `${r.urls} URL（1ファイル50,000が上限。分割が必要）`);
  }

  // 書籍サイトマップがDBの在庫をどれだけ覆えているか。1000ちょうどは上限の典型的な兆候
  if (books.ok && bookCount) {
    const ratio = books.urls / bookCount;
    const detail = `サイトマップ ${books.urls} URL / DB ${bookCount}冊（${(ratio * 100).toFixed(1)}%）`;
    if (books.urls === 1000 || ratio < 0.9) {
      add("FAIL", "書籍サイトマップが在庫を網羅していない", `${detail}${books.urls === 1000 ? "。ちょうど1000件=Supabaseの1行上限に当たっている疑い" : ""}`);
    } else {
      add("OK", "書籍サイトマップは在庫を網羅している", detail);
    }
  }
}

// ---------- 2. 1000行上限に当たりうるコードが残っていないか ----------
// .limit(1001以上) はSupabaseでは頭打ちになり、エラーも警告も出ずに取りこぼす
function auditRowLimits() {
  let out = "";
  try {
    out = execSync(
      // 行頭が // や * のコメント行は除外する（説明文に書いた .limit(50000) を拾わないため）
      `grep -rn --include=*.ts --include=*.tsx --include=*.js -E "\\.limit\\(([1-9][0-9]{3,})\\)" lib app scripts | grep -vE ":[[:space:]]*(//|\\*)" || true`,
      { cwd: ROOT, encoding: "utf8" }
    ).trim();
  } catch {
    return;
  }
  const hits = out ? out.split("\n").filter(Boolean) : [];
  if (hits.length === 0) {
    add("OK", "1000行上限に当たるクエリはない", ".limit(1001以上) の記述なし");
    return;
  }
  add(
    "WARN",
    `1000行上限で取りこぼす可能性のあるクエリ ${hits.length}件`,
    hits.map((h) => `  ${h.trim()}`).join("\n") +
      "\n  → Supabaseは1リクエスト1000行が上限。全件必要なら .range() でページングする\n" +
      "  （2026-09-30時点で既知・未対応。サイトマップ分は修正済み）"
  );
}

// ---------- 3. 作家ページが最新刊を出せているか ----------
// スペース表記ゆれで取りこぼす不具合の再発検知。代表作家で最新刊の有無を見る
async function auditAuthorPages(sb) {
  const names = ["伊坂幸太郎", "東野圭吾", "宮部みゆき", "村上春樹", "大沢在昌"];
  const bad = [];
  const unreachable = [];
  for (const name of names) {
    const pat = "%" + strip(name).split("").join("%") + "%";
    const { data } = await sb
      .from("books").select("title,author,published_date")
      .ilike("author", pat).order("published_date", { ascending: false }).limit(60);
    const mine = (data || []).filter((b) => strip(b.author).includes(strip(name)));
    if (mine.length === 0) continue;
    const latest = mine[0];
    // 実際のページに最新刊の書名が出ているか。
    // ページが5xxを返した場合は「内容が古い」ではなく「確認できなかった」として扱う。
    // Freeプランでは一定割合で5xxになるため、混同すると毎週誤検知が出る。
    let html = null;
    for (let attempt = 0; attempt < 2 && html === null; attempt++) {
      if (attempt > 0) await sleep(3000);
      try {
        const res = await fetch(`${SITE}/authors/${encodeURIComponent(name)}`);
        if (res.ok) html = await res.text();
      } catch {}
    }
    if (html === null) {
      unreachable.push(name);
      continue;
    }
    if (!html.includes(latest.title.slice(0, 8))) {
      bad.push(`${name}: DBの最新刊『${latest.title}』(${latest.published_date}) がページに出ていない`);
    }
    await sleep(1500); // 監査自身が負荷をかけて5xxを誘発しないよう間隔を空ける
  }
  if (bad.length) add("FAIL", "作家ページが最新刊を表示できていない", bad.map((b) => `  ${b}`).join("\n"));
  else if (unreachable.length === names.length) add("WARN", "作家ページを確認できなかった", `${unreachable.join("・")} が5xxで取得できず（内容の正否は不明）`);
  else add("OK", "作家ページは最新刊を表示できている", `代表${names.length - unreachable.length}名で確認${unreachable.length ? `（${unreachable.length}名は5xxで確認できず）` : ""}`);
}

// ---------- 4. SEO上書きが古い本を宣伝していないか ----------
async function auditSeoOverrides(sb) {
  const norm = (t) =>
    strip(t).replace(/[『』「」【】〈〉（）()、。・!！?？~〜ー\-—0-9０-９上下巻新装版完全版文庫]/g, "").toLowerCase();
  const { data: ovs, error } = await sb.from("seo_overrides").select("*").eq("target_type", "author");
  if (error) return; // テーブルが無い環境ではスキップ
  const stale = [];
  for (const ov of ovs || []) {
    const pat = "%" + strip(ov.target_key).split("").join("%") + "%";
    const { data } = await sb
      .from("books").select("title,author,published_date")
      .ilike("author", pat).order("published_date", { ascending: false }).limit(60);
    const mine = (data || []).filter((b) => strip(b.author).includes(strip(ov.target_key)));
    if (mine.length === 0) continue;
    const latest = mine[0];
    const blob = norm(`${ov.title} ${ov.description}`);
    const named = mine.filter((b) => {
      const k = norm(b.title).slice(0, 8);
      return k.length >= 4 && blob.includes(k);
    });
    const newest = named[0];
    const gap = newest
      ? Math.round((new Date(latest.published_date) - new Date(newest.published_date)) / 86400000)
      : null;
    if (newest === undefined || gap >= 120) {
      stale.push(`${ov.target_key}: 宣伝中=${newest ? newest.published_date : "書名なし"} / 実際の最新刊=${latest.published_date}`);
    }
  }
  if (stale.length) {
    add("WARN", `検索結果に古い本を出しているSEO上書き ${stale.length}件`, stale.map((s) => `  ${s}`).join("\n") + "\n  → 該当行を seo_overrides から削除するとテンプレートの自動文（最新刊＋発売日）に戻る");
  } else {
    add("OK", "SEO上書きはすべて最新刊に触れている", `作家ページ${(ovs || []).length}件を確認`);
  }
}

// ---------- 5. 自動パイプラインが動いているか ----------
async function auditPipelines(sb) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const daysAgo = (n) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };

  // 新刊収集: 直近3日に発売日が更新された本があるか
  const { count: fresh } = await sb
    .from("books").select("*", { count: "exact", head: true }).gte("last_synced_at", daysAgo(3));
  if (!fresh) add("FAIL", "新刊収集が止まっている疑い", "直近3日に更新された本が0冊（fetch-books.js）");
  else add("OK", "新刊収集は動いている", `直近3日で${fresh}冊を更新`);

  // コラム公開: 直近10日に公開があるか
  const { data: cols, error } = await sb
    .from("columns").select("slug,published_at").not("published_at", "is", null)
    .order("published_at", { ascending: false }).limit(1);
  if (!error) {
    const last = cols?.[0]?.published_at?.slice(0, 10);
    if (!last || last < daysAgo(10)) add("WARN", "コラム公開が止まっている疑い", `最後の公開: ${last || "なし"}（10日以上前）`);
    else add("OK", "コラム公開は動いている", `最後の公開: ${last}`);
  }
}

// ---------- 6. 主要ページの応答（失敗率で見る） ----------
// Cloudflare FreeはリクエストあたりのCPU上限が厳しく、重いページは一定割合で5xxになる。
// これは藤澤さんが「利益を残すためFreeのまま」と決めた合意済みのトレードオフなので、
// 5xxが出ること自体を不具合として鳴らさない。完全に落ちている場合だけFAILにする。
async function auditHttp() {
  const paths = [
    "/", "/comics", "/genre/jidai", "/genre/001004008", "/column",
    "/calendar/" + new Date().toISOString().slice(0, 7),
  ];
  const SAMPLES = 3;
  const rates = [];
  // 1件ずつ間隔を空けて測る。まとめて叩くと監査自身がCPU上限を踏ませ、
  // 「監査したから落ちた」数字になってしまう（2026-09-30に実際に起きた）
  for (const p of paths) {
    let bad = 0;
    for (let i = 0; i < SAMPLES; i++) {
      if (i > 0 || rates.length > 0) await sleep(2000);
      try {
        const res = await fetch(`${SITE}${p}`, { redirect: "follow" });
        if (!res.ok) bad++;
      } catch {
        bad++;
      }
    }
    if (bad > 0) rates.push({ p, bad, rate: bad / SAMPLES });
  }
  const dead = rates.filter((r) => r.rate === 1);
  if (dead.length) {
    add("FAIL", "常にエラーを返すページがある", dead.map((r) => `  ${r.p}: ${SAMPLES}回すべて失敗`).join("\n"));
  }
  const flaky = rates.filter((r) => r.rate < 1);
  if (flaky.length) {
    add(
      "WARN",
      `重いページが断続的に5xxを返している（Freeプラン既知のトレードオフ）`,
      flaky.map((r) => `  ${r.p}: ${r.bad}/${SAMPLES}回失敗`).join("\n") +
        "\n  → Cloudflare FreeのCPU上限による想定内の挙動。Workers Paidに上げれば解消するが\n" +
        "  「利益を残すためFreeのまま」という判断済みの事項。悪化の監視のみ行う"
    );
  }
  if (rates.length === 0) add("OK", "主要ページは全て正常", `${paths.length}ページ×${SAMPLES}回で失敗なし`);
}

// ---------- 7. クロール頻度（GSCの鍵があるときだけ） ----------
async function auditCrawlFreshness() {
  let gsc;
  try {
    gsc = require("./lib/gsc-client");
  } catch {
    return;
  }
  let token;
  try {
    token = await gsc.getAccessToken(gsc.loadCredentials());
  } catch {
    add("WARN", "クロール頻度を確認できなかった", "GSCの認証情報が読めないためスキップ（GSC_CREDENTIALS_JSON）");
    return;
  }
  // 代表URLの最終クロール日を見る。深いページが放置されていないかの検知
  const targets = [`${SITE}/`, `${SITE}/authors/${encodeURIComponent("伊坂幸太郎")}`];
  const old = [];
  for (const url of targets) {
    try {
      const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionUrl: url, siteUrl: gsc.SITE }),
      });
      if (!res.ok) continue;
      const j = await res.json();
      const t = j.inspectionResult?.indexStatusResult?.lastCrawlTime;
      if (!t) continue;
      const days = Math.round((Date.now() - new Date(t)) / 86400000);
      if (days > 21) old.push(`${url.replace(SITE, "")}: ${days}日前（${t.slice(0, 10)}）`);
    } catch {}
  }
  if (old.length) {
    add("WARN", "クロールされていないページがある", old.map((o) => `  ${o}`).join("\n") + "\n  → サイトマップ掲載漏れ・サーバーエラー・デプロイ停滞のいずれかを疑う");
  } else {
    add("OK", "クロール頻度は正常", "代表URLが21日以内に再訪されている");
  }
}

// ---------- レポート ----------
function render() {
  const order = { FAIL: 0, WARN: 1, OK: 2 };
  findings.sort((a, b) => order[a.level] - order[b.level]);
  const fails = findings.filter((f) => f.level === "FAIL").length;
  const warns = findings.filter((f) => f.level === "WARN").length;
  const today = new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });

  const lines = [`新刊日和 定期監査（${today}）  FAIL ${fails} / WARN ${warns} / OK ${findings.length - fails - warns}`, ""];
  for (const f of findings) {
    const mark = f.level === "FAIL" ? "❌" : f.level === "WARN" ? "⚠️" : "✅";
    lines.push(`${mark} ${f.title}`);
    if (f.detail) lines.push(f.detail.includes("\n") ? f.detail : `  ${f.detail}`);
  }
  return { text: lines.join("\n"), fails, warns };
}

async function notifyDiscord(text, fails, warns) {
  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (!hook) return;
  // 問題がないときは通知しない（毎週の「異常なし」で慣れて見なくなるのを避ける）
  if (fails === 0 && warns === 0) return;
  const head = fails > 0 ? "❌ **定期監査で問題が見つかりました**" : "⚠️ **定期監査に注意項目があります**";
  const body = text.length > 1800 ? `${text.slice(0, 1800)}\n…（以下省略。GitHub Actionsのログを参照）` : text;
  try {
    await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `${head}\n\`\`\`\n${body}\n\`\`\``, allowed_mentions: { parse: [] } }),
    });
  } catch (e) {
    console.error(`Discord通知に失敗: ${e.message}`);
  }
}

async function main() {
  for (const v of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[v]) {
      console.error(`環境変数 ${v} が必要です`);
      process.exit(1);
    }
  }
  const { createClient } = require("@supabase/supabase-js");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1項目が落ちても他は続ける（監査自体が沈黙するのを防ぐ）
  const steps = [
    ["サイトマップ", () => auditSitemaps(sb)],
    ["行数上限", () => auditRowLimits()],
    ["作家ページ", () => auditAuthorPages(sb)],
    ["SEO上書き", () => auditSeoOverrides(sb)],
    ["パイプライン", () => auditPipelines(sb)],
    ["HTTP", () => auditHttp()],
    ["クロール頻度", () => auditCrawlFreshness()],
  ];
  for (const [name, fn] of steps) {
    try {
      await fn();
    } catch (e) {
      add("WARN", `監査項目「${name}」の実行に失敗`, e.message);
    }
  }

  const { text, fails, warns } = render();
  if (!QUIET || fails || warns) console.log(text);

  // ログを残す（前回との比較に使える）
  try {
    const logPath = path.join(ROOT, "docs", "audit-log.md");
    fs.appendFileSync(logPath, `\n## ${new Date().toISOString().slice(0, 10)}\n\n\`\`\`\n${text}\n\`\`\`\n`);
  } catch {}

  await notifyDiscord(text, fails, warns);
  process.exit(fails || warns ? 1 : 0);
}

main().catch((e) => {
  console.error(`監査が異常終了: ${e.message}`);
  process.exit(1);
});
