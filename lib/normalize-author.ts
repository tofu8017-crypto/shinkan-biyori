// 著者名の正規化と連名分割。
// 楽天APIの author フィールドは「姓 名」「姓　名（全角空白）」の表記揺れや、
// 共著・訳者を「/」「／」「、」「,」で連結した文字列で返ってくる。
// 著者ページ(/authors/[slug])で同一著者をまとめるには、これらを正規化して
// 1人ずつに分割する必要がある。

// 末尾の役割表記（「著」「訳」「編」「監修」など、括弧付き含む）を除去する。
// 例: "村上春樹 (著)" → "村上春樹" / "柴田元幸 訳" → "柴田元幸"
function stripRole(name: string): string {
  return name
    .replace(/[（(][^）)]*[）)]\s*$/u, "") // 末尾の (著) 等
    .replace(/\s*(著|訳|編|編著|監修|原作|画|絵|写真|解説)\s*$/u, "")
    .trim();
}

// 1人分の著者名を正規化する。
// ・前後の空白を除去
// ・姓名間の連続する空白（半角/全角混在）を半角スペース1個に統一
// ・役割表記を除去
export function normalizeAuthorName(raw: string): string {
  return stripRole(raw.trim().replace(/[\s　]+/g, " "));
}

// 連名を1人ずつに分割し、正規化した著者名の配列を返す。
// 区切り文字: / ／ ・(中黒は連名と外国人名のミドルが曖昧なので使わない) 、 , ；ではなく
// 楽天で実際に使われる "/" "／" "、" "," を対象にする。
export function splitAuthors(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[/／、,]/u)
    .map(normalizeAuthorName)
    .filter((n) => n.length > 0);
}

// 著者名から URL 用 slug を生成する。
// 日本語URLはGoogle的に問題ないため、空白を除いた正規化名をそのまま
// URIエンコードする。空白の有無で別ページに割れないよう空白は除去する。
export function authorSlug(name: string): string {
  return encodeURIComponent(normalizeAuthorName(name).replace(/\s/g, ""));
}

// slug を表示用の著者名候補に戻す（デコードのみ。空白は復元できない点に注意）。
export function decodeAuthorSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

// 2つの著者名が（空白を無視して）同一人物を指すかを判定する。
export function isSameAuthor(a: string, b: string): boolean {
  const strip = (s: string) => normalizeAuthorName(s).replace(/\s/g, "");
  return strip(a) === strip(b);
}
