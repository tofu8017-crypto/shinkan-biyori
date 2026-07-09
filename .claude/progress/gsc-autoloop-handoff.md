# 引き継ぎ: GSC自律改善ループの実装（Sonnet→Fable）

## 2026-07-09 Fable実装完了（未コミット・テスト待ち）
藤澤さん合意のもとフル実装済み。構成:
- `scripts/weekly-optimize.js` — GSC取得(サービスアカウントJWT・googleapis不要)→①検索需要をdata/gsc-priority.jsonへ→②11〜30位/低CTRページのtitle/metaをDeepSeekで改善しseo_overridesへupsert→③docs/optimization-log.md追記。--dry-run/最大10件/21日クールダウン/文字数バリデーション付き
- `scripts/auto-generate.js` — gsc-priority.jsonの作家・書籍をテーマ選定の先頭に割り込み（ファイル無しなら従来動作）
- `lib/supabase.ts` getSeoOverride + books/authors/column/calendarの4ページのgenerateMetadataでoverride優先表示（本文h1は変えない）
- `.github/workflows/weekly-optimize.yml` — 月曜6:00 JST、結果を自動コミット
dry-runは藤澤さん実行（`! node scripts/weekly-optimize.js --dry-run`）で3回検証済み：GSC認証〜DeepSeek改善案まで動作OK。途中で見つけた問題（表示回数が1/3に見える集計・内容の捏造・ラノベ混入）は修正済み。
残り: ①GSC_CREDENTIALS_JSONのSecret登録（藤澤さん）②サイト側変更（override表示）はcf:deploy待ち ③初回の本番実行はActionsのworkflow_dispatchで

## ゴール
GSC(Google Search Console)の検索データを週次で自動取得し、コラムのキーワード選定・テーマ配分に自動反映するループを作る。「勘ではなくデータで次の一手を決める」の自動化版。

## 元設計（既にある・まず読むこと）
`docs/08-seo-growth-strategy.md` の **「5. 自律改善ループ（P1）」(139〜161行目)** と **「8-B3」(202行目)** に元の設計案あり。
骨子: 毎週GSCから「表示はあるが11〜30位」のページを抽出→AIでtitle/meta改善案→`seo_overrides`テーブルに書き込み→ページ側がoverride優先表示→`docs/optimization-log.md`に自動コミット。

**⚠️ ただしこの設計は書かれた時点(初期)のもので、今の実装とズレがある。鵜呑みにせず現状を見てから設計し直すこと。** 特に「コラムは週1本まで」という記述(182行目)は現状と矛盾(今は日次1〜2本運用)なので古い前提として無視してよい。

## 今回のセッションで新しく分かった・変わったこと

### ① GSC接続が今回やっと通った(これまでブロッカーだった)
- 対話的なClaude Code(MCP)からは接続済み・動作確認済み。サービスアカウント方式。
- 鍵ファイル: `~/secrets/gsc-shinkan-biyori-key.json`(プロジェクト外・gitに入れない場所に保管済み)
- `~/.claude.json`の`projects."/Users/fujisawakanna/Projects/shinkan-biyori".mcpServers.gsc-mcp.env`が
  `GSC_SERVICE_ACCOUNT_KEY_PATH`を見るよう書き換え済み(以前はOAuthのrefresh tokenだったが7日で失効する罠があった。サービスアカウントは失効しない)
- **GitHub Actions側にはまだ登録していない**。週次ループを作るなら、同じJSONの中身を`GSC_CREDENTIALS_JSON`のようなSecretとして登録する必要がある(藤澤さんに依頼が必要な作業)
- Search Console側の「ユーザーと権限」に`id-gsc-shinkanbiyori@shinkan-biyori.iam.gserviceaccount.com`をオーナー追加済み

### ② コラム生成のアーキテクチャが元設計から大きく進化している
元設計は「`data/seo-keywords.json`の検索ボリューム順にキーワードを選ぶ」前提だったが、今は**作家名/書籍名の固有名詞ベース**に変わっている。`scripts/auto-generate.js`を必ず読むこと。ポイント:
- 1日の生成本数(既定2)を「作家テーマ」「書籍テーマ(1冊深掘り+同作家の他作品)」に半々で分割(`collectAuthorStats`/`getAuthorTopics`/`getBookTopics`)
- 一般キーワード(`data/seo-keywords.json`・検索ボリューム順)は固有名詞が足りない日のフォールバックに格下げされている
- 品質ゲート(`scripts/quality-check.js`、字数下限1800字等)と、字数不足時の書き直しリトライ(最大3回・Geminiファクトチェックの**後**に置くこと=今回のバグ修正)が入っている。`auto-publish-due.js`は新しい順に公開判定する(古い順だと詰まるバグを今回修正した)
- つまり「GSCデータをどう反映するか」も、旧設計の「検索ボリュームでキーワードを足す」ではなく、**「どの作家・どのテーマ型(作家おすすめ vs 書名あらすじ)が実際に表示/クリックされているかを見て、生成の配分や優先順位を調整する」**方向に設計し直す必要がある。ここがFableに考えてほしい核心部分。

### ③ 今日確認できた実データ(設計の参考に)
- サイト全体: 6/17〜7/7で表示回数447・クリック21。直近2日(7/6,7/7)は55→101件と急伸
- 「絲山秋子 おすすめ」が10位(ページ1)で1クリック発生。作家名+おすすめ型のニッチキーワード戦略が機能している傍証
- サイトマップの「インデックス済み0件」表示は実データと矛盾(集計ラグの可能性、要調査だが緊急ではない)

## 最初にやること(着手順の提案)
1. `docs/08-seo-growth-strategy.md`の5章と、`scripts/auto-generate.js`・`scripts/auto-publish-due.js`・`scripts/quality-check.js`を読んで現状把握
2. 「GSCのどの指標を、コラム生成のどのパラメータにどう反映するか」を設計する(例: 表示回数が少ない作家テーマ型を減らし書籍テーマ型を増やす／特定ジャンルの反応が良ければ`LITERARY_GENRES`の重み付けを変える、等。**必ず設計判断として一度提案し、藤澤さんの合意を得てから実装**)
3. GitHub Secretsへの`GSC_CREDENTIALS_JSON`登録を藤澤さんに依頼(私はできない・鍵の中身を貼ってもらう必要がある)
4. `.github/workflows/weekly-optimize.yml` + 対応スクリプトを実装。`--dry-run`モードを必ず用意(元設計の受け入れ条件通り)

## 進め方の注意
- 藤澤さんは非エンジニア。実装の合間に日本語で説明しながら進めること
- 大きな設計判断(GSCデータの反映方法)は一人で決めず、案を示して確認を取る
- 既存の`data/.birthday-candidates-cache.json`のような一時キャッシュファイルパターンや、`scripts/list-drafts.js`/`delete-drafts.js`のような読み取り専用調査スクリプト＋一時ワークフローのパターンがこのプロジェクトで定着している。踏襲すると藤澤さんが理解しやすい
