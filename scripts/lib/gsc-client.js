// GSC(Google Search Console)のサービスアカウント認証＋クエリ実行。
// 標準cryptoのみ・googleapis不要。weekly-optimize.js / generate-hatena-themes.js が共用する。
//
// 必要な環境変数: GSC_CREDENTIALS_JSON（サービスアカウント鍵JSONの中身）
//   または GSC_SERVICE_ACCOUNT_KEY_PATH（鍵ファイルのパス）。
//   どちらも無ければ既定パス ~/secrets/gsc-shinkan-biyori-key.json を試す（ローカル用）。

const fs = require("fs");
const os = require("os");
const { createSign } = require("crypto");

const DEFAULT_KEY_PATH = require("path").join(os.homedir(), "secrets", "gsc-shinkan-biyori-key.json");
const SITE = "sc-domain:shinkanbiyori.com";

function loadCredentials() {
  if (process.env.GSC_CREDENTIALS_JSON) return JSON.parse(process.env.GSC_CREDENTIALS_JSON);
  const p = process.env.GSC_SERVICE_ACCOUNT_KEY_PATH || DEFAULT_KEY_PATH;
  if (fs.existsSync(p.replace(/^~/, os.homedir()))) {
    return JSON.parse(fs.readFileSync(p.replace(/^~/, os.homedir()), "utf8"));
  }
  throw new Error("GSC_CREDENTIALS_JSON か GSC_SERVICE_ACCOUNT_KEY_PATH を設定してください");
}

// scopeを差し替えれば同じ鍵で他のGoogle API（GA4等）にも使える
async function getAccessToken(creds, scope = "https://www.googleapis.com/auth/webmasters.readonly") {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: creds.client_email,
    scope,
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

// 認証込みで1回叩く簡易ヘルパー（呼び出し側でトークンを使い回したい場合はgetAccessToken+gscQueryを直接使う）
async function queryOnce(body) {
  const token = await getAccessToken(loadCredentials());
  return gscQuery(token, body);
}

module.exports = { SITE, loadCredentials, getAccessToken, gscQuery, queryOnce };
