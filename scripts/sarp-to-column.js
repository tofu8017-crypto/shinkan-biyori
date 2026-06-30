// SARPブリッジ生成のIR(JSON: title/sections[].sentences[])を新刊日和のコラム形式に変換し、
// 在庫本リンク＋出典を足して /tmp/column-<slug>.json に保存する（→ save-column.js で掲載）。
// 使い方: node -r dotenv/config scripts/sarp-to-column.js <irPath> <slug> <target_keyword> <author> [genre_id] dotenv_config_path=.env.local
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const [irPath, slug, targetKw, author, genreId = "001004003"] = process.argv.slice(2);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TAG = "shinkanbiyori-22";
const SITE = "https://shinkanbiyori.com";
const SRC_URL = "https://www.shogakukan.co.jp/news/402594"; // s001 出典

const esc = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const titleKey = (t) => (t || "").replace(/[【〔（(\[].*?[】〕）)\]]/g, "").replace(/サイン本|新装版|完全版|愛蔵版|特装版|限定版|文庫版|新版|改訂版/g, "").replace(/[\s　]/g, "").toLowerCase();
const amazonUrl = (b) => (b.isbn10 ? `https://www.amazon.co.jp/dp/${b.isbn10}?tag=${TAG}` : `https://www.amazon.co.jp/s?k=${encodeURIComponent(b.isbn13 || b.title)}&tag=${TAG}`);

async function main() {
  const ir = JSON.parse(fs.readFileSync(irPath, "utf8"));
  const sb = createClient(SUPABASE_URL, KEY);

  // 在庫の著者本（版違い除去）。掲載コラムに内部リンク＋アフィリンクとして足す。
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 180);
  const since = d.toISOString().slice(0, 10);
  // DBの著者名はスペース有無が揺れる（「佐藤 愛子」/「佐藤愛子」）。文字間に%を挟んで両方拾う。
  const pat = "%" + author.replace(/[\s　]/g, "").split("").join("%") + "%";
  const { data } = await sb.from("books")
    .select("title,author,publisher,isbn10,isbn13,published_date")
    .ilike("author", pat)
    .gte("published_date", since).lte("published_date", today)
    .order("published_date", { ascending: false }).limit(20);
  const seen = new Set(); const books = [];
  for (const b of data || []) { const k = titleKey(b.title); if (seen.has(k)) continue; seen.add(k); books.push(b); if (books.length >= 6) break; }

  // 本文HTML：見出し(h2)＋段落(p)。同一見出し内の文を1段落にまとめる。
  let html = "";
  for (const sec of ir.sections) {
    const tag = sec.level === 3 ? "h3" : "h2";
    html += `<${tag}>${esc(sec.heading)}</${tag}>`;
    const text = sec.sentences.map((s) => esc(s.text)).join("");
    if (text) html += `<p>${text}</p>`;
  }

  // 在庫本リンク（新刊・近刊として内部リンク＋購入リンク）
  if (books.length) {
    html += `<h2>${esc(author)}の新刊・近刊を新刊日和でチェック</h2>`;
    html += `<ul>`;
    for (const b of books) {
      const bp = `${SITE}/books/${b.isbn13}`;
      html += `<li><a href="${bp}">『${esc(b.title)}』</a>（${esc(b.publisher || "")}） — <a href="${amazonUrl(b)}" rel="nofollow sponsored">Amazon</a></li>`;
    }
    html += `</ul>`;
  }

  // 出典
  html += `<h2>出典</h2><p><a href="${SRC_URL}" rel="nofollow">佐藤愛子さん、最後のエッセイ集『九十八歳。戦いやまず日は暮れず』ほか（小学館）</a></p>`;

  html = html.replace(/[\r\n\t]+/g, " ").trim();

  // excerpt（meta）= 導入の非主張文から
  const intro = ir.sections[0]?.sentences?.map((s) => s.text).join("") || "";
  const excerpt = intro.slice(0, 110);

  const col = {
    slug: slug.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").toLowerCase(),
    title: ir.title,
    body_html: html,
    excerpt,
    target_keyword: targetKw,
    genre_id: genreId,
    status: "published",
  };
  const outPath = `/tmp/column-${col.slug}.json`;
  fs.writeFileSync(outPath, JSON.stringify(col));
  console.log("出力:", outPath);
  console.log("title:", col.title);
  console.log("在庫本リンク:", books.length, "冊 ->", books.map((b) => b.title).join(" / "));
  console.log("本文プレーン長:", html.replace(/<[^>]+>/g, "").length, "字");
}
main().catch((e) => { console.error("エラー:", e.message); process.exit(1); });
