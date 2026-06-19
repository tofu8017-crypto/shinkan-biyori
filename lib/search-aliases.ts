// 検索の別名（エイリアス）表。
//
// 楽天検索は「入力文字そのまま一致」のため、正式タイトルが英字なのに利用者は
// カタカナで打つ（例: 「ブルージャイアント」→ 実際の書名は「BLUE GIANT」）と
// 見つからない。ここで「打たれそうな語 → 実際に検索すべき語」を補う。
//
// ★編集方法: 下の表に "利用者が打ちそうな語": ["実際の書名/別表記", ...] を足すだけ。
//   照合は空白除去＋小文字化のゆるい一致（部分一致）で行う。
const ALIASES: Record<string, string[]> = {
  ブルージャイアント: ["BLUE GIANT"],
  ワンピース: ["ONE PIECE"],
  スパイファミリー: ["SPY×FAMILY"],
  ナルト: ["NARUTO"],
  ブリーチ: ["BLEACH"],
  ベルセルク: ["ベルセルク"],
  バガボンド: ["バガボンド"],
  ドラゴンボール: ["DRAGON BALL", "ドラゴンボール"],
  オーバーロード: ["オーバーロード"],
  キングダム: ["キングダム"],
};

function norm(s: string): string {
  return s.replace(/[\s　]/g, "").toLowerCase();
}

// 入力語に対応する追加検索語の配列を返す（無ければ空配列）。
export function searchAliases(query: string): string[] {
  const q = norm(query);
  if (!q) return [];
  const out: string[] = [];
  for (const [key, vals] of Object.entries(ALIASES)) {
    const nk = norm(key);
    if (q === nk || q.includes(nk) || nk.includes(q)) {
      for (const v of vals) if (norm(v) !== q) out.push(v);
    }
  }
  return out;
}
