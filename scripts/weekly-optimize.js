// 週次SEO自律改善ループ（GSC → 生成優先度 + title/meta改善）。純Node・Claudeトークン不使用。
//
// やること（3部構成）:
//   ① GSCの検索クエリから「実際に検索されている作家・書籍」を抽出し
//      data/gsc-priority.json に保存 → auto-generate.js が生成の優先順位に使う
//   ② 「表示はあるのに順位11〜30位」または「上位なのに低CTR」のページを抽出し、
//      DeepSeekでtitle/meta descriptionの改善案を生成 → seo_overrides にupsert
//      （ページ側の generateMetadata が override を優先表示する）
//   ③ 何をなぜ変えたかを docs/optimization-log.md に追記（ワークフローが自動コミット）
//
// 使い方:
//   ローカル: node scripts/weekly-optimize.js --dry-run
//     （.env.local と ~/secrets/gsc-shinkan-biyori-key.json を自動で読む）
//   GitHub Actions: GSC_CREDENTIALS_JSON='{...}' node scripts/weekly-optimize.js
//
// 必要な環境変数: GSC_CREDENTIALS_JSON（または GSC_SERVICE_ACCOUNT_KEY_PATH、
//   無ければ既定の鍵パスを試す） / NEXT_PUBLIC_SUPABASE_URL /
//   SUPABASE_SERVICE_ROLE_KEY / DEEPSEEK_API_KEY
//
// 安全装置: --dry-run（書き込み一切なし）／1回の書き換えは最大10ページ／
//   文字数・タグ混入のバリデーション／既存overrideは21日間は再書き換えしない
//   （Googleが反応する時間を与える。毎週書き換えると効果測定ができない）

const fs = require("fs");
const os = require("os");
const path = require("path");
const { createSign } = require("crypto");
const { createClient } = require("@supabase/supabase-js");

// ローカル実行時（envが揃っていない時）は .env.local を自動で読む。
// GitHub Actionsでは環境変数がSecretsから入るためこの分岐は通らない
// （--omit=devでdotenv自体も無い。try/catchで安全側に倒す）。
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
  } catch {}
}

const DRY_RUN = process.argv.includes("--dry-run");
// ローカルの鍵ファイルの既定パス（GSC_CREDENTIALS_JSON が無い時のフォールバック）
const DEFAULT_KEY_PATH = path.join(os.homedir(), "secrets", "gsc-shinkan-biyori-key.json");
const SITE = "sc-domain:shinkanbiyori.com";
const BASE_URL = "https://shinkanbiyori.com";
const WINDOW_DAYS = 28;          // 直近4週。データがまだ薄いので7日ではなく広めに見る
const MAX_OVERRIDES = 10;        // 1回の実行で書き換える上限（元設計の受け入れ条件）
const MIN_IMPRESSIONS = 5;       // これ未満のページはノイズとして対象外
const LOW_CTR = 0.02;            // 上位表示なのにCTR2%未満＝タイトルの魅力不足とみなす
const OVERRIDE_COOLDOWN_DAYS = 21;

const PRIORITY_PATH = path.join(__dirname, "..", "data", "gsc-priority.json");
const LOG_PATH = path.join(__dirname, "..", "docs", "optimization-log.md");

const DEEPSEEK_URL = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

const norm = (s) => (s || "").replace(/[\s　]/g, "").toLowerCase();
const plainText = (html) => (html || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// ラノベ/なろう系・成人向けの検出（auto-generate.js の LN_RE / NG_TITLE がベース。
// LN_REには皇国|皇女を追加=実データでの漏れ対策。
// 「基本ラノベなし」方針: 検索語や書名としてtitle/descriptionに混ぜない）
const LN_RE = /異世界|転生|転移|令嬢|公爵|侯爵|伯爵|婚約|聖女|勇者|魔王|魔導|スキル|チート|最強|追放|ハーレム|ヤンデレ|ダンジョン|迷宮|攻略|冒険者|辺境|領地|王太子|王女|騎士団|召喚|やり直し|無職|無双|モブ|な件|ざまぁ|二度目|スローライフ|悪役|ギルド|レベル|奴隷|VRMMO|ステータス|側妃|竜帝|世継ぎ|寵愛|嫁いで|皇国|皇女/;
const NG_TITLE = [
  "写真集", "グラビア", "アイドル", "ヌード", "av編集", "撮影会",
  "射精", "官能", "エロ", "18禁", "成人向け",
  "好色", "淫", "痴女", "巨乳", "爆乳", "中出", "寝取", "性奴隷", "人妻",
  "媚薬", "牝", "陵辱", "痴漢", "蜜夜", "ふたなり", "発情", "童貞", "絶頂", "性欲",
];
const isCleanText = (t) => !LN_RE.test(t || "") && !NG_TITLE.some((w) => (t || "").includes(w));

// ラノベ系レーベル・出版社（lib/is-light-novel.ts の PUBLISHER_KEYWORDS と同じ）。
// タイトル語だけでは漏れるラノベ（例:「死神騎士様と…」）を版元で捕まえる
const LN_PUBLISHERS = [
  "SBクリエイティブ", "GAノベル", "GA文庫", "電撃文庫", "MF文庫", "ファンタジア文庫",
  "オーバーラップ", "ヒーロー文庫", "アース・スター", "TOブックス", "マイクロマガジン",
  "一二三書房", "ホビージャパン", "ドラゴンノベルス", "スニーカー文庫",
  "ダッシュエックス", "角川スニーカー", "Mノベルス", "ツギクルブックス", "PASH!",
];
const isLnPublisher = (p) => LN_PUBLISHERS.some((w) => (p || "").includes(w));
// 「…2」「…（4）」のように巻数で終わるタイトル＝シリーズ続巻（看板の収録例には向かない）
const endsWithVolume = (t) => /[0-9０-９][）)]?$/.test((t || "").trim());

// auto-generate.js の titleKey と同じ（版違いをまとめるタイトルキー）
function titleKey(t) {
  return (t || "")
    .replace(/[【〔（(\[].*?[】〕）)\]]/g, "")
    .replace(/サイン本|新装版|完全版|愛蔵版|特装版|限定版|文庫版|新版|改訂版/g, "")
    .replace(/[\s　]/g, "")
    .toLowerCase();
}

function jstToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
function addDaysUTC(isoDate, n) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------- GSC認証（サービスアカウントJWT。googleapis不要・標準cryptoのみ） ----------

function loadCredentials() {
  if (process.env.GSC_CREDENTIALS_JSON) return JSON.parse(process.env.GSC_CREDENTIALS_JSON);
  const p = process.env.GSC_SERVICE_ACCOUNT_KEY_PATH || DEFAULT_KEY_PATH;
  if (fs.existsSync(p.replace(/^~/, os.homedir()))) {
    return JSON.parse(fs.readFileSync(p.replace(/^~/, os.homedir()), "utf8"));
  }
  throw new Error("GSC_CREDENTIALS_JSON か GSC_SERVICE_ACCOUNT_KEY_PATH を設定してください");
}

async function getAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  const jwt = `${unsigned}.${sign.sign(creds.private_key).toString("base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Google認証に失敗: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

async function gscQuery(token, body) {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`GSC APIエラー: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).rows || [];
}

// ---------- ① 検索需要 → 生成優先度（data/gsc-priority.json） ----------

// 在庫（直近180日の文芸書）の作家・タイトルとGSCクエリを突き合わせる。
// auto-generate.js の collectAuthorStats と同じ母集団の条件に揃える。
const LITERARY_GENRES = ["001004008", "001004009", "001004001", "001004002", "001004003", "001019"];

async function fetchInventory(sb) {
  const today = jstToday();
  const since = addDaysUTC(today, -180);
  const { data, error } = await sb
    .from("books")
    .select("author,title")
    .in("genre_id", LITERARY_GENRES)
    .not("publisher", "ilike", "%ハーレクイン%")
    .not("publisher", "ilike", "%ハーパーコリンズ%")
    .gte("published_date", since)
    .lte("published_date", today)
    .limit(3000);
  if (error) throw new Error(error.message);
  return data || [];
}

// クエリから「あらすじ」「発売日」等の修飾語を落とし、固有名詞部分を残す
const QUERY_SUFFIX_RE =
  /(あらすじ|ネタバレ|発売日|発売|新刊|最新刊|最新作|代表作|おすすめ|お勧め|オススメ|感想|レビュー|評価|順番|読む順|続編|何巻|\d+巻|巻|文庫|単行本|小説|作品|一覧|とは)/g;

function buildPriority(queryRows, inventory) {
  // 作家名 -> 集計 / タイトルキー -> 集計
  const authorHits = new Map();
  const titleHits = new Map();

  const authors = new Map(); // normName -> 表示名
  const titles = new Map(); // titleKey -> {title, author}
  for (const b of inventory) {
    const a = (b.author || "").split("/")[0].trim();
    if (a && norm(a).length >= 3) authors.set(norm(a), a);
    const tk = titleKey(b.title);
    if (tk.length >= 4) titles.set(tk, { title: b.title, author: a });
  }

  for (const row of queryRows) {
    const q = norm(row.keys[0]);
    const qCore = q.replace(QUERY_SUFFIX_RE, "");
    for (const [na, display] of authors) {
      if (!q.includes(na)) continue;
      const e = authorHits.get(na) || { author: display, impressions: 0, clicks: 0 };
      e.impressions += row.impressions;
      e.clicks += row.clicks;
      authorHits.set(na, e);
    }
    if (qCore.length >= 4) {
      for (const [tk, info] of titles) {
        if (!tk.includes(qCore) && !qCore.includes(tk)) continue;
        const e = titleHits.get(tk) || { ...info, impressions: 0, clicks: 0 };
        e.impressions += row.impressions;
        e.clicks += row.clicks;
        titleHits.set(tk, e);
      }
    }
  }

  const byDemand = (a, b) => b.clicks - a.clicks || b.impressions - a.impressions;
  return {
    updated: jstToday(),
    window_days: WINDOW_DAYS,
    authors: [...authorHits.values()].sort(byDemand),
    titles: [...titleHits.values()].sort(byDemand),
  };
}

// ---------- ② 惜しいページの title/meta 改善（seo_overrides） ----------

// GSCのページURL → seo_overrides の (target_type, target_key)
// ページ側の generateMetadata が同じキーで引く（lib/supabase.ts の getSeoOverride）
function parseTarget(url) {
  const p = url.replace(BASE_URL, "");
  let m;
  if ((m = p.match(/^\/books\/(\d{13})$/))) return { type: "book", key: m[1] };
  if ((m = p.match(/^\/authors\/([^/?#]+)$/))) return { type: "author", key: decodeURIComponent(m[1]) };
  if ((m = p.match(/^\/column\/([a-z0-9-]+)$/))) return { type: "column", key: m[1] };
  if ((m = p.match(/^\/calendar\/(\d{4}-\d{2})$/))) return { type: "calendar", key: m[1] };
  return null; // トップ・ジャンル・検索などは対象外
}

function isCandidate(stat) {
  if (stat.impressions < MIN_IMPRESSIONS) return false;
  if (stat.position >= 11 && stat.position <= 30) return true; // 改善余地が最大のゾーン
  if (stat.position <= 10 && stat.ctr < LOW_CTR) return true; // 上位なのにクリックされない
  return false;
}

// 改善対象ページの現状情報（DeepSeekに渡す材料）をDBから集める。
// 捏造防止のため「ページに実際にある事実」（内容紹介・本文抜粋・実際の収録本）まで渡す。
async function fetchPageContext(sb, target) {
  if (target.type === "book") {
    const { data } = await sb
      .from("books")
      .select("title,author,publisher,published_date,description")
      .eq("isbn13", target.key)
      .maybeSingle();
    if (!data) return null;
    const desc = plainText(data.description).slice(0, 300);
    return {
      label:
        `書籍詳細: 『${data.title}』（${data.author}／${data.publisher}、${data.published_date}発売）\n` +
        `内容紹介: ${desc || "（資料なし。内容には触れず、書名・著者・発売日の事実だけで書くこと）"}`,
      currentTitle: `${data.title} の発売日・あらすじ`,
    };
  }
  if (target.type === "author") {
    const { data } = await sb
      .from("books")
      .select("title,published_date")
      .ilike("author", `%${target.key}%`)
      .order("published_date", { ascending: false })
      .limit(5);
    const books = (data || []).filter((b) => isCleanText(b.title));
    if (books.length === 0) return null;
    return {
      label: `作家ページ: ${target.key}の新刊一覧（掲載: ${books.map((b) => `『${b.title}』`).join("、")}）`,
      currentTitle: `${target.key}の新刊一覧・最新刊【2026年最新】`,
    };
  }
  if (target.type === "column") {
    const { data } = await sb
      .from("columns")
      .select("title,excerpt,body_html")
      .eq("slug", target.key)
      .maybeSingle();
    if (!data) return null;
    return {
      label:
        `コラム記事: 「${data.title}」（現在の説明文: ${data.excerpt || "なし"}）\n` +
        `本文冒頭: ${plainText(data.body_html).slice(0, 400)}`,
      currentTitle: data.title,
    };
  }
  if (target.type === "calendar") {
    const [y, mo] = target.key.split("-").map(Number);
    const from = `${target.key}-01`;
    const to = `${target.key}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0")}`;
    const { data } = await sb
      .from("books")
      .select("title,author,publisher")
      .in("genre_id", LITERARY_GENRES)
      .gte("published_date", from)
      .lte("published_date", to)
      .order("published_date")
      .limit(200);
    const names = (data || [])
      .filter(
        (b) =>
          isCleanText(b.title) &&
          isCleanText(b.author) &&
          !isLnPublisher(b.publisher) &&
          !endsWithVolume(b.title)
      )
      .slice(0, 6)
      .map((b) => `『${b.title}』(${b.author})`);
    return {
      label:
        `月別カレンダー: ${y}年${mo}月の文芸新刊一覧ページ` +
        (names.length ? `（収録例: ${names.join("、")}）` : ""),
      currentTitle: `${y}年${mo}月の文芸新刊一覧｜発売日順`,
    };
  }
  return null;
}

async function generateImprovement(target, ctx, stat) {
  // ラノベ・成人向けの検索語は材料から除外（文芸サイトの看板に混ぜない）
  const topQueries = stat.queries
    .filter((q) => isCleanText(q.query))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5)
    .map((q) => `「${q.query}」(表示${q.impressions}回・${q.position.toFixed(0)}位)`)
    .join("、");

  const system = `あなたは日本語SEOの専門家です。文芸書の新刊情報サイト「新刊日和」のページの検索結果表示（title・meta description）を改善します。
必ずJSONだけを返す: {"title": "...", "description": "..."}
ルール:
- titleは15〜32文字。サイト名「新刊日和」は自動で付くので含めない。検索クエリの語を自然に含め、クリックしたくなる具体性を持たせる（煽り・記号の乱用・偽りの数字は禁止）
- descriptionは60〜120文字
- 【最重要】書いてよいのは、資料に明記された事実（書名・著者・発売日・内容紹介・本文冒頭・収録例）だけ。資料に無い書名・数字（「◯選」等）・内容の説明・評価を推測で書くことは絶対に禁止。本の内容が資料から分からなければ、内容には触れず確かな事実だけで構成する
- 次のページ共通機能は事実として書いてよい: 書籍ページ=発売日・書誌情報・Amazon/楽天リンク・同じ著者の他の新刊、作家ページ=その作家の新刊一覧と発売日、カレンダー=その月の文芸新刊の発売日順一覧
- 「!」「?」「★」等の記号乱用、「必見」「衝撃」等の煽り語は使わない`;

  const user = `対象ページ: ${ctx.label}
現在のtitle: ${ctx.currentTitle}
検索実績: 過去${WINDOW_DAYS}日で表示${stat.impressions}回・クリック${stat.clicks}回・平均${stat.position.toFixed(1)}位
このページが表示された主な検索語: ${topQueries || "（データなし）"}
課題: ${stat.position > 10 ? "11〜30位圏で伸び悩んでいる。検索語との関連が伝わるtitle/descriptionにして順位とCTRを上げたい" : "上位表示なのにクリックされていない。検索結果で魅力が伝わるtitle/descriptionにしたい"}`;

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek APIエラー: ${res.status}`);
  const out = JSON.parse((await res.json()).choices?.[0]?.message?.content || "{}");

  // バリデーション（暴走防止）: 長さ・タグ混入・空・ラノベ/成人向け語をはじく。
  // ダメならこのページはスキップ（元のtitle/metaのまま＝安全側）。理由はログに出す
  const title = (out.title || "").trim();
  const description = (out.description || "").trim();
  const reject = (why) => {
    console.log(`     不採用(${why}): title="${title}" desc="${description.slice(0, 60)}…"`);
    return null;
  };
  if (title.length < 10 || title.length > 40) return reject(`title ${title.length}字`);
  if (description.length < 40 || description.length > 140) return reject(`description ${description.length}字`);
  if (/[<>]/.test(title + description)) return reject("タグ混入");
  if (!isCleanText(title + description)) return reject("ラノベ/成人向け語");
  return { title, description };
}

// ---------- メイン ----------

async function main() {
  for (const v of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DEEPSEEK_API_KEY"]) {
    if (!process.env[v]) {
      console.error(`環境変数 ${v} が未設定です`);
      process.exit(1);
    }
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const today = jstToday();
  const startDate = addDaysUTC(today, -WINDOW_DAYS);
  const endDate = addDaysUTC(today, -1); // 当日分は集計途中なので含めない

  console.log(`GSC自律改善ループ${DRY_RUN ? "（dry-run: 書き込みなし）" : ""}: ${startDate}〜${endDate}`);

  const token = await getAccessToken(loadCredentials());

  // ページ別（正確な表示回数・順位。匿名化クエリの分も含まれる）と
  // ページ×クエリ（改善案の材料になる検索語。匿名化分は含まれない＝件数は少なめ）を
  // 別々に取得する。1回のpage×queryだけで済ませると表示回数が実際の1/3程度に見えてしまう。
  const pageRows = await gscQuery(token, {
    startDate,
    endDate,
    dimensions: ["page"],
    rowLimit: 5000,
    dataState: "all",
  });
  const pqRows = await gscQuery(token, {
    startDate,
    endDate,
    dimensions: ["page", "query"],
    rowLimit: 5000,
    dataState: "all",
  });
  console.log(`GSCデータ: ${pageRows.length}ページ・${pqRows.length}行（ページ×クエリ）`);

  const pageStats = new Map();
  for (const r of pageRows) {
    pageStats.set(r.keys[0], {
      page: r.keys[0],
      impressions: r.impressions,
      clicks: r.clicks,
      position: r.position,
      ctr: r.ctr,
      queries: [],
    });
  }
  const queryTotals = new Map();
  for (const r of pqRows) {
    const [page, query] = r.keys;
    pageStats
      .get(page)
      ?.queries.push({ query, impressions: r.impressions, clicks: r.clicks, position: r.position });

    const q = queryTotals.get(query) || { keys: [query], impressions: 0, clicks: 0 };
    q.impressions += r.impressions;
    q.clicks += r.clicks;
    queryTotals.set(query, q);
  }
  const siteImpressions = [...pageStats.values()].reduce((a, s) => a + s.impressions, 0);
  const siteClicks = [...pageStats.values()].reduce((a, s) => a + s.clicks, 0);

  // ---- ① 生成優先度 ----
  const inventory = await fetchInventory(sb);
  const priority = buildPriority([...queryTotals.values()], inventory);
  console.log(
    `\n① 検索需要: 作家${priority.authors.length}名・書籍${priority.titles.length}冊が在庫と一致` +
      (priority.authors.length
        ? `（作家上位: ${priority.authors.slice(0, 5).map((a) => a.author).join("、")}）`
        : "")
  );
  if (!DRY_RUN) {
    fs.writeFileSync(PRIORITY_PATH, JSON.stringify(priority, null, 2) + "\n");
    console.log(`  → ${path.relative(process.cwd(), PRIORITY_PATH)} を更新`);
  }

  // ---- ② title/meta改善 ----
  const candidates = [...pageStats.values()]
    .filter(isCandidate)
    .map((s) => ({ ...s, target: parseTarget(s.page) }))
    .filter((s) => s.target)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, MAX_OVERRIDES);

  console.log(`\n② 改善候補: ${candidates.length}ページ（表示${MIN_IMPRESSIONS}回以上で11〜30位、または上位でCTR${LOW_CTR * 100}%未満）`);

  // 21日以内に書き換え済みのページは見送る（効果測定の時間を確保）
  const cooldownSince = new Date(Date.now() - OVERRIDE_COOLDOWN_DAYS * 86400000).toISOString();
  const { data: recent } = await sb
    .from("seo_overrides")
    .select("target_type,target_key,updated_at")
    .gte("updated_at", cooldownSince);
  const recentKeys = new Set((recent || []).map((r) => `${r.target_type}:${r.target_key}`));

  const applied = [];
  for (const c of candidates) {
    const keyId = `${c.target.type}:${c.target.key}`;
    if (recentKeys.has(keyId)) {
      console.log(`  - ${c.page} … ${OVERRIDE_COOLDOWN_DAYS}日以内に変更済みのため見送り`);
      continue;
    }
    try {
      const ctx = await fetchPageContext(sb, c.target);
      if (!ctx) {
        console.log(`  - ${c.page} … DBに情報が見つからずスキップ`);
        continue;
      }
      const improved = await generateImprovement(c.target, ctx, c);
      if (!improved) {
        console.log(`  - ${c.page} … 生成結果がバリデーションを通らずスキップ`);
        continue;
      }
      const reason =
        c.position > 10
          ? `平均${c.position.toFixed(1)}位・表示${c.impressions}回（11〜30位の改善ゾーン）`
          : `平均${c.position.toFixed(1)}位・表示${c.impressions}回でクリック${c.clicks}回（低CTR）`;
      console.log(`  ✏ ${c.page}`);
      console.log(`     理由: ${reason}`);
      console.log(`     title: ${improved.title}`);
      console.log(`     desc : ${improved.description}`);
      if (!DRY_RUN) {
        const { error } = await sb.from("seo_overrides").upsert(
          {
            target_type: c.target.type,
            target_key: c.target.key,
            title: improved.title,
            description: improved.description,
            note: reason,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "target_type,target_key" }
        );
        if (error) throw new Error(error.message);
      }
      applied.push({ ...c, improved, reason });
    } catch (e) {
      console.error(`  - ${c.page} … 失敗（他は継続）: ${e.message}`);
    }
  }

  // ---- ③ 監査ログ ----
  const log = [
    `## ${today}（自動実行）`,
    ``,
    `- 対象期間: ${startDate}〜${endDate}（${WINDOW_DAYS}日間） / サイト全体: 表示${siteImpressions}回・クリック${siteClicks}回`,
    `- 生成優先度: 検索実績のある作家${priority.authors.length}名・書籍${priority.titles.length}冊を data/gsc-priority.json に反映` +
      (priority.authors.length
        ? `（作家上位: ${priority.authors.slice(0, 5).map((a) => a.author).join("、")}）`
        : ""),
    applied.length
      ? `- title/meta改善: ${applied.length}ページ`
      : `- title/meta改善: 対象なし（候補${candidates.length}件）`,
    ...applied.flatMap((a) => [
      `  - ${a.page.replace(BASE_URL, "")}`,
      `    - 理由: ${a.reason}`,
      `    - 新title: ${a.improved.title}`,
      `    - 新description: ${a.improved.description}`,
    ]),
    ``,
  ].join("\n");

  if (DRY_RUN) {
    console.log(`\n--- optimization-log.md への追記内容（dry-runのため書き込みなし） ---\n${log}`);
  } else {
    const header = `# SEO自律改善ログ\n\n週次ワークフロー（weekly-optimize.yml）が「いつ・どのページを・なぜ・どう変えたか」を自動追記する。\n\n`;
    const existing = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, "utf8") : header;
    // 新しい実行を上に積む（ヘッダー直後に挿入）
    const idx = existing.indexOf("\n## ");
    const updated =
      idx === -1 ? existing + log : existing.slice(0, idx + 1) + log + existing.slice(idx + 1);
    fs.writeFileSync(LOG_PATH, updated);
    console.log(`\n③ ${path.relative(process.cwd(), LOG_PATH)} に追記しました`);
  }

  console.log(`\n完了: 優先度更新 + title/meta改善${applied.length}件${DRY_RUN ? "（dry-run）" : ""}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error("エラー:", e.message);
    process.exit(1);
  });
}

// 照合・解析ロジックの動作確認用（require時のみ）
module.exports = { buildPriority, parseTarget, isCandidate, titleKey, isCleanText, isLnPublisher, endsWithVolume };
