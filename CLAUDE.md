@AGENTS.md

## SEO・グロース戦略（コンテスト対応）
新刊日和のSEO・グロース戦略と実装タスクは [docs/08-seo-growth-strategy.md](docs/08-seo-growth-strategy.md) を参照。
ページ設計・構造化データ・自律改善ループ・X bot・計測基盤の方針と Phase A〜C のタスク順を定義。

## コラム執筆（DeepSeek＋SEOペルソナ「セオ」）
コラムは薄いラッパー [.claude/skills/column-writer](.claude/skills/column-writer/SKILL.md) が指揮し、**執筆は DeepSeek API に委譲する**（Claudeのトークンを使わない）。
SEO文体・禁止表現・構成ルールは [scripts/prompts/seo-column-writer.md](scripts/prompts/seo-column-writer.md) が持つ（文体を直すときはそこを編集）。実行スクリプトは `scripts/write-column-deepseek.js`、要 `DEEPSEEK_API_KEY`。
旧ペルソナ「ナカノ」（[.claude/agents/nakano.md](.claude/agents/nakano.md) / 原本 [docs/09-author-persona-nakano.md](docs/09-author-persona-nakano.md)）は**はてブ記事用に転用**。
