#!/usr/bin/env bash
# はてなブログ自動投稿の全工程オーケストレーション（1日1本）。
#   起動チェック → テーマ選定(重複排除) → DeepSeekで執筆(ナカノ) → リンク実在確認
#   → アイキャッチ生成(Gemini→フォトライフ・任意) → AI臭チェック → 投稿(公開) → 記録 → Discord通知
#
# 必要な環境変数:
#   HATENA_ID / HATENA_BLOG_HOST / HATENA_API_KEY  … AtomPub投稿
#   GEMINI_API_KEY                                  … アイキャッチ生成（無くても本文だけ投稿）
#   DEEPSEEK_API_KEY                                … 執筆
#   DISCORD_WEBHOOK_URL                             … 通知（任意）
#   HATENA_DRAFT=yes                                … 指定すると公開せず下書き（テスト用）。既定は公開(no)。
#
# 終了コード: 0=正常（投稿した or 本日分は投稿済み/新テーマ無しで正常スキップ） / 1=エラー

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL="$ROOT/.claude/skills/hatena-auto-poster/scripts"
THEMES="$ROOT/data/hatena-themes.json"
DRAFT="${HATENA_DRAFT:-no}"

log() { printf '[hatena-auto] %s\n' "$*"; }

# ── Step 0: 1日1本ガード ───────────────────────────────
if ! bash "$SKILL/check-daily-limit.sh" 1; then
  log "本日は投稿済み。正常終了。"; exit 0
fi

# ── Step 1: テーマ選定（posts.log と被らない最初の1件） ──
pick_theme() {
  local count kw
  count=$(node -e 'const t=require(process.argv[1]);console.log(t.themes.length)' "$THEMES")
  for ((i=0; i<count; i++)); do
    kw=$(node -e 'const t=require(process.argv[1]);console.log(t.themes[+process.argv[2]].keyword)' "$THEMES" "$i")
    if bash "$SKILL/check-dup.sh" "$kw" >/dev/null 2>&1; then echo "$i"; return; fi
  done
}
PICK="$(pick_theme)"
if [[ -z "$PICK" ]]; then
  log "未投稿の新テーマが尽きました。GSC実データから自動生成を試みます。"
  if node "$ROOT/scripts/generate-hatena-themes.js" 8; then
    PICK="$(pick_theme)"
  else
    log "テーマ自動生成に失敗（続けて手動追記が必要）。"
  fi
fi
if [[ -z "$PICK" ]]; then
  log "新テーマを用意できませんでした。テーマプールに手動で追記してください。正常終了。"; exit 0
fi
THEME_FILE="$(mktemp).json"
node -e 'const t=require(process.argv[1]);process.stdout.write(JSON.stringify(t.themes[+process.argv[2]]))' "$THEMES" "$PICK" > "$THEME_FILE"
KEYWORD=$(node -e 'console.log(require(process.argv[1]).keyword)' "$THEME_FILE")
log "テーマ採用: $KEYWORD"

# ── Step 2-3: DeepSeekで執筆 ───────────────────────────
ART="$(mktemp).json"
node "$ROOT/scripts/write-hatena-deepseek.js" "$THEME_FILE" "$ART" >/dev/null
TITLE=$(node -e 'console.log(require(process.argv[1]).title)' "$ART")
BODY="$(mktemp).md"
node -e 'process.stdout.write(require(process.argv[1]).body_markdown)' "$ART" > "$BODY"
log "執筆完了: $TITLE （本文 $(wc -m < "$BODY" | tr -d ' ') 字）"

# ── Step 2.5: 本文中の新刊日和リンクが実在(200)するか確認 ──
LINKS=()
while IFS= read -r u; do [[ -n "$u" ]] && LINKS+=("$u"); done < <(grep -oE 'https://shinkanbiyori\.com[A-Za-z0-9%/_.-]*' "$BODY" | sort -u)
for u in "${LINKS[@]}"; do
  # ISRの再生成中に一時的な5xxを返すことがあり、1回きりの判定だと投稿ごと中止になる
  # （2026-07-27に著者ページの503で1日分を落とした）。間をあけて3回まで見る。
  for attempt in 1 2 3; do
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "$u" || echo ERR)
    [[ "$code" == "200" ]] && break
    [[ $attempt -lt 3 ]] && sleep 10
  done
  if [[ "$code" != "200" ]]; then log "リンク不正($code): $u → 中止"; exit 1; fi
done
log "内部リンク ${#LINKS[@]}本すべて200を確認"

# ── Step 3.5: アイキャッチ（Gemini→フォトライフ・失敗しても続行） ──
if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  if IMG=$(bash "$SKILL/gen-image-gemini.sh" "横長16:9のブログアイキャッチ。テーマ『${KEYWORD}』。本と読書の落ち着いたフラットイラスト。文字は入れない。広告っぽくしない。" /tmp/hatena-eye.png 2>/dev/null) \
     && SYNTAX=$(bash "$SKILL/upload-fotolife.sh" "$IMG" "$TITLE" 2>/dev/null | cut -f1); then
    if [[ -n "$SYNTAX" ]]; then printf '%s\n\n%s' "$SYNTAX" "$(cat "$BODY")" > "$BODY"; log "アイキャッチ添付: $SYNTAX"; fi
  else
    log "アイキャッチ生成に失敗（本文のみで続行）"
  fi
else
  log "GEMINI_API_KEY 未設定。アイキャッチ無しで続行。"
fi

# ── Step 4: AI臭チェック（通らなければ投稿しない） ──────
if ! bash "$SKILL/lint-anti-ai.sh" "$BODY"; then
  log "lint不通過（AI臭）。投稿を中止。"; exit 1
fi

# ── Step 5: 投稿 ──────────────────────────────────────
URL=$(bash "$SKILL/post-hatena.sh" --title "$TITLE" --body-file "$BODY" --category "読書" --draft "$DRAFT")
log "投稿完了 (draft=$DRAFT): $URL"

# ── Step 6: 記録 + Discord通知 ─────────────────────────
bash "$SKILL/record-post.sh" "$TITLE" "$KEYWORD" "$URL" >/dev/null
log "posts.log に記録"

if [[ -n "${DISCORD_WEBHOOK_URL:-}" ]]; then
  MODE_LABEL=$([[ "$DRAFT" == "yes" ]] && echo "下書き" || echo "公開")
  MSG="📝 **はてな自動投稿（${MODE_LABEL}）**\nタイトル: ${TITLE}\nキーワード: ${KEYWORD}\nURL: ${URL}"
  curl -sS -X POST "$DISCORD_WEBHOOK_URL" -H "Content-Type: application/json" \
    -d "$(node -e 'console.log(JSON.stringify({content:process.argv[1],allowed_mentions:{parse:[]}}))' "$MSG")" >/dev/null || log "Discord通知失敗（無視）"
  log "Discord通知済み"
fi

# CIが posts.log を commit できるよう、変更パスを出力
echo "POSTS_LOG=.claude/skills/hatena-auto-poster/data/posts.log"
echo "PUBLISHED_URL=$URL"
