---
name: column-writer
description: (新刊日和のSEOコラムを執筆) Googleサジェストで実際の検索キーワードを取得し、実在の新刊データを使って文芸コラムを執筆、Supabaseに下書き保存→確認後に公開する。「コラム書いて」「コラム執筆」で起動。
user_invocable: true
---

# 新刊日和 コラム執筆スキル（薄いラッパー）

新刊日和（shinkanbiyori.com）のSEOコラムを書く。**執筆はサブエージェント「ナカノ」に委譲する**。このスキルは指揮役（データ収集 → ナカノに委譲 → 保存 → 確認 → 公開）に徹し、文体・禁止表現・2パス推敲などの執筆ルールは持たない（すべてナカノ側＝`.claude/agents/nakano.md` が持つ）。サブスクのClaudeで動くので追加API費用はかからない。ラッコAPIは不要（Googleサジェストで代替）。

作業ディレクトリ: `/Users/Lifehack/shinkan-biyori`

**設計**: ラッパー（本スキル）＝薄い。執筆者ペルソナ＝サブエージェント `nakano`。執筆ルールを直したいときは `nakano.md` を編集する（このスキルは触らない）。

## 手順

1. **テーマ決め**: ユーザー指定があればそれを優先。無ければ対象ジャンルの直近新刊から自然なテーマを選ぶ。
   - 主なジャンルID: 小説（日本）=001004008 / 小説（海外）=001004009 / ミステリー=001004001 / SF・ホラー=001004002 / エッセイ=001004003 / ビジネス・実用書=001006

2. **キーワード取得**: `node scripts/suggest-keywords.js "<シード語>"`（例: "小説 おすすめ"）を実行し、実際に検索されているサジェストを取得。狙うキーワードを1つ決める（target_keyword）。

3. **素材取得**: `node -r dotenv/config scripts/recent-books.js <ジャンルID> 30 dotenv_config_path=.env.local` で直近の実在新刊を取得。文芸らしい注目作を5〜7冊選ぶ（なろう系・ラノベ・POD等はブランドに合わなければ避ける）。各本の amazon_url・isbn13 を控える。

4. **各本をリサーチ（最重要・薄い記事を防ぐ）**: 選んだ本は **書く前に必ず実際の情報を調べる**。これを飛ばすと薄い記事になる。
   - openBD: `curl -s 'https://api.openbd.jp/v1/get?isbn=<isbn13をカンマ区切り>'` → `onix.CollateralDetail.TextContent`（TextType=03）が出版社の内容紹介。
   - openBDに無い新刊は **WebSearchで「著者名 書名 あらすじ」** を調べ、あらすじ・テーマ・著者の実績・評価を把握する。
   - ※検索はサブエージェントに委任せず自分で行う（FJさんルール）。

5. **執筆をナカノに委譲**: Agentツールで `subagent_type: nakano` を起動し、手順2〜4で集めた資料を**そのまま渡して**コラムを書かせる。スキル側は文体・禁止表現・2パス推敲などのルールを指示しない（それはナカノが持っている）。渡すもの＝捏造防止の生命線：
   - 対象書籍のDBレコード（タイトル/著者/版元/レーベル/発売日/価格/openBD内容紹介/amazon_url/rakuten_url/isbn13）を選んだ本ぶん
   - 著者の過去作リスト（分かる範囲）／受賞歴等のファクトシート（手順4で確認したもの。無ければ「未確認」と添える）
   - target_keyword と genre_id
   - ナカノは**最終稿のみ**を、§6の形（slug/title/body_html/excerpt/target_keyword/genre_id/status のJSON）で返す。資料に無いことは書かない契約になっている。

6. **下書き保存**: ナカノが返したJSONをそのまま `/tmp/column-<slug>.json` に書く。形式:
   `{ "slug": "...", "title": "...", "body_html": "...", "excerpt": "...", "target_keyword": "...", "genre_id": "...", "status": "draft" }`
   - slugは半角英数とハイフン（例: `osusume-mystery-2026-07`）。body_htmlは1行（改行を入れない）。
   - 実行: `node -r dotenv/config scripts/save-column.js /tmp/column-<slug>.json dotenv_config_path=.env.local`
   - ナカノの出力に許可外タグ・ダブルクォート属性・禁止表現が混じっていないか軽く目視チェック（基本はナカノのパス2で除去済み）。

7. **レビュー**: 記事の要点（タイトル・取り上げた本・狙うKW・文字量）をFJさんに見せ、**公開してよいか確認**する。

8. **公開**: OKが出たら `node -r dotenv/config scripts/publish-column.js <slug> published dotenv_config_path=.env.local`。直す場合は6に戻って再保存。公開取消は `... publish-column.js <slug> draft ...`。

## 重要な注意
- **AI量産記事はGoogleにスパム判定されうる**。必ずFJさんの確認を経てから公開する。質の低い記事を大量公開しない。
- Googleサジェストは非公式エンドポイントなので**少量利用**に留める（記事ごとに数回）。
- 公開記事だけがサイトに出る（下書きは `/column` に出ない）。確認は本文要点をチャットで見せる形で行う。
