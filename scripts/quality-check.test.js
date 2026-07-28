// 最小の自己チェック: node scripts/quality-check.test.js （ネットワーク・DB不要）
// auto-generate.js の gateReasons() は quality-check.js の「stdoutにJSON・不合格でexit 1」
// という契約に乗っている。ここが崩れると生成側が理由を拾えず黙って素通りするので固定する。
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const QC = path.join(__dirname, "quality-check.js");

// Supabase envが無い環境で走らせる（quality-check.js側は env 無しなら重複チェックをスキップする）
const env = { ...process.env };
delete env.NEXT_PUBLIC_SUPABASE_URL;
delete env.SUPABASE_SERVICE_ROLE_KEY;
delete env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function check(col) {
  const p = path.join(os.tmpdir(), `qc-test-${col.slug}.json`);
  fs.writeFileSync(p, JSON.stringify(col));
  try {
    const out = execFileSync("node", [QC, p], { encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, json: JSON.parse(out) };
  } catch (e) {
    return { code: e.status, json: JSON.parse((e.stdout || "").toString()) };
  } finally {
    fs.unlinkSync(p);
  }
}

const body = (chars) =>
  `<h2>堂場瞬一 おすすめの新刊</h2><p>${"あ".repeat(chars)}</p><p><a href="/authors/x">堂場瞬一</a></p>`;

// 不合格: exit 1 かつ stdout に reasons 入りJSON（gateReasonsが読む形）
const short = check({ slug: "t-short", title: "堂場瞬一 おすすめの新刊", target_keyword: "堂場瞬一 おすすめ", body_html: body(100) });
assert.strictEqual(short.code, 1);
assert.ok(short.json.reasons.some((r) => r.includes("本文が短い")), short.json.reasons.join("/"));

// 実際に詰まっていたケース: 字数は足りるのに最初のh2にキーワードが無くて落ちる
const badH2 = check({
  slug: "t-h2",
  title: "堂場瞬一 おすすめの新刊",
  target_keyword: "堂場瞬一 おすすめ",
  body_html: `<h2>2026年6月の新刊</h2><p>${"あ".repeat(2000)}</p><p><a href="/authors/x">堂場瞬一</a></p>`,
});
assert.strictEqual(badH2.code, 1);
assert.deepStrictEqual(badH2.json.reasons.length, 1);
assert.ok(badH2.json.reasons[0].includes("h2にキーワード不足"), badH2.json.reasons[0]);

// 合格: exit 0 かつ reasons 空（gateReasonsは [] を返す）
const ok = check({ slug: "t-ok", title: "堂場瞬一 おすすめの新刊", target_keyword: "堂場瞬一 おすすめ", body_html: body(2000) });
assert.strictEqual(ok.code, 0);
assert.deepStrictEqual(ok.json.reasons, []);

console.log("quality-check.test.js: OK");
