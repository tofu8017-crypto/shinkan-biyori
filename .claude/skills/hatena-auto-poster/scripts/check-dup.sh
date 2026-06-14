#!/usr/bin/env bash
# これから書くテーマが、過去に投稿した記事 (data/posts.log) と被っていないか調べる。
# 同じネタを繰り返すと検索エンジンに「重複コンテンツ」と見なされ逆効果なので、
# 被っていたら exit 1 を返して別テーマを促す。データベース不要。
#
# 使い方:
#   bash scripts/check-dup.sh "キーワード1 キーワード2 ..."
#   識別語 (地名・固有名詞・制度名) を中心に 2〜4 語渡すのがコツ。
#   「ブログ」「情報」のような汎用語だけだと誤検知しやすい。
# 終了コード:
#   0 = 重複なし / 1 = 重複の疑い (別テーマにする)

set -euo pipefail
THRESHOLD="${DUP_THRESHOLD:-2}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$SCRIPT_DIR/../data/posts.log"

[[ $# -ge 1 && -n "${1// /}" ]] || { echo "check-dup: usage: check-dup.sh \"KW1 KW2 ...\"" >&2; exit 2; }
read -r -a KW <<< "$1"
[[ -f "$LOG" ]] || { echo "ok no-overlap (まだ投稿履歴なし)"; exit 0; }

WORST_HITS=0; WORST_LINE=""; WORST_TERMS=""
while IFS= read -r line; do
  [[ -n "$line" ]] || continue
  hits=0; terms=""
  for k in "${KW[@]}"; do
    [[ -n "${k// /}" ]] || continue
    if printf '%s' "$line" | grep -qF -- "$k"; then hits=$((hits+1)); terms+="$k "; fi
  done
  if (( hits > WORST_HITS )); then WORST_HITS=$hits; WORST_LINE="$line"; WORST_TERMS="$terms"; fi
done < "$LOG"

if (( WORST_HITS >= THRESHOLD )); then
  echo "check-dup: 重複の疑い (一致 ${WORST_HITS} 語 >= しきい値 ${THRESHOLD})" >&2
  echo "  既存記事: $(printf '%s' "$WORST_LINE" | cut -f2)" >&2
  echo "  一致語:   ${WORST_TERMS}" >&2
  echo "  → 別の切り口・地域・テーマに変えること" >&2
  exit 1
fi
echo "ok no-overlap (最大一致 ${WORST_HITS} 語 / しきい値 ${THRESHOLD})"
