import type { Book } from "@/types/book";

// ライトノベルらしさの推定。完璧な判定はできないため、
// 「今日の一冊」のフィーチャー選定で“なるべくラノベを避ける”用途のベストエフォート。
// タイトルの典型ワード + ラノベ系レーベル/出版社で判定する。

// ラノベに頻出するタイトルワード（なろう系・異世界転生・悪役令嬢など）
const TITLE_KEYWORDS = [
  "転生", "転移", "異世界", "悪役令嬢", "婚約破棄", "ざまぁ", "追放",
  "スキル", "チート", "魔王", "勇者", "聖女", "ダンジョン", "ハーレム",
  "最強", "レベル", "ギルド", "スローライフ", "王子様", "令嬢", "賢者",
  "冒険者", "魔法使い", "錬金術", "無双", "成り上がり", "やり直し", "ループ",
];

// ラノベ系レーベル・出版社名（楽天のpublisherNameに現れる代表例）
const PUBLISHER_KEYWORDS = [
  "SBクリエイティブ", "GAノベル", "GA文庫", "電撃文庫", "MF文庫", "ファンタジア文庫",
  "オーバーラップ", "ヒーロー文庫", "アース・スター", "TOブックス", "マイクロマガジン",
  "一二三書房", "ホビージャパン", "KADOKAWA", "ドラゴンノベルス", "スニーカー文庫",
  "ダッシュエックス", "角川スニーカー", "Mノベルス", "ツギクルブックス", "PASH!",
];

export function isLikelyLightNovel(book: Pick<Book, "title" | "publisher">): boolean {
  const title = book.title ?? "";
  if (TITLE_KEYWORDS.some((k) => title.includes(k))) return true;

  const pub = book.publisher ?? "";
  if (PUBLISHER_KEYWORDS.some((k) => pub.includes(k))) return true;

  // 「〜した4」のように長めのタイトル末尾に巻数が付くのもラノベの典型。
  // ただし短い文芸シリーズもあるため、20文字以上 かつ 末尾巻数 のときだけ該当とする。
  if (title.length >= 20 && /[0-9０-９]\s*$/.test(title)) return true;

  return false;
}
