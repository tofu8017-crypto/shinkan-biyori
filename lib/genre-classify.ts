import type { Book } from "@/types/book";
import { isLikelyLightNovel } from "./is-light-novel";

// ───────── 派生ジャンルのキーワード分類 ─────────
//
// 楽天のジャンルは「小説（日本）」「小説（海外）」など粗いため、Cコードでは
// 区別できない「歴史・時代小説」「成人向け小説」「ファンタジー」を、タイトル・
// レーベル(出版社)・作家名のキーワードで推定する。is-light-novel.ts と同じ
// ベストエフォート方式。
//
// ★編集方法: 下のキーワード配列に語を足すだけで分類が変わる。

// ===== 歴史・時代小説 =====
const JIDAI_TITLE = [
  "時代小説", "侍", "武士", "藩", "将軍", "戦国", "江戸", "幕末", "維新",
  "剣豪", "奉行", "浪人", "参勤交代", "合戦", "城主", "旗本", "足軽", "忍び",
  "陰陽師", "公家", "大名", "家老", "同心", "御家人", "宿場", "廻り",
];
const JIDAI_AUTHORS = [
  "司馬遼太郎", "池波正太郎", "藤沢周平", "佐伯泰英", "葉室麟", "今村翔吾",
  "和田竜", "山本周五郎", "宮城谷昌光", "浅田次郎", "高田郁", "畠中恵",
  "諸田玲子", "あさのあつこ", "木下昌輝", "西條奈加", "永井紗耶子", "澤田瞳子",
];

// ===== 成人向け小説 =====
// レーベル(出版社名)で判定するのが最も確実。
const ADULT_PUBLISHERS = [
  "フランス書院", "マドンナメイト", "蜜夢文庫", "ハニー文庫", "蜜と毒",
  "プランタン出版", "ティアラ文庫", "オパール文庫", "ムーンドロップス",
  "ガブリエラ文庫", "ラズベリーブックス", "ロイヤルキス",
];
const ADULT_TITLE = [
  "官能", "淫", "肉欲", "蜜夜", "媚薬", "牝", "陵辱", "痴漢", "人妻",
];

// ===== ファンタジー（SF・ホラー・ファンタジー枠に寄せる） =====
const FANTASY_TITLE = [
  "ファンタジー", "魔法", "魔導", "魔術", "竜", "ドラゴン", "エルフ",
  "精霊", "召喚", "異界", "妖精", "魔女", "騎士団", "聖剣", "幻想",
];

function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}
function norm(s: string): string {
  return s.replace(/[\s　]/g, "");
}

// 歴史・時代小説か（タイトル or 代表作家で判定）
export function isJidaiNovel(book: Pick<Book, "title" | "author">): boolean {
  if (hasAny(book.title ?? "", JIDAI_TITLE)) return true;
  const a = norm(book.author ?? "");
  return JIDAI_AUTHORS.some((author) => a.includes(norm(author)));
}

// 成人向け小説か（レーベル or タイトルで判定）
export function isAdultNovel(book: Pick<Book, "title" | "publisher">): boolean {
  if (hasAny(book.publisher ?? "", ADULT_PUBLISHERS)) return true;
  return hasAny(book.title ?? "", ADULT_TITLE);
}

// ファンタジーか（タイトルで判定）。ラノベは別タブへ寄せるため除く。
export function isFantasy(book: Pick<Book, "title" | "publisher">): boolean {
  if (isLikelyLightNovel(book)) return false;
  return hasAny(book.title ?? "", FANTASY_TITLE);
}

// 「小説（日本）/（海外）」の基本タブから抜くべき本か。
// 成人向け・時代小説・ファンタジーに該当する本は専用タブへ寄せ、基本タブから外す。
export function isReassignedFromBaseNovel(
  book: Pick<Book, "title" | "author" | "publisher">
): boolean {
  return isAdultNovel(book) || isJidaiNovel(book) || isFantasy(book);
}
