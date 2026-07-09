// 遅延自動公開: 生成から一定時間（既定18h）以上たった下書きのうち、
// 品質ゲート(quality-check.js)を通った最良1本だけを published にする。
// 「生成→翌日公開」の取消し窓を作るのが目的（owner が前日分を消せば公開されない）。
//
// 判定キーは created_at（★updated_at は upsert/公開で毎回変わるため使わない）。
// 公開したURLを stdout に1行ずつ出す（後段の revalidate / IndexNow が受け取る）。
//
// 使い方: node -r dotenv/config scripts/auto-publish-due.js dotenv_config_path=.env.local

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = "https://shinkanbiyori.com";
const DELAY_HOURS = Number(process.env.PUBLISH_DELAY_HOURS) || 12;
const MAX_PER_RUN = Number(process.env.PUBLISH_MAX_PER_RUN) || 1; // 1日1本（量産ペナルティ低減）

function hoursAgoISO(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

// 「本日（JST）公開済みか」を正しく判定するためのJST午前0時（UTC表現）。
// cronは06:00 JST=21:00 UTCに動くため、UTC日付で判定すると同一UTC日の手動公開と衝突して誤スキップする。
function jstMidnightISO() {
  const jstDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  return new Date(jstDate + "T00:00:00+09:00").toISOString();
}

function passesQualityGate(col) {
  // quality-check.js にファイルで渡す。exit 0 で合格。
  const tmp = `/tmp/check-${col.slug}.json`;
  fs.writeFileSync(tmp, JSON.stringify(col));
  try {
    execFileSync("node", [path.join(__dirname, "quality-check.js"), tmp], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch (e) {
    const out = (e.stdout && e.stdout.toString()) || "";
    console.error(`  品質ゲート不合格: ${col.slug}\n${out}`);
    return false;
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("env未設定（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）");
    process.exit(1);
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const cutoff = hoursAgoISO(DELAY_HOURS);

  // 既に今日公開済みなら二重公開しない（1日1本ガード）。JST基準で判定。
  const todayStart = jstMidnightISO();
  const { count: publishedToday } = await sb
    .from("columns")
    .select("*", { count: "exact", head: true })
    .eq("status", "published")
    .gte("published_at", todayStart);
  if ((publishedToday || 0) >= MAX_PER_RUN) {
    console.log(`本日は既に ${publishedToday} 本公開済み。スキップ。`);
    return;
  }

  // 生成から DELAY_HOURS 以上たった下書き（新しい順）。
  // 以前は古い順(FIFO)で見ていたが、恒久的にゲートを通らない古い下書きが
  // limit件を埋めてしまうと新しい(改善後の)下書きが永遠に評価されない詰まりが
  // 発生した(2026-07-02〜09に実際発生)。新しい順にして詰まりを避ける。
  const { count: totalEligible } = await sb
    .from("columns")
    .select("*", { count: "exact", head: true })
    .eq("status", "draft")
    .lte("created_at", cutoff);
  // デバッグ用（2026-07-09・原因調査）: cutoff無しの全draft件数と最新3件のcreated_atを見る
  const { count: totalDraftAll } = await sb
    .from("columns").select("*", { count: "exact", head: true }).eq("status", "draft");
  const { data: newestDrafts } = await sb
    .from("columns").select("slug,created_at").eq("status", "draft")
    .order("created_at", { ascending: false }).limit(3);
  console.log(`[debug] cutoff=${cutoff} / draft総数(cutoff無視)=${totalDraftAll} / 最新3件=${JSON.stringify(newestDrafts)}`);
  const { data: drafts, error } = await sb
    .from("columns")
    .select("*")
    .eq("status", "draft")
    .lte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    console.error("下書き取得エラー:", error.message);
    process.exit(1);
  }
  console.log(`公開判定の対象: ${totalEligible || 0}件中、新しい順に${(drafts || []).length}件を評価`);
  if (!drafts || drafts.length === 0) {
    console.log("公開対象の下書きはありません。");
    return;
  }

  const published = [];
  for (const col of drafts) {
    if (published.length >= MAX_PER_RUN) break;
    if (!passesQualityGate(col)) continue;

    const patch = {
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await sb.from("columns").update(patch).eq("slug", col.slug);
    if (upErr) {
      console.error(`  公開更新エラー(${col.slug}): ${upErr.message}`);
      continue;
    }
    const url = `${SITE}/column/${col.slug}`;
    published.push(url);
    console.error(`  ✅ 公開: ${col.slug}`);
  }

  // 公開URLは stdout（後段が受け取る）。ログは stderr に出してある。
  for (const u of published) console.log(u);
  if (published.length === 0) console.error("品質ゲートを通る下書きがありませんでした。");
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
