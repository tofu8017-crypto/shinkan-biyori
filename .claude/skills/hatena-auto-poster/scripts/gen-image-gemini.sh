#!/usr/bin/env bash
# ツボツボ (shuckle-hatena-publisher) 用: Gemini 3.1 Flash Image で画像を 1 枚生成して PNG 保存。
# はてな記事のアイキャッチ / 図解に使う。note-publishing-toolkit と同じモデル・抽出方式。
#
# Usage:
#   bash gen-image-gemini.sh "<プロンプト>" <出力パス.png>
#     例: bash gen-image-gemini.sh "横長16:9のアイキャッチ。東京都の子育て支援…" /tmp/eyecatch.png
#
# 要 env: GEMINI_API_KEY
# Exit:
#   0 = 生成成功 (出力パスに有効な PNG)。stdout に出力パス
#   1 = 生成失敗 (API エラー / 画像が返らない)
#   2 = 引数 / env エラー

set -euo pipefail

PROMPT="${1:-}"
OUTPUT="${2:-}"
MODEL="gemini-3.1-flash-image-preview"   # v2.5 は日本語テキスト描画が崩れるため固定

[[ -n "$PROMPT" ]] || { echo "gen-image-gemini: missing prompt" >&2; exit 2; }
[[ -n "$OUTPUT" ]] || { echo "gen-image-gemini: missing output path" >&2; exit 2; }
[[ -n "${GEMINI_API_KEY:-}" ]] || { echo "gen-image-gemini: GEMINI_API_KEY not set" >&2; exit 2; }
command -v jq >/dev/null || { echo "gen-image-gemini: jq required" >&2; exit 2; }

RESP=$(mktemp)
trap 'rm -f "$RESP"' EXIT

HTTP_CODE=$(curl -sS -o "$RESP" -w "%{http_code}" \
  "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg p "$PROMPT" '{
    contents: [{parts: [{text: $p}]}],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
  }')" || true)

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "gen-image-gemini: API http=${HTTP_CODE}" >&2
  head -c 800 "$RESP" >&2; echo >&2
  exit 1
fi

# inlineData の data(base64) と mimeType を取り出す (Gemini は jpeg/png どちらも返しうる)
B64=$(jq -r 'first(.candidates[0].content.parts[] | select(.inlineData) | .inlineData.data) // empty' "$RESP")
MIME=$(jq -r 'first(.candidates[0].content.parts[] | select(.inlineData) | .inlineData.mimeType) // empty' "$RESP")
if [[ -z "$B64" ]]; then
  echo "gen-image-gemini: no image in response (テキストのみ返った可能性)" >&2
  head -c 800 "$RESP" >&2; echo >&2
  exit 1
fi

# mimeType から正しい拡張子を決め、出力パスの拡張子を差し替える
# (caller が .png 指定でも Gemini が jpeg を返すことがあるため、実体に合わせる)
case "$MIME" in
  image/png) EXT="png" ;;
  image/jpeg) EXT="jpg" ;;
  image/webp) EXT="webp" ;;
  image/gif) EXT="gif" ;;
  *) EXT="png" ;;   # 不明時は png 扱い
esac
FINAL="${OUTPUT%.*}.${EXT}"

printf '%s' "$B64" | base64 -d > "$FINAL"

# file コマンドで実体が画像か検証 (バイナリ grep は macOS の locale で壊れるため使わない)
DETECTED=$(file --mime-type -b "$FINAL" 2>/dev/null || echo "unknown")
if [[ "$DETECTED" != image/* ]]; then
  echo "gen-image-gemini: output is not a valid image (detected: $DETECTED)" >&2
  exit 1
fi

BYTES=$(wc -c < "$FINAL" | tr -d ' ')
echo "gen-image-gemini: ok ${FINAL} mime=${DETECTED} (${BYTES} bytes)" >&2
printf '%s\n' "$FINAL"
