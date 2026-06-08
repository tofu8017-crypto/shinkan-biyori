---
name: column-writer
description: (新刊日和のSEOコラムを執筆) Googleサジェストで実際の検索キーワードを取得し、実在の新刊データを使って文芸コラムを執筆、Supabaseに下書き保存→確認後に公開する。「コラム書いて」「コラム執筆」で起動。
user_invocable: true
---

# 新刊日和 コラム執筆スキル

新刊日和（shinkanbiyori.com）のSEOコラムを書く。**執筆はあなた（Claude＝サブスク）が行う**ので追加API費用はかからない。ラッコAPIは不要（Googleサジェストで代替）。

作業ディレクトリ: `/Users/Lifehack/shinkan-biyori`

## 手順

1. **テーマ決め**: ユーザー指定があればそれを優先。無ければ対象ジャンルの直近新刊から自然なテーマを選ぶ。
   - 主なジャンルID: 小説（日本）=001004008 / 小説（海外）=001004009 / ミステリー=001004001 / SF・ホラー=001004002 / エッセイ=001004003 / ビジネス・実用書=001006

2. **キーワード取得**: `node scripts/suggest-keywords.js "<シード語>"`（例: "小説 おすすめ"）を実行し、実際に検索されているサジェストを取得。狙うキーワードを1つ決める（target_keyword）。

3. **素材取得**: `node -r dotenv/config scripts/recent-books.js <ジャンルID> 30 dotenv_config_path=.env.local` で直近の実在新刊を取得。文芸らしい注目作を5〜7冊選ぶ（なろう系・ラノベ・POD等はブランドに合わなければ避ける）。各本のamazon_url（tag=shinkanbiyori-22付き）を控える。

4. **執筆**: 日本語の読みやすいコラムをHTMLで書く。
   - 使うタグは `h2 / h3 / p / strong / ul / li / a / blockquote` のみ。**HTML属性のクォートはシングル**で（JSON化のため。例: `<a href='...'>`）。
   - **あらすじ・事実を捏造しない**。著者の確かな実績（確信のある受賞歴等）以外は一般的な紹介に留める。
   - 各本に **Amazonリンク**（recent-books.jsのamazon_url）を貼る。
   - 末尾に**内部リンク**（`/genre/<id>` や `/`）を入れる（SEO）。
   - 狙うキーワードを title・冒頭・見出しに自然に含める。

5. **下書き保存**: 記事を `/tmp/column-<slug>.json` に書く。形式:
   `{ "slug": "...", "title": "...", "body_html": "...", "excerpt": "...", "target_keyword": "...", "genre_id": "...", "status": "draft" }`
   - slugは半角英数とハイフン（例: `osusume-mystery-2026-07`）。body_htmlは1行（改行を入れない）。
   - 実行: `node -r dotenv/config scripts/save-column.js /tmp/column-<slug>.json dotenv_config_path=.env.local`

6. **レビュー**: 記事の要点（タイトル・取り上げた本・狙うKW）をFJさんに見せ、**公開してよいか確認**する。

7. **公開**: OKが出たら `node -r dotenv/config scripts/publish-column.js <slug> published dotenv_config_path=.env.local`。直したい場合は5に戻って再保存。公開を取り消すなら `... publish-column.js <slug> draft ...`。

## 重要な注意
- **AI量産記事はGoogleにスパム判定されうる**。必ずFJさんの確認を経てから公開する。質の低い記事を大量公開しない。
- Googleサジェストは非公式エンドポイントなので**少量利用**に留める（記事ごとに数回）。
- 公開記事だけがサイトに出る（下書きは `/column` に出ない）。確認は本文要点をチャットで見せる形で行う。
