#!/usr/bin/env bash
# ツボツボ (shuckle-hatena-publisher) 用: 公開前の本文を grep して「AI 臭フレーズ」を検出。
# 1 件でもヒットしたら該当行を出力して exit 1 → リライトさせる品質ゲート。
#
# Usage:
#   bash lint-anti-ai.sh /path/to/body.md
#
# Exit code:
#   0 = クリーン (禁止表現なし)。stdout: "ok clean"
#   1 = 禁止表現を検出。stderr に「行番号: フレーズ → 該当行」
#   2 = 引数エラー (ファイル不在)

set -euo pipefail

BODY_FILE="${1:-}"
[[ -n "$BODY_FILE" && -f "$BODY_FILE" ]] || { echo "lint-anti-ai: usage: lint-anti-ai.sh <body-file>" >&2; exit 2; }

# 禁止 AI 表現リスト (note-publishing-toolkit / キャタピーの規約と整合)。
# 文脈で自然に使える語もあるが、被リンク記事は「人間が書いた感」を最優先するため厳しめに弾く。
BANNED=(
  "について解説します"
  "することができます"
  "が可能です"
  "幅広く"
  "網羅的に"
  "いかがでしたか"
  "いかがでしょうか"
  "ぜひ参考にしてください"
  "一助となれば"
  "重要なポイントです"
  "注目を集めて"
  "と言えるでしょう"
  "ではないでしょうか"
  "を解説していきます"
  "まとめると"
  "他のサイトでは"
  "どこよりも"
)

FOUND=0
for phrase in "${BANNED[@]}"; do
  # 行番号付きで該当行を抽出 (固定文字列マッチ)
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    if (( FOUND == 0 )); then
      echo "lint-anti-ai: BANNED phrases detected (公開不可、リライトすること):" >&2
    fi
    FOUND=$((FOUND+1))
    echo "  [${phrase}] ${line}" >&2
  done < <(grep -nF -- "$phrase" "$BODY_FILE" 2>/dev/null || true)
done

if (( FOUND > 0 )); then
  echo "lint-anti-ai: ${FOUND} 件ヒット → Step 3 (執筆) に戻ってリライト" >&2
  exit 1
fi

echo "ok clean"
