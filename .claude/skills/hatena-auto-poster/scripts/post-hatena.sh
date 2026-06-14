#!/usr/bin/env bash
# はてなブログに Markdown 記事を AtomPub API で投稿する。
# レスポンスから公開記事の URL を取り出して標準出力に表示する。
#
# 使い方:
#   bash scripts/post-hatena.sh \
#     --title "記事タイトル" \
#     --body-file /tmp/body.md \
#     [--category "カテゴリ1" --category "カテゴリ2"] \
#     [--draft no]      # no=公開 / yes=下書き (省略時 no)
#
# 必要な環境変数 (.env):
#   HATENA_ID         はてな ID (例: yourname)
#   HATENA_BLOG_HOST  ブログのドメイン (例: yourname.hatenablog.com)
#   HATENA_API_KEY    AtomPub 用 API キー (はてなブログ 詳細設定 → API キー)

set -euo pipefail

HATENA_ID="${HATENA_ID:?HATENA_ID が未設定です (.env を確認)}"
BLOG_HOST="${HATENA_BLOG_HOST:?HATENA_BLOG_HOST が未設定です (.env を確認)}"
API_KEY="${HATENA_API_KEY:?HATENA_API_KEY が未設定です (.env を確認)}"
ENDPOINT="https://blog.hatena.ne.jp/${HATENA_ID}/${BLOG_HOST}/atom/entry"

TITLE=""
BODY_FILE=""
DRAFT="no"
CATEGORIES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title) TITLE="$2"; shift 2 ;;
    --body-file) BODY_FILE="$2"; shift 2 ;;
    --category) CATEGORIES+=("$2"); shift 2 ;;
    --draft) DRAFT="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ -z "$TITLE" ]] && { echo "missing --title" >&2; exit 2; }
[[ -z "$BODY_FILE" || ! -f "$BODY_FILE" ]] && { echo "missing/invalid --body-file" >&2; exit 2; }

esc_xml() {
  python3 -c 'import sys,html; sys.stdout.write(html.escape(sys.stdin.read(), quote=True))'
}

TITLE_XML=$(printf '%s' "$TITLE" | esc_xml)
BODY_XML=$(esc_xml < "$BODY_FILE")
CAT_XML=""
for c in "${CATEGORIES[@]:-}"; do
  [[ -z "$c" ]] && continue
  CAT_XML+="  <category term=\"$(printf '%s' "$c" | esc_xml)\" />"$'\n'
done

REQ_FILE=$(mktemp)
cat > "$REQ_FILE" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom" xmlns:app="http://www.w3.org/2007/app">
  <title>${TITLE_XML}</title>
  <content type="text/x-markdown">${BODY_XML}</content>
${CAT_XML}  <app:control>
    <app:draft>${DRAFT}</app:draft>
  </app:control>
</entry>
EOF

RESP_FILE=$(mktemp)
HTTP_CODE=""
ATTEMPT=0
MAX_ATTEMPTS=3
while (( ATTEMPT < MAX_ATTEMPTS )); do
  ATTEMPT=$((ATTEMPT+1))
  HTTP_CODE=$(curl -sS -o "$RESP_FILE" -w "%{http_code}" \
    -X POST "$ENDPOINT" \
    -u "${HATENA_ID}:${API_KEY}" \
    -H "Content-Type: application/xml" \
    --data-binary "@${REQ_FILE}" || true)
  if [[ "$HTTP_CODE" == "201" || "$HTTP_CODE" == "200" ]]; then
    break
  fi
  echo "post-hatena: attempt ${ATTEMPT} failed http=${HTTP_CODE}" >&2
  sleep $((2 ** ATTEMPT))
done

rm -f "$REQ_FILE"

if [[ "$HTTP_CODE" != "201" && "$HTTP_CODE" != "200" ]]; then
  echo "post-hatena: gave up after ${MAX_ATTEMPTS} attempts, last http=${HTTP_CODE}" >&2
  cat "$RESP_FILE" >&2
  rm -f "$RESP_FILE"
  exit 1
fi

PUBLIC_URL=$(python3 - "$RESP_FILE" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding='utf-8').read()
# rel="alternate" type="text/html" が公開記事の URL
m = re.search(r'<link[^>]+rel="alternate"[^>]+type="text/html"[^>]+href="([^"]+)"', xml)
if not m:
    m = re.search(r'<link[^>]+type="text/html"[^>]+rel="alternate"[^>]+href="([^"]+)"', xml)
if not m:
    sys.stderr.write(xml[:1000])
    sys.exit(3)
print(m.group(1))
PY
)

rm -f "$RESP_FILE"
printf '%s\n' "$PUBLIC_URL"
