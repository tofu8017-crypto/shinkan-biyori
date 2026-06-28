import type { Genre } from "@/types/book";
import { RANOBE_GENRE_ID } from "@/types/book";
import { isLikelyLightNovel } from "@/lib/is-light-novel";

// ───────── 作家→ジャンルの手動オーバーライド ─────────
//
// 楽天は人気作家を「日本の小説(001004008)」にまとめがちで、ミステリー等の
// 細かいジャンルに入れてくれない（例: 伊坂幸太郎・東野圭吾もミステリー扱いされない）。
// ここで「この作家はこのジャンル」と手動で上書きする。
//
// ★編集方法: 下の表に「"作家名": "ジャンルID",」の行を足すだけ。
//   ジャンルID  001004001=ミステリー / 001004002=SF・ホラー / 001004003=エッセイ
//              001004008=小説(日本) / 001004009=小説(海外) / 001019=文庫
//   作家名は空白あり/なしどちらでもOK（内部で空白を無視して照合する）。
export const AUTHOR_GENRE_OVERRIDES: Record<string, Genre> = {
  // ミステリー・サスペンス
  伊坂幸太郎: "001004001",
  東野圭吾: "001004001",
  宮部みゆき: "001004001",
  湊かなえ: "001004001",
  横山秀夫: "001004001",
  米澤穂信: "001004001",
  道尾秀介: "001004001",
  中山七里: "001004001",
  今村昌弘: "001004001",
  知念実希人: "001004001",
  綾辻行人: "001004001",
  有栖川有栖: "001004001",
  京極夏彦: "001004001",
  貫井徳郎: "001004001",
  大沢在昌: "001004001",
  桐野夏生: "001004001",
  誉田哲也: "001004001",
  薬丸岳: "001004001",
  真梨幸子: "001004001",
  葉真中顕: "001004001",
  呉勝浩: "001004001",
  相沢沙呼: "001004001",
  阿津川辰海: "001004001",
  結城真一郎: "001004001",
};

// 照合用に空白を除去（"伊坂 幸太郎" や "伊坂幸太郎／著" でも拾えるように）
function norm(s: string): string {
  return s.replace(/[\s　]/g, "");
}

const NORM_OVERRIDES: { key: string; genre: Genre }[] = Object.entries(
  AUTHOR_GENRE_OVERRIDES
).map(([author, genre]) => ({ key: norm(author), genre }));

// 本の「実効ジャンルID」。著者がオーバーライド表にあればそれを優先し、
// 無ければ楽天/DBの元ジャンルをそのまま返す。
export function effectiveGenreId(author: string | null | undefined, fallback: Genre): Genre {
  const a = norm(author ?? "");
  if (!a) return fallback;
  for (const { key, genre } of NORM_OVERRIDES) {
    if (a.includes(key)) return genre;
  }
  return fallback;
}

// ラノベ判定を適用してよい「小説系」ジャンル（コミック・ビジネス等は対象外＝誤判定防止）
const NOVELISH_FOR_RANOBE = new Set<string>([
  "001004008", "001004009", "001004001", "001004002", "001019",
]);

// 本の「実効ジャンルID」（著者オーバーライド＋ラノベ判定こみ）。
// 楽天は無双系・なろう系ラノベを「日本の小説」等にまとめてしまうため、
// タイトル/レーベルで isLikelyLightNovel なら「ライトノベル(001017)」に振り分ける。
// 著者オーバーライド（例:東野圭吾→ミステリー）が最優先。
export function effectiveGenreOfBook(
  book: { author?: string | null; title?: string | null; publisher?: string | null; genre_id: Genre }
): Genre {
  const ov = effectiveGenreId(book.author, book.genre_id);
  if (ov !== book.genre_id) return ov; // 著者オーバーライドを最優先
  if (
    NOVELISH_FOR_RANOBE.has(ov) &&
    isLikelyLightNovel({ title: book.title ?? "", publisher: book.publisher ?? "" })
  ) {
    return RANOBE_GENRE_ID as Genre;
  }
  return ov;
}

// 指定ジャンルに「オーバーライドで割り当てた作家名」の一覧（元の表記のまま）。
// ジャンルページで「そのジャンルに移したい作家の本」も拾うために使う。
export function overrideAuthorsForGenre(genreId: string): string[] {
  return Object.entries(AUTHOR_GENRE_OVERRIDES)
    .filter(([, g]) => g === genreId)
    .map(([author]) => author);
}
