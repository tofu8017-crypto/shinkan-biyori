#!/usr/bin/env bash
# 投稿が終わったら、その記録を data/posts.log に 1 行追記する。
# この記録を check-daily-limit.sh (本数制限) と check-dup.sh (重複チェック) が参照する。
#
# 使い方:
#   bash scripts/record-post.sh "記事タイトル" "キーワード1 キーワード2" "公開URL"
#
# 1 行のフォーマット (タブ区切り):  日付  タイトル  キーワード  URL

set -euo pipefail
TITLE="${1:?タイトルを指定してください}"
KEYWORDS="${2:-}"
URL="${3:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$SCRIPT_DIR/../data/posts.log"
mkdir -p "$(dirname "$LOG")"

printf '%s\t%s\t%s\t%s\n' "$(date +%Y-%m-%d)" "$TITLE" "$KEYWORDS" "$URL" >> "$LOG"
echo "recorded: $TITLE"
