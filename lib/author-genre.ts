import type { Genre } from "@/types/book";

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

// 指定ジャンルに「オーバーライドで割り当てた作家名」の一覧（元の表記のまま）。
// ジャンルページで「そのジャンルに移したい作家の本」も拾うために使う。
export function overrideAuthorsForGenre(genreId: string): string[] {
  return Object.entries(AUTHOR_GENRE_OVERRIDES)
    .filter(([, g]) => g === genreId)
    .map(([author]) => author);
}
