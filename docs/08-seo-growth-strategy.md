# 08. SEO・グロース戦略 & 実装タスク（HOOTLコンテスト対応版）

> このドキュメントは Claude Code への指示書。docs/ に配置し、CLAUDE.md から参照すること。
> コンテスト評価軸: ①自律性 ②事業性 ③売上につながる反応
> 期限: 7月コンテスト。新規ドメインのため「SEOの成果」ではなく「SEOが自律的に積み上がる仕組み」+「即効性のある流入チャネル」の両輪で勝負する。

## 0. 戦略サマリー（なぜこの順番か）

### 勝ち筋の再定義
- ❌ 「本の名前 評判」クエリは狙わない。読書メーター・ブクログ・Amazonが上位独占。実レビューデータを持たない当サイトがAI生成で「評判」ページを量産すると、低品質コンテンツ判定・E-E-A-Tリスクが高い。
- ✅ 当サイトの資産は構造化された書誌データベース。データで一次回答できるクエリに全振りする:
  - 著者名 + 新刊 / 著者名 + 新刊 + 2026（著者ページで回答）
  - シリーズ名 + 最新刊 / シリーズ名 + 何巻まで（シリーズページで回答）
  - タイトル + 発売日 / タイトル + 文庫（書籍詳細ページで回答）
  - 2026年7月 + 文庫 + 新刊 / 今月の新刊 + 小説（月別カレンダーページで回答）
- これらは検索意図が「事実の確認」なので、レビューサイトよりデータベース型サイトが構造的に有利。

### 7月までのタイムライン制約
- 新規ドメインのSEO効果発現は3〜6ヶ月。7月時点でSEO売上の実績は期待できない。
- 評価軸③は X(Twitter)自動投稿bot + IndexNow + 計測ダッシュボード で「初動の反応」を作る。
- 評価軸①は GSC実クエリ → Claude API → コンテンツ自動改善 → 自動デプロイ の閉ループで証明する。

### 優先度
- **P0（6月中に必須）**: ページアーキテクチャ拡張・構造化データ・sitemap・計測基盤
- **P1（6月下旬〜7月頭）**: X自動投稿bot・IndexNow・GSC自律改善ループ
- **P2（余力があれば）**: 今日の一冊AI選書・週次自動レポート

## 1. ページアーキテクチャ（P0）

現状はトップ + /date/[date] + /genre/[id] のみ。以下を追加する。
すべてSSG/ISR（revalidate: 3600〜86400）で静的生成。クロールバジェットと表示速度のため。

### 1-1. 書籍詳細ページ /books/[isbn]
最重要。1冊 = 1URL でロングテールを受ける。

含めるもの:
- タイトル・著者・出版社・レーベル・発売日・価格・ジャンル
- openBD の内容紹介を要約・リライトして掲載（原文転載禁止。バッチ時にClaude Haikuで100〜150字に書き換え、DBに保存。詳細ページ表示時にはAPIを呼ばない）
- 同著者の他の新刊（内部リンク）・同シリーズの既刊（内部リンク）・同日発売の本（内部リンク）
- 楽天・Amazonアフィリエイトボタン（クリック計測イベント付き、§4参照）
- `<title>`: {タイトル} の発売日・あらすじ | 新刊日和
- meta description: 発売日とあらすじ要約を含める（クエリ「タイトル 発売日」への直接回答）

受け入れ条件:
- Supabaseの全書籍にページが生成される（generateStaticParams + ISR fallback）
- 内部リンク（著者/シリーズ/同日）が最低1つ以上表示される
- Lighthouse SEOスコア 95以上

### 1-2. 著者ページ /authors/[slug]
クエリ「著者名 新刊」の受け皿。競合が最も弱いゾーン。

- 著者名の正規化処理が必要: 楽天APIの著者名は「姓 名」「姓　名」表記揺れがある。`lib/normalize-author.ts` を作り、スペース正規化 + 連名（/区切り）の分割を行う。slugは著者名のURIエンコードでよい（日本語URLはGoogle的に問題ない）
- 内容: 著者の新刊を発売日降順で一覧 + 「{著者名}の次の新刊は{date}発売の『{title}』です」という一文をページ冒頭に（強調スニペット狙い）
- `<title>`: {著者名}の新刊一覧・最新刊【2026年最新】 | 新刊日和

受け入れ条件:
- 連名著者がそれぞれの著者ページに分割されて登録される
- booksテーブルに author_slugs text[] カラム追加 or 別テーブル authors + 中間テーブル

### 1-3. シリーズページ /series/[slug]
クエリ「シリーズ名 最新刊」「○○ 何巻まで」の受け皿。

- シリーズ判定: タイトル末尾の （2） 2巻 XII （十三） などの巻数パターンを正規表現で抽出し、巻数を除いたベースタイトルでグルーピング。`lib/detect-series.ts` を作る。完璧でなくてよい（2冊以上マッチしたものだけシリーズ化）
- 内容: 「『{シリーズ名}』の最新刊は{N}巻（{date}発売）です」を冒頭に + 把握している巻の一覧
- `<title>`: {シリーズ名} 最新刊・続刊情報（{N}巻まで発売中） | 新刊日和

### 1-4. 月別カレンダーページ /calendar/[yyyy-mm]
クエリ「2026年7月 文庫 新刊」「7月 新刊 小説」の受け皿。検索ボリュームが最も大きい枠。

- 月内の新刊をジャンル別セクションで一覧 + 冊数サマリー
- 前月・翌月への内部リンク
- ジャンル絞り込み版 /calendar/[yyyy-mm]/[genreId] も生成（「7月 ミステリー 新刊」対応）

### 1-5. 内部リンク構造
```
トップ
 ├─ /calendar/yyyy-mm ── /date/yyyy-mm-dd ── /books/[isbn]
 ├─ /genre/[id]                                  │
 ├─ /authors/[slug] ←───────── 相互リンク ────────┤
 └─ /series/[slug] ←───────── 相互リンク ────────┘
```
書籍詳細が末端、著者・シリーズ・カレンダーがハブ。孤立ページを作らない。
フッターに「今月の新刊」「先月の新刊」「ジャンル一覧」への固定リンク。

## 2. 構造化データ（P0）

`components/JsonLd.tsx` を作成し、各ページの `<script type="application/ld+json">` を共通化する。

| ページ | スキーマ |
|---|---|
| 書籍詳細 | Book（name, author→Person, isbn, datePublished, publisher→Organization, bookFormat, image）+ BreadcrumbList + 必要なら Offer（楽天価格） |
| 著者ページ | Person + ItemList（新刊一覧）+ BreadcrumbList |
| シリーズ | BookSeries + ItemList + BreadcrumbList |
| 日付/月別 | ItemList（各itemは書籍詳細URL）+ BreadcrumbList |
| トップ | WebSite + SearchAction（サイト内検索があれば） |
| コラム | Article（author, datePublished, dateModified） |

注意:
- Bookのリッチリザルト表示は日本では限定的。目的は表示装飾ではなく、エンティティ理解の促進と将来のAI検索（AI Overviews / LLM引用）対策。コンテスト説明でもそう位置付ける。
- レビューを持っていないので **aggregateRating は絶対に入れない**（虚偽構造化データはペナルティ対象）。

受け入れ条件:
- リッチリザルトテスト（schema.org validator）で全ページタイプがエラー0
- CIにJSON-LDのスキーマバリデーションを追加（zodで型定義してビルド時検証）

## 3. クロール・インデックス基盤（P0〜P1）

### 3-1. sitemap.xml（P0）
- `app/sitemap.ts` で動的生成。books / authors / series / calendar / date / column を網羅
- 5万URL超えたら分割（sitemap index）。lastmodを正しく入れる（バッチ更新時刻）

### 3-2. robots.txt・canonical（P0）
- `app/robots.ts`。検索結果ページ・パラメータ付きURLをDisallow
- 全ページに self-canonical

### 3-3. IndexNow（P1）
- 日次バッチの最後に、新規生成されたURL一覧を IndexNow API（Bing）にPOSTする `scripts/notify-indexnow.js` を追加し、fetch-books.yml のステップに組み込む
- Bing経由のインデックスは即日反映されることが多く、7月時点で「検索流入ゼロではない」状態を作る現実的な手段
- Google Search Console へのsitemap登録は手動で1回（これだけは人手。READMEのセットアップ手順に記載）

受け入れ条件:
- バッチ実行ログに IndexNow への送信URL数が出力される

## 4. 計測基盤＝「売上につながる反応」の証明装置（P0）

コンテストで提示する数字を自動で集計・可視化できる状態にする。

### 4-1. アフィリエイトクリック計測
- 楽天/Amazonボタンに GA4 イベント affiliate_click（params: isbn, store, page_type）を送信
- 同時に Supabase の click_events テーブルにも記録（GA4に依存しない自前集計。`app/api/track/route.ts` 経由、IPは保存しない）

### 4-2. 公開ダッシュボード /stats（任意だがコンテスト映え大）
- Supabaseから集計した「掲載冊数累計」「ページ数」「アフィクリック数推移」「日次バッチ稼働率」を表示
- 審査員が見て「動いている・伸びている」ことが一目でわかる。透明性自体が事業性のアピールになる

受け入れ条件:
- クリック→Supabase記録→/statsに反映、までがデプロイ後に動作する

## 5. 自律改善ループ（P1）— 評価軸①の本命

「人手を減らして価値提供」を最も強く示す機能。週次のGitHub Actionsで以下を回す。

```
毎週月曜 6:00 JST（.github/workflows/weekly-optimize.yml）
  ↓ GSC Search Analytics API から過去7日の query / page / impressions / position を取得
  ↓ 「表示回数はあるが順位11〜30位」のページを抽出（＝改善余地が最大のゾーン）
  ↓ Claude API（Haiku）に該当ページのtitle/meta description/冒頭文の改善案を生成させる
  ↓ 改善内容を seo_overrides テーブル（isbn/slug, title, description, intro）に書き込み
  ↓ ページ側は overrides があればそれを優先表示（ISRで自動反映）
  ↓ 変更ログを docs/optimization-log.md に自動コミット（監査可能性＝コンテスト提出資料）
```

実装メモ:
- GSC APIはサービスアカウント認証。GSC_CREDENTIALS_JSON をGitHub Secretsに
- 安全装置: 1回の実行で書き換えるページは最大10件。Claudeの出力はzodでバリデーション（文字数上限、禁止ワード）。直接コードは書き換えずDBオーバーライド方式にすることで暴走リスクを構造的に排除
- データが溜まるまで（公開後2〜3週）は対象0件で空振りしてよい。ループが存在し稼働していること自体が提出物

受け入れ条件:
- dry-runモード（--dry-runで改善案をログ出力のみ）がある
- optimization-log.md に「いつ・どのページを・なぜ・どう変えたか」が自動追記される

## 6. X(Twitter)自動投稿bot（P1）— 即効流入チャネル

SEOが立ち上がるまでの集客とコンテスト用の「反応」実績を作る。

- 日次バッチの後段で `scripts/post-to-x.js` を実行（X API v2 Free tierで可: 月1,500件投稿枠 → 日次2〜3投稿は余裕）
- 投稿内容（Claude Haikuで生成、テンプレ+揺らぎ）:
  - 毎朝: 「📚 今日{M}/{D}発売の文芸書は{N}冊。注目は『{title}』({author})…」+ サイトの日付ページURL
  - 注目作: 有名著者（池井戸潤・知念実希人クラス）の新刊が出る日は単独投稿
- 投稿文にアフィリエイトリンクは貼らない（規約リスク）。必ず自サイトURLに誘導し、サイト上でアフィクリックさせる
- UTMパラメータ付与（?utm_source=x&utm_medium=social）でGA4計測

受け入れ条件:
- 投稿失敗時にバッチ全体が落ちない（try-catchで分離、ログのみ）
- 同一内容の重複投稿防止（投稿履歴をSupabaseに記録）

## 7. コンテンツ品質ガードレール（全フェーズ共通）

- openBD内容紹介の原文転載は禁止。必ず要約・リライト（既にREADME方針通り）
- AIに「読んでいない本の感想・評価」を書かせない。書けるのは事実（発売日・著者・あらすじ要約・受賞歴・シリーズ情報）のみ
- 「評判」「レビュー」を冠したページは作らない。代わりに書籍詳細ページ内で「どんな本？」セクション（事実ベース）を充実させる
- コラム（/column）は週1本まで。量産しない。「今月の注目文芸書5選」のようなデータドリブン企画に限定し、column-writerスキルを使用

## 8. タスクリスト（Claude Codeへの実行順）

### Phase A: SEO基盤（P0・最優先）
- A-1. `lib/normalize-author.ts`（著者名正規化・連名分割）+ テスト
- A-2. `lib/detect-series.ts`（巻数抽出・シリーズグルーピング）+ テスト
- A-3. Supabaseスキーマ拡張: authors / series / seo_overrides / click_events テーブル（scripts/create-tables.sql 更新）
- A-4. 日次バッチ拡張: 取得時に著者正規化・シリーズ判定・あらすじリライト（Claude Haiku）をDB保存
- A-5. /books/[isbn] 詳細ページ（内部リンク・アフィボタン・計測込み）
- A-6. /authors/[slug] ページ
- A-7. /series/[slug] ページ
- A-8. /calendar/[yyyy-mm]（+ジャンル絞り込み）ページ
- A-9. `components/JsonLd.tsx` + 全ページに構造化データ + ビルド時バリデーション
- A-10. `app/sitemap.ts` / `app/robots.ts` / canonical
- A-11. GA4導入 + affiliate_click イベント + `app/api/track` + click_events記録

### Phase B: 自律性・集客（P1）
- B-1. `scripts/notify-indexnow.js` + バッチ組み込み
- B-2. `scripts/post-to-x.js` + 投稿履歴テーブル + バッチ組み込み
- B-3. `.github/workflows/weekly-optimize.yml` + GSC API連携 + seo_overridesループ + optimization-log自動コミット
- B-4. /stats 公開ダッシュボード

### Phase C: 仕上げ（P2）
- C-1. 「今日の一冊」AI選書（既存ロードマップ通り、トップに表示 + X投稿に組み込み）
- C-2. 週次自動レポート: GSC・GA4・クリックデータから docs/weekly-report/yyyy-ww.md をClaude生成で自動コミット（コンテスト提出資料がそのまま溜まる）
- C-3. OGP画像の動的生成（@vercel/ogで書影+発売日入りカード → X投稿のCTR向上）

## 9. コンテストでの見せ方（docs/06_contest_strategy.md への追記案）

| 評価軸 | 提示するもの |
|---|---|
| ①自律性 | システム図: 日次バッチ→サイト更新→X投稿→IndexNow、週次: GSC→Claude→自動リライト。人間の作業は月0時間であることをoptimization-logとActions履歴で証明 |
| ②事業性 | 「新刊の発売日確認」という明確なJob-to-be-done。レビューサイトと競合しないデータベースポジション。アフィリエイトの単価×ページ数×検索需要のユニットエコノミクス試算 |
| ③反応 | /statsダッシュボード（掲載冊数・クリック数・X経由流入の推移）。SEOは「仕込み済みで指標が右肩上がり」のグラフで示す |
