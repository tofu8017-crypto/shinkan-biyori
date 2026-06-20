---
name: column-writer
description: (新刊日和のSEOコラムを執筆) Googleサジェストで実際の検索キーワードを取得し、実在の新刊データを使って文芸コラムを執筆、Supabaseに下書き保存→確認後に公開する。「コラム書いて」「コラム執筆」で起動。
user_invocable: true
---

# 新刊日和 コラム執筆スキル（薄いラッパー）

新刊日和（shinkanbiyori.com）のSEOコラムを書く。**執筆は DeepSeek API に委譲する**（Claudeのトークンを使わない）。このスキルは指揮役（データ収集 → DeepSeekに執筆させる → 保存 → 確認 → 公開）に徹し、文体・禁止表現・SEO構成などの執筆ルールは持たない（すべて SEOペルソナのプロンプト＝`scripts/prompts/seo-column-writer.md` が持つ）。Googleサジェスト＋既存のSEMrushキーワード（`data/seo-keywords.json`）で検索意図を把握する。

作業ディレクトリ: `/Users/fujisawakanna/Projects/shinkan-biyori`

**設計**: ラッパー（本スキル）＝薄い。執筆者ペルソナ＝SEOライター「セオ」＝`scripts/prompts/seo-column-writer.md`。執筆ルール（文体・SEO構成）を直したいときはこのプロンプトを編集する。
**前提**: `.env.local` に `DEEPSEEK_API_KEY` が必要。
**ナカノについて**: 旧ペルソナ「ナカノ」（`.claude/agents/nakano.md`）は **はてブ記事用に転用**。新刊日和のコラムでは使わない。

## 手順

1. **テーマ決め**: ユーザー指定があればそれを優先。無ければ対象ジャンルの直近新刊から自然なテーマを選ぶ。
   - 主なジャンルID: 小説（日本）=001004008 / 小説（海外）=001004009 / ミステリー=001004001 / SF・ホラー=001004002 / エッセイ=001004003 / ビジネス・実用書=001006

2. **キーワード取得**: `node scripts/suggest-keywords.js "<シード語>"`（例: "小説 おすすめ"）を実行し、実際に検索されているサジェストを取得。狙うキーワードを1つ決める（target_keyword）。

3. **素材取得**: `node -r dotenv/config scripts/recent-books.js <ジャンルID> 30 dotenv_config_path=.env.local` で直近の実在新刊を取得。文芸らしい注目作を5〜7冊選ぶ（なろう系・ラノベ・POD等はブランドに合わなければ避ける）。各本の amazon_url・isbn13 を控える。

4. **各本をリサーチ（最重要・薄い記事を防ぐ）**: 選んだ本は **書く前に必ず実際の情報を調べる**。これを飛ばすと薄い記事になる。
   - openBD: `curl -s 'https://api.openbd.jp/v1/get?isbn=<isbn13をカンマ区切り>'` → `onix.CollateralDetail.TextContent`（TextType=03）が出版社の内容紹介。
   - openBDに無い新刊は **WebSearchで「著者名 書名 あらすじ」** を調べ、あらすじ・テーマ・著者の実績・評価を把握する。
   - ※検索はサブエージェントに委任せず自分で行う（FJさんルール）。

5. **執筆をDeepSeekに委譲**: 手順2〜4で集めた資料を「素材JSON」にまとめ、`/tmp/column-materials.json` に書き出してから DeepSeek 執筆スクリプトを実行する。スキル側は文体・SEO構成を指示しない（それは `scripts/prompts/seo-column-writer.md` が持つ）。
   - 素材JSONの形（捏造防止の生命線。資料に無いことは書かせない）:
     ```json
     {
       "target_keyword": "...", "genre_id": "001004001",
       "suggests": ["手順2のサジェスト語"],
       "books": [
         { "title": "...", "author": "...", "publisher": "...", "label": "...",
           "published_date": "YYYY-MM-DD", "price": "...", "isbn13": "...",
           "amazon_url": "...", "rakuten_url": "...",
           "summary": "openBD等の内容紹介（手順4）",
           "author_facts": "著者の過去作・受賞歴など。無ければ『未確認』" }
       ]
     }
     ```
   - 実行: `node -r dotenv/config scripts/write-column-deepseek.js /tmp/column-materials.json dotenv_config_path=.env.local`
   - 成功すると `/tmp/column-<slug>.json`（slug/title/body_html/excerpt/target_keyword/genre_id/status）が生成される。資料に無いURL・事実は出力しない契約。

6. **下書き保存**: 手順5で生成された `/tmp/column-<slug>.json` をDBへ保存する。
   - 実行: `node -r dotenv/config scripts/save-column.js /tmp/column-<slug>.json dotenv_config_path=.env.local`
   - DeepSeekの出力に許可外タグ・禁止表現・資料に無い事実が混じっていないか軽く目視チェック（基本はプロンプトで抑止済み）。怪しければ素材JSONを直して手順5から再実行。

7. **レビュー**: 記事の要点（タイトル・取り上げた本・狙うKW・文字量）をFJさんに見せ、**公開してよいか確認**する。

8. **公開**: OKが出たら `node -r dotenv/config scripts/publish-column.js <slug> published dotenv_config_path=.env.local`。直す場合は6に戻って再保存。公開取消は `... publish-column.js <slug> draft ...`。

## 重要な注意
- **AI量産記事はGoogleにスパム判定されうる**。必ずFJさんの確認を経てから公開する。質の低い記事を大量公開しない。
- Googleサジェストは非公式エンドポイントなので**少量利用**に留める（記事ごとに数回）。
- 公開記事だけがサイトに出る（下書きは `/column` に出ない）。確認は本文要点をチャットで見せる形で行う。
