#!/usr/bin/env node
/**
 * books.description が空の本に、楽天ブックスAPIの itemCaption（あらすじ/商品説明）を埋める。
 *
 * 主役は fetch-books.js で、収集窓（過去95日〜近刊）の本は日次収集時に description が入る。
 * このスクリプトはその「窓より古い在庫」を少しずつ埋めるための補助。1回で埋めきらず、
 * 発売日の新しい順に上限件数だけ処理し、残りは翌日以降の実行で片付ける。
 * itemCaption が無い本(約3割)は null のまま残るが、それは楽天側にデータが無いだけ。
 *
 * openBD ではなく楽天を使う理由: このサイトの蔵書は楽天新刊中心で、
 * openBDの内容紹介カバー率は約4%しかない一方、楽天itemCaptionは約7割に付く（実測）。
 *
 * 実行: node scripts/backfill-descriptions.js [--dry-run] [--max=400]
 * 必要な環境変数: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *                 RAKUTEN_APP_ID, RAKUTEN_ACCESS_KEY
 */

const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { cleanDescription } = require("./lib/openbd");

// ローカル実行時は .env.local を読む（weekly-optimize.js と同じ方式）。
// GitHub Actions では env が Secrets から入るのでこの分岐は通らない。
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
  } catch {}
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID;
const RAKUTEN_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;

const DRY_RUN   = process.argv.includes("--dry-run");
const MAX_BOOKS = Number((process.argv.find((a) => a.startsWith("--max=")) || "").split("=")[1]) || 400;
const SELECT_PAGE = 1000; // Supabase の1回のselect上限
const REQ_INTERVAL = 700; // 楽天APIへの間隔(ms)。レート制限に配慮

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 楽天ブックスAPIで1冊をISBN検索し itemCaption を返す（無ければ ""）
async function fetchCaption(isbn) {
  const p = new URLSearchParams({
    applicationId: RAKUTEN_APP_ID,
    accessKey: RAKUTEN_ACCESS_KEY,
    isbn,
    hits: "1",
    formatVersion: "2",
  });
  const url = `https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404?${p}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Referer: "https://shinkanbiyori.com" } });
      if (res.status === 429) { await sleep(2000 * attempt); continue; } // レート制限
      if (!res.ok) throw new Error(`Rakuten ${res.status}`);
      const data = await res.json();
      return (data.Items?.[0]?.itemCaption || "").trim();
    } catch (e) {
      if (attempt === 3) { console.error(`  取得失敗 ${isbn}: ${e.message}`); return ""; }
      await sleep(1000 * attempt);
    }
  }
  return "";
}

// description が空(null)の isbn13 を発売日の新しい順にMAX_BOOKS件まで集める
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
  for (const [name, v] of [["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL], ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY], ["RAKUTEN_APP_ID", RAKUTEN_APP_ID], ["RAKUTEN_ACCESS_KEY", RAKUTEN_ACCESS_KEY]]) {
    if (!v) { console.error(`環境変数 ${name} が必要です。`); process.exit(1); }
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const targets = await fetchTargets(supabase);
  console.log(`あらすじ未設定: ${targets.length}件を処理（新しい順・上限${MAX_BOOKS}）${DRY_RUN ? " [dry-run]" : ""}`);
  if (targets.length === 0) return;

  let filled = 0, notFound = 0, sampleShown = 0;
  for (const isbn of targets) {
    const cap = await fetchCaption(isbn);
    await sleep(REQ_INTERVAL);
    const desc = cleanDescription(cap);
    if (!desc) { notFound++; continue; }
    if (DRY_RUN) {
      if (sampleShown < 3) { console.log(`  [sample] ${isbn}: ${desc.slice(0, 60)}…`); sampleShown++; }
      filled++;
      continue;
    }
    const { error } = await supabase.from("books").update({ description: desc }).eq("isbn13", isbn);
    if (error) { console.error(`  update失敗 ${isbn}: ${error.message}`); continue; }
    filled++;
    if (filled % 50 === 0) console.log(`  ...${filled}件埋めた / 楽天に説明なし ${notFound}件`);
  }
  console.log(`✅ 完了: ${DRY_RUN ? "（dry-run・書き込みなし）" : ""}あらすじを ${filled}件埋めた / 楽天に説明なし ${notFound}件`);
  if (targets.length >= MAX_BOOKS) {
    console.log(`⚠️ 上限${MAX_BOOKS}件で打ち切り。残りは次回実行で処理される。`);
  }
}

main().catch((e) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
