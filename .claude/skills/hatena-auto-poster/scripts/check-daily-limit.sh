#!/usr/bin/env bash
# 1日の投稿本数を data/posts.log の行数で数え、上限に達していたら exit 1。
# スパム判定を避けるためのガード。データベース不要 (ローカルのログファイルだけ)。
#
# 使い方:
#   bash scripts/check-daily-limit.sh [上限]     上限の既定値は 1 本/日
# 終了コード:
#   0 = まだ投稿してよい / 1 = 上限到達 (今日はもう投稿しない)

set -euo pipefail
LIMIT="${1:-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$SCRIPT_DIR/../data/posts.log"

[[ "$LIMIT" =~ ^[0-9]+$ ]] || { echo "check-daily-limit: 上限は整数で指定してください" >&2; exit 2; }
TODAY=$(date +%Y-%m-%d)
COUNT=0
[[ -f "$LOG" ]] && COUNT=$(grep -c "^${TODAY}	" "$LOG" || true)

if (( COUNT >= LIMIT )); then
  echo "check-daily-limit: 本日はすでに ${COUNT} 本投稿済み (上限 ${LIMIT})。今日は投稿しない。" >&2
  exit 1
fi
echo "ok today=${COUNT} limit=${LIMIT} remaining=$(( LIMIT - COUNT ))"
