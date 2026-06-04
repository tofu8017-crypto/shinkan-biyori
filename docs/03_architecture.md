# 03. システム構成（アーキテクチャ・自動化フロー）

最終更新: 2026-06-03

---

## 1. 全体像

```
[日次バッチ] ──①取得──> 楽天ブックスAPI（発売日ウィンドウの文芸書）
     │
     ├──②補完──> openBD（ISBNをキーに 書影・内容紹介・近刊）
     │
     ├──③正規化─> ISBN-13で名寄せ（ISBN-10も生成して保持）
     │
     └──④upsert─> Supabase（books テーブル：追加 or 更新）
                        │
                        ▼
                [Next.js サイト]（Vercel公開）
                  一覧 / カレンダー / 書籍詳細 / 検索・絞り込み / 購入リンク
```

## 2. 技術スタック ✅

| 役割 | 技術 | なぜ |
|---|---|---|
| サイト本体 | **Next.js** | 書籍ごとの詳細ページを自動生成しやすく、SEOに強い（プログラマティックSEO向き）|
| データベース | **Supabase** | 無料枠あり・Postgres・APIが自動で生える。新刊データの保管庫 |
| 公開（ホスティング）| **Vercel** | Next.jsと相性が良く無料枠あり |
| 日次バッチ | **GitHub Actions（推奨）** または Vercel Cron | 毎日決まった時刻にデータ取得を自動実行 |

## 3. 自動化フロー（毎日の流れ）

1. **取得**: 楽天APIで「発売日ウィンドウ（推奨: 過去7日〜今後30日）」の文芸ジャンルをページングで横断取得。**1リクエストごとに1秒以上あける**（レート制限順守）。
2. **補完**: 取得した各ISBNを openBD に問い合わせ、書影・内容紹介で肉付け。
3. **正規化**: ISBN-13を主キーに名寄せ。978始まりはISBN-10も計算して保持（Amazon dpリンク用）。内容紹介は**要約に書き換え＋出典**。
4. **upsert**: Supabaseの `books` に upsert（既出は更新、新規は追加）。`last_synced_at` を更新。
5. **公開**: Next.js が Supabase を読んで表示。新着・更新を反映（ISR＝一定間隔での再生成、またはオンデマンド再検証）。

## 4. バッチを「どこで」動かすか（重要な論点）🔲

FJさんは「24時間駆動のエージェントシステムが構築可能」と書いていましたが、ここは整理が必要です。

- ⚠️ **会社支給のMac mini（OpenClaw用）は業務専用・個人利用不可**。この個人プロジェクトには使えません。
- ✅ **そもそも24時間動くPCは不要**。クラウドの無料スケジューラでまかなえます。

選択肢（推奨は GitHub Actions）:

| 方式 | 実行頻度 | 費用 | 備考 |
|---|---|---|---|
| **GitHub Actions（推奨）** | cron自由（1日数回も可）| 無料枠 | 競合も同系統。コードと一緒に管理できる |
| Vercel Cron（Hobby/無料）| **1日1回まで** | 無料 | 毎日更新なら十分。ただし起動時刻は±約1時間ぶれる |
| 自分のMacBook + launchd | 起動中のみ | 無料 | 24時間つけっぱなしが前提。常時稼働しないなら不向き |

→ 毎日更新が目的なら、まず **GitHub Actions の日次cron** が無料・確実でおすすめ。

### 4.1 重要: Claude(AI)本体を「毎日の実行」に使わない（2026-06-15の課金変更）

**2026年6月15日から、`claude -p`（Claudeを無人・非対話で動かすモード）と Agent SDK の利用が、通常のClaudeサブスク枠から外れ、専用クレジット（月$20〜$200・API正規料金）＋超過従量課金に移行する。**
（出典: [TechTimes 2026-06-02](https://www.techtimes.com/articles/317625/20260602/anthropic-ends-subscription-subsidy-agents-june-15-credit-pool-replaces-flat-rate-access.htm)）

これを踏まえた設計方針:

- **「定期実行」と「Claudeを使うこと」は別物**。GitHub Actions は単なるスケジューラなので、この変更とは無関係。
- 本プロジェクトの**日次バッチはClaude(AI)を一切呼ばない**。楽天API・openBD（無料の本のAPI）を叩いてSupabaseに保存する"ただのプログラム"なので、6/15の変更の影響ゼロ・無料のまま動く。
- 原則: **「Claude(＝対話モードの私)にバッチのコードを1回書いてもらう」→「動かすのはClaude抜きの無料インフラ(GitHub Actions)」**。Claudeを"毎日の実行係"にしない。
- ⚠️ 唯一の例外は Phase 3 の「SNS下書き自動生成」（[04](04_monetization_marketing.md)）。ここだけLLMを使うので、無人で定期実行する場合は Anthropic API（Haiku等）の従量利用（月数百円目安）か手動トリガーで対応する。**MVP（Phase 1）にはAIは不要＝当面ノーコスト。**

## 5. インフラ上の注意（無料枠の落とし穴）

- **Supabase 無料枠**: DB 500MB、**7日間アクセスが無いとプロジェクトが自動停止**、同時アクティブは2プロジェクトまで。
  - → 毎日バッチがDBに書き込むので、自動停止は実質回避できる。
  - → 文芸書の書誌データは軽量なので 500MB はかなり長く持つ見込み（**目安**。書影は外部URL参照にして本体に画像を持たない設計にすると節約できる）。
  - 出典: [Supabase Free Tier Limits 2026](https://www.itpathsolutions.com/supabase-free-tier-limits) ／ [Supabase Pricing](https://supabase.com/pricing)
- **Vercel Cron（Hobby）**: 日次のみ・起動時刻保証なし。
  - 出典: [Vercel Cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- **Secrets管理**: 楽天 applicationId / アフィリエイトID / Supabaseキー は `.env`（環境変数）で管理し、**絶対にGitにコミットしない**。GitHub ActionsではSecretsに登録する。

## 6. オーケストレーション（運用の自動化）

将来的に「収集 → 執筆（note/SNS下書き）→ 配信 → 分析 → 選書フィードバック」を役割分担で回す構想（編集部マルチエージェントの設計思想を流用）。
ただし **MVPでは不要**。まず①〜⑤の日次バッチとサイト表示が動くことを優先する。詳細は [04](04_monetization_marketing.md)。

## 7. リポジトリ構成（実装時の予定）

```
shinkan-biyori/
├── docs/                  # この設計ドキュメント群
├── app/ or pages/         # Next.js のページ（一覧・カレンダー・詳細）
├── lib/                   # 楽天API・openBD・Supabase クライアント
├── scripts/               # 日次バッチ（取得→補完→upsert）
├── .github/workflows/     # GitHub Actions の日次cron
└── .env.example           # 必要な環境変数の見本（実際の値は入れない）
```
