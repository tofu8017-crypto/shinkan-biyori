#!/usr/bin/env bash
# 画像をはてなフォトライフ (はてな公式の画像置き場) に WSSE 認証でアップロードする。
# 外部ストレージを使わず、はてな内 (cdn-ak.f.st-hatena.com) に画像を置ける。
# AtomPub: POST https://f.hatena.ne.jp/atom/post
#
# 使い方:
#   bash scripts/upload-fotolife.sh <画像ファイル> [タイトル] [フォルダ名]
#   --dry-run : 実際に送らず、認証ヘッダと XML の組み立てだけ検証する
#
# 必要な環境変数 (.env):
#   HATENA_ID       はてな ID
#   HATENA_API_KEY  API キー (はてなブログ 詳細設定 → API キー。ブログ投稿と同じキー)
#
# 出力 (成功時、標準出力):  記法<TAB>画像URL
#   記法    = [f:id:あなたのID:XXXXXXp:image]   (本文にそのまま貼れるはてな記法)
#   画像URL = https://cdn-ak.f.st-hatena.com/... (markdown ![]() で貼る場合用)

set -euo pipefail

DRY_RUN=0
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
set -- "${ARGS[@]:-}"

IMAGE="${1:-}"
TITLE="${2:-}"
HATENA_ID="${HATENA_ID:?HATENA_ID が未設定です (.env を確認)}"
API_KEY="${HATENA_API_KEY:?HATENA_API_KEY が未設定です (.env を確認)}"
FOLDER="${3:-$HATENA_ID}"
ENDPOINT="https://f.hatena.ne.jp/atom/post"

[[ -n "$IMAGE" && -f "$IMAGE" ]] || { echo "upload-fotolife: 画像ファイルがありません" >&2; exit 2; }
[[ -n "$TITLE" ]] || TITLE="$(basename "$IMAGE")"

case "${IMAGE,,}" in
  *.png) MIME="image/png" ;;
  *.jpg|*.jpeg) MIME="image/jpeg" ;;
  *.gif) MIME="image/gif" ;;
  *.webp) MIME="image/webp" ;;
  *) MIME="image/png" ;;
esac

# WSSE ヘッダ生成: PasswordDigest = base64(sha1(nonce + created + apikey))
make_wsse() {
  HZ_USER="$HATENA_ID" HZ_KEY="$API_KEY" python3 - <<'PY'
import os, secrets, hashlib, base64, datetime
user=os.environ["HZ_USER"]; key=os.environ["HZ_KEY"]
nonce=secrets.token_bytes(20)
created=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
digest=base64.b64encode(hashlib.sha1(nonce+created.encode()+key.encode()).digest()).decode()
print(f'UsernameToken Username="{user}", PasswordDigest="{digest}", Nonce="{base64.b64encode(nonce).decode()}", Created="{created}"')
PY
}
WSSE=$(make_wsse)

REQ=$(mktemp)
trap 'rm -f "$REQ"' EXIT
{
  printf '<?xml version="1.0" encoding="utf-8"?>\n'
  printf '<entry xmlns="http://purl.org/atom/ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
  printf '  <title>%s</title>\n' "$(printf '%s' "$TITLE" | python3 -c 'import sys,html;sys.stdout.write(html.escape(sys.stdin.read(),quote=True))')"
  printf '  <content mode="base64" type="%s">' "$MIME"
  base64 < "$IMAGE" | tr -d '\n'
  printf '</content>\n'
  printf '  <dc:subject>%s</dc:subject>\n' "$FOLDER"
  printf '</entry>\n'
} > "$REQ"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "upload-fotolife: [dry-run] endpoint=$ENDPOINT mime=$MIME folder=$FOLDER bytes=$(wc -c < "$IMAGE" | tr -d ' ')" >&2
  echo "upload-fotolife: [dry-run] X-WSSE built OK / request XML $(wc -c < "$REQ" | tr -d ' ') bytes" >&2
  exit 0
fi

RESP=$(mktemp)
trap 'rm -f "$REQ" "$RESP"' EXIT
HTTP_CODE=""
for ATTEMPT in 1 2 3; do
  HTTP_CODE=$(curl -sS -o "$RESP" -w "%{http_code}" \
    -X POST "$ENDPOINT" \
    -H "X-WSSE: $WSSE" \
    -H "Content-Type: application/xml" \
    --data-binary "@${REQ}" || true)
  [[ "$HTTP_CODE" == "201" || "$HTTP_CODE" == "200" ]] && break
  echo "upload-fotolife: attempt ${ATTEMPT} failed http=${HTTP_CODE}" >&2
  sleep $((2 ** ATTEMPT))
  WSSE=$(make_wsse)   # nonce/created は都度更新が必要
done

if [[ "$HTTP_CODE" != "201" && "$HTTP_CODE" != "200" ]]; then
  echo "upload-fotolife: gave up http=${HTTP_CODE}" >&2
  head -c 800 "$RESP" >&2; echo >&2
  exit 1
fi

python3 - "$RESP" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding='utf-8').read()
def pick(tag):
    m = re.search(rf'<hatena:{tag}>(.*?)</hatena:{tag}>', xml, re.S)
    return m.group(1).strip() if m else ''
syntax = pick('syntax')
imageurl = pick('imageurl')
if not syntax and not imageurl:
    sys.stderr.write("upload-fotolife: response parsed but no syntax/imageurl:\n" + xml[:1000] + "\n")
    sys.exit(1)
print(f'{("["+syntax+"]") if syntax else ""}\t{imageurl}')
PY
