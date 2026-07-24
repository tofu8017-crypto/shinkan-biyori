#!/usr/bin/env node
/**
 * books.description が空の本に、openBD の内容紹介（あらすじ）を埋める。
 * 楽天収集(fetch-books.js)は description:null で入れるだけなので、その穴埋め役。
 * 新しい本ほど検索需要が高いので発売日の新しい順に処理する。openBD にまだ無い本は
 * NULL のまま残り、翌日以降の実行で再挑戦される（openBD の反映遅れを自然に拾う）。
 *
 * 実行: node -r dotenv/config scripts/backfill-descriptions.js [--dry-run] [--max=3000]
 * 必要な環境変数: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require("@supabase/supabase-js");
const { pickDescription, fetchOpenBD } = require("./lib/openbd");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DRY_RUN   = process.argv.includes("--dry-run");
const MAX_BOOKS = Number((process.argv.find((a) => a.startsWith("--max=")) || "").split("=")[1]) || 3000;
const OPENBD_CHUNK = 400; // openBD は 1000件/回まで可。負荷を抑えて 400。
const SELECT_PAGE  = 1000; // Supabase の1回のselect上限

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// description が空(null/'')の isbn13 を発売日の新しい順にMAX_BOOKS件まで集める
async function fetchTargets(supabase) {
  const targets = [];
  for (let from = 0; targets.length < MAX_BOOKS; from += SELECT_PAGE) {
    const { data, error } = await supabase
      .from("books")
      .select("isbn13")
      .is("description", null)
      .order("published_date", { ascending: false })
      .range(from, from + SELECT_PAGE - 1);
    if (error) throw new Error(`select error: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) if (r.isbn13) targets.push(r.isbn13);
    if (data.length < SELECT_PAGE) break;
  }
  return targets.slice(0, MAX_BOOKS);
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("環境変数 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です。");
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const targets = await fetchTargets(supabase);
  console.log(`あらすじ未設定: ${targets.length}件を処理対象（新しい順・上限${MAX_BOOKS}）${DRY_RUN ? " [dry-run]" : ""}`);
  if (targets.length === 0) return;

  let filled = 0, notFound = 0, sampleShown = 0;
  for (let i = 0; i < targets.length; i += OPENBD_CHUNK) {
    const chunk = targets.slice(i, i + OPENBD_CHUNK);
    const obd = await fetchOpenBD(chunk);
    for (const isbn of chunk) {
      const desc = obd[isbn] ? pickDescription(obd[isbn]) : "";
      if (!desc) { notFound++; continue; }
      if (DRY_RUN) {
        if (sampleShown < 3) { console.log(`  [sample] ${isbn}: ${desc.slice(0, 60)}…`); sampleShown++; }
        filled++;
        continue;
      }
      const { error } = await supabase.from("books").update({ description: desc }).eq("isbn13", isbn);
      if (error) { console.error(`  update失敗 ${isbn}: ${error.message}`); continue; }
      filled++;
    }
    console.log(`  ...${Math.min(i + OPENBD_CHUNK, targets.length)}/${targets.length} 処理 (埋めた:${filled} / openBD該当なし:${notFound})`);
    await sleep(500); // openBD への連続アクセスを緩める
  }
  console.log(`✅ 完了: ${DRY_RUN ? "（dry-run・書き込みなし）" : ""}あらすじを ${filled}件埋めた / openBDに無し ${notFound}件`);
  if (targets.length >= MAX_BOOKS) {
    console.log(`⚠️ 上限${MAX_BOOKS}件で打ち切り。残りは次回実行で処理される。`);
  }
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
