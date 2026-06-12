// シリーズ判定。タイトル末尾の巻数表記を抽出し、巻数を除いたベースタイトルで
// 書籍をグルーピングする。クエリ「シリーズ名 最新刊」「○○ 何巻まで」の受け皿
// （/series/[slug]）を作るための土台。
// 完璧な判定は目指さない。2冊以上が同じベースタイトルにマッチしたものだけを
// シリーズとして扱い、誤検出より取りこぼしを許容する方針。

import type { Book } from "@/types/book";

// 漢数字（十二まで＋簡易な十N）をアラビア数字へ。失敗時は null。
function kanjiToNumber(s: string): number | null {
  const map: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  };
  if (/^[一二三四五六七八九]$/.test(s)) return map[s];
  if (s === "十") return 10;
  // 十一〜十九
  let m = s.match(/^十([一二三四五六七八九])$/);
  if (m) return 10 + map[m[1]];
  // 二十〜九十九
  m = s.match(/^([二三四五六七八九])十([一二三四五六七八九])?$/);
  if (m) return map[m[1]] * 10 + (m[2] ? map[m[2]] : 0);
  return null;
}

// ローマ数字（I〜XX程度）をアラビア数字へ。失敗時は null。
function romanToNumber(s: string): number | null {
  const map: Record<string, number> = { I: 1, V: 5, X: 10 };
  const u = s.toUpperCase();
  if (!/^[IVX]+$/.test(u)) return null;
  let total = 0;
  let prev = 0;
  for (let i = u.length - 1; i >= 0; i--) {
    const v = map[u[i]];
    if (v < prev) total -= v;
    else { total += v; prev = v; }
  }
  return total > 0 && total <= 39 ? total : null;
}

export type SeriesInfo = {
  base: string;     // 巻数を除いたベースタイトル
  volume: number;   // 抽出した巻数
};

// タイトル末尾の巻数表記を抽出する。マッチしなければ null。
// 対応パターン（末尾）:
//   『…』（2） / （２） / (2)        全角半角の括弧つき数字
//   … 2 / … ②                       末尾の算用数字・丸数字
//   … 2巻 / … 第3巻 / … その4
//   … XII（ローマ数字）/ …（十三）（漢数字）
export function detectSeries(title: string): SeriesInfo | null {
  const t = title.trim();

  // 丸数字 ①②③…⑳
  const circled = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
  let m = t.match(new RegExp(`^(.+?)\\s*([${circled}])$`, "u"));
  if (m) {
    const vol = circled.indexOf(m[2]) + 1;
    return makeSeries(m[1], vol);
  }

  // 第N巻 / Nの巻 / N巻 / その N（漢数字・算用数字）
  m = t.match(/^(.+?)\s*(?:第)?\s*([0-9０-９一二三四五六七八九十]+)\s*巻$/u);
  if (m) {
    const vol = parseVolume(m[2]);
    if (vol) return makeSeries(m[1], vol);
  }
  m = t.match(/^(.+?)\s*その\s*([0-9０-９一二三四五六七八九十]+)$/u);
  if (m) {
    const vol = parseVolume(m[2]);
    if (vol) return makeSeries(m[1], vol);
  }

  // 括弧つき数字（半角/全角括弧、半角/全角/漢数字/ローマ数字）
  m = t.match(/^(.+?)\s*[（(]\s*([0-9０-９一二三四五六七八九十IVXivx]+)\s*[）)]$/u);
  if (m) {
    const vol = parseVolume(m[2]);
    if (vol) return makeSeries(m[1], vol);
  }

  // 末尾のローマ数字（スペース区切り）。例: "狼と香辛料 XII"
  m = t.match(/^(.+?[^\sIVXivx])\s+([IVXivx]{1,5})$/u);
  if (m) {
    const vol = romanToNumber(m[2]);
    if (vol) return makeSeries(m[1], vol);
  }

  // 末尾の裸の算用数字（全角含む）。ただし1文字以上のベースが残る場合のみ。
  m = t.match(/^(.+?[^0-9０-９\s])\s+([0-9０-９]{1,3})$/u);
  if (m) {
    const vol = parseVolume(m[2]);
    if (vol) return makeSeries(m[1], vol);
  }

  return null;
}

function parseVolume(s: string): number | null {
  const half = s.replace(/[０-９]/g, (d) => String("０１２３４５６７８９".indexOf(d)));
  if (/^[0-9]+$/.test(half)) {
    const n = parseInt(half, 10);
    return n > 0 ? n : null;
  }
  return kanjiToNumber(s) ?? romanToNumber(s);
}

function makeSeries(base: string, volume: number): SeriesInfo | null {
  // 末尾の開き括弧・記号・空白を削った素のシリーズ名
  const clean = base.replace(/[\s　・,，:：\-—–]+$/u, "").trim();
  if (clean.length < 2) return null; // ベースが短すぎるものはノイズとして除外
  return { base: clean, volume };
}

// シリーズ名から URL 用 slug を生成する（著者と同様、空白除去＋URIエンコード）。
export function seriesSlug(base: string): string {
  return encodeURIComponent(base.replace(/\s/g, ""));
}

// 書籍配列をシリーズごとにグループ化する。2冊以上集まったものだけを返す。
// 返り値は base(シリーズ名) をキーに、巻数昇順で並べた書籍配列。
export function groupBySeries(books: Book[]): Map<string, Book[]> {
  const buckets = new Map<string, { base: string; items: { book: Book; volume: number }[] }>();

  for (const book of books) {
    const info = detectSeries(book.title);
    if (!info) continue;
    const key = info.base.replace(/\s/g, "");
    const bucket = buckets.get(key) ?? { base: info.base, items: [] };
    bucket.items.push({ book, volume: info.volume });
    buckets.set(key, bucket);
  }

  const result = new Map<string, Book[]>();
  for (const { base, items } of buckets.values()) {
    if (items.length < 2) continue;
    items.sort((a, b) => a.volume - b.volume);
    result.set(base, items.map((i) => i.book));
  }
  return result;
}
