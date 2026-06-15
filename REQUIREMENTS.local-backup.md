# 新刊日和（しんかんびより） — 要件定義書

**作成日**: 2026-05-30  
**バージョン**: 0.1.0（初稿）  
**ステータス**: 決定事項確定済み・未決定事項は 🔲 で明示

---

## 1. プロダクト概要

| 項目 | 内容 |
|------|------|
| サイト名 | 新刊日和（しんかんびより） |
| URL（予定） | 未定 |
| コンセプト | 文芸書の新刊を毎日発見できる「網羅カレンダー＋注目作キュレーション」 |
| ターゲットユーザー | 文芸書を日常的に読む読書家。新刊を見逃したくない人 |
| 主な価値提供 | ① 発売日カレンダーで新刊を見落とさない ② 注目作をキュレーションして選書の手助け ③ 楽天・Amazon への直接リンクで即購入 |
| 収益モデル | アフィリエイト（楽天・Amazon） |

---

## 2. 対象範囲（ジャンル定義）

### 対象ジャンル（広め）
- 小説（国内・海外）
- エッセイ
- ノンフィクション

### 除外ジャンル（MVP では扱わない）
- 実用書・ビジネス書・参考書・漫画・写真集・絵本

### 補足
楽天ブックス API の書籍カテゴリコードを使い、上記ジャンルに相当するものをフィルタリングする。
判定基準が曖昧な場合はジャンルコードを優先し、手動補正は is_featured フラグ運用で吸収する。

---

## 3. 機能要件

### 3-1. カレンダー（月表示）
- 月ごとのカレンダービュー
- 発売日が存在する日付はハイライト表示（バッジ or ドット）
- 日付をクリックすると「その日の新刊一覧」へ遷移（または下部にインライン表示）
- 前月・翌月のナビゲーション

### 3-2. 新刊一覧
- デフォルト表示: 当日 ± 数日の新刊を発売日順
- 🔲 発売日ウィンドウ（推奨: 過去7日 ＋ 当日 ＋ 今後30日 の計38日分）
- フィルタリング: ジャンル・出版社・著者
- ソート: 発売日順・タイトル50音順
- ページネーション（1ページあたり20〜30件）
- 書影サムネイル、タイトル、著者名、出版社、発売日、価格を表示
- 楽天購入リンク・Amazonリンク（ISBNベース）を書籍カード上に配置

### 3-3. 書籍詳細ページ
- URL 構造: `/books/{isbn13}` または `/books/{rakuten-book-id}`
- 表示項目:
  - 書影（大）
  - タイトル・サブタイトル
  - 著者名（著者ページへのリンク）
  - 出版社（出版社ページへのリンク）
  - 発売日
  - ページ数・ISBN
  - 内容紹介（openBD から取得）
  - 購入リンク（楽天・Amazon）
  - 同著者の他の新刊（サイドバーまたは下部）
- 構造化データ（Book schema）を埋め込む

### 3-4. 注目作キュレーション
- トップページまたは専用セクションで注目新刊をフィーチャー表示
- 🔲 選定方法（推奨: `is_featured` フラグ + 手動選定。AI スコアリングはフェーズ2）
- 1〜3冊程度をカードまたはヒーロービジュアル形式で掲載
- 短いコメント文（50〜100文字）を手動入力できるフィールドを用意

### 3-5. 自動生成ページ群
- 著者ページ: `/authors/{author-slug}` — 著者名・代表作・新刊一覧
- 出版社ページ: `/publishers/{publisher-slug}` — 出版社名・最新刊一覧
- ジャンルページ: `/genres/{genre-slug}` — ジャンル別新刊一覧
- 月別アーカイブページ: `/archives/{yyyy}/{mm}` — 「○年○月の文芸新刊」

### 3-6. 🔲 ユーザー機能（推奨: フェーズ2 だが設計だけ先行）
- 著者フォロー機能 → フォロー著者の新刊をメール/プッシュ通知
- 読みたいリスト（ウィッシュリスト）
- ※ MVP では実装しない。フェーズ2 で Supabase Auth を使って追加

---

## 4. データ設計

### 4-1. データソース

| ソース | 用途 | 費用 |
|--------|------|------|
| 楽天ブックス書籍検索 API | 新刊発見・書誌情報・楽天アフィリエイト URL 生成 | 無料（利用規約内） |
| openBD API | 書影補完・内容紹介・書誌詳細 | 完全無料 |
| Amazon（静的リンク） | ISBN-10 ベースの購入リンク生成（PA-API 不使用） | 無料 |

### 4-2. Supabase テーブル設計（案）

#### `books` テーブル
```
id              uuid        PK, default gen_random_uuid()
isbn13          text        UNIQUE, NOT NULL
isbn10          text
title           text        NOT NULL
subtitle        text
authors         text[]      著者名の配列
publisher       text
genre           text        楽天カテゴリ名
genre_code      text        楽天カテゴリコード
published_at    date        NOT NULL（発売日）
price_tax_in    integer     税込価格（円）
cover_url       text        書影URL（openBD 優先、楽天フォールバック）
description     text        内容紹介（openBD）
rakuten_url     text        楽天アフィリエイトURL
amazon_url      text        https://www.amazon.co.jp/dp/{isbn10}?tag={associate_id}
is_featured     boolean     default false（注目作フラグ）
featured_comment text       注目作コメント（手動入力）
created_at      timestamptz default now()
updated_at      timestamptz default now()
```

#### `authors` テーブル
```
id              uuid        PK
name            text        UNIQUE, NOT NULL
slug            text        UNIQUE（URL 用）
bio             text
created_at      timestamptz default now()
```

#### `publishers` テーブル
```
id              uuid        PK
name            text        UNIQUE, NOT NULL
slug            text        UNIQUE
created_at      timestamptz default now()
```

#### `book_authors` テーブル（中間テーブル）
```
book_id         uuid        FK → books.id
author_id       uuid        FK → authors.id
role            text        「著」「訳」「編」など
PRIMARY KEY (book_id, author_id)
```

#### `batch_logs` テーブル
```
id              uuid        PK
run_at          timestamptz
source          text        「rakuten」「openbd」
fetched_count   integer
upserted_count  integer
error_count     integer
notes           text
```

### 4-3. インデックス（推奨）
- `books.published_at` — カレンダー・日付検索
- `books.isbn13` — 書籍詳細ページ参照
- `books.is_featured` — 注目作絞り込み
- `books.genre_code` — ジャンルフィルタ

---

## 5. 収益設計・アフィリエイト戦略

### 5-1. 楽天アフィリエイト（メイン収益源）

- 楽天ブックス API のレスポンスに含まれるアフィリエイト URL をそのまま利用
- URL 例: `https://books.rakuten.co.jp/rb/xxxxxxx/?l-id=...&rafcid={affiliate_id}`
- Supabase の `books.rakuten_url` に保存し、ページ表示時に直接リンク
- クリック率向上施策: 「楽天で購入」ボタンを書籍カードの目立つ位置に配置

### 5-2. Amazon アソシエイト

- **MVP 段階**: ISBN-10 から静的リンクを生成（PA-API 不要）
  - URL 形式: `https://www.amazon.co.jp/dp/{isbn10}?tag={associate_id}`
  - ISBN-13 → ISBN-10 変換ロジックをバッチに組み込む
- **審査フロー**: 仮登録 → リンク設置 → 3件以上の売上実績 → 本審査通過
- 🔲 **PA-API 移行タイミング**（推奨: Amazon 本審査通過後、フェーズ2 で対応）
  - PA-API を使うと価格リアルタイム取得・在庫確認・正式書影が利用可能になる

### 5-3. 将来的な収益拡大（フェーズ2 以降）
- honto・e-hon など他書店アフィリエイト追加（🔲 対応書店の選定は後回し）
- 出版社・書店からの直接広告掲載（アクセスが積み上がってから）

---

## 6. システム構成図

```
[GitHub Actions（cron: 毎日 05:00 JST）]
    │
    ├─ 楽天ブックス API
    │   └─ 新刊データ取得（発売日ウィンドウ分）
    │
    ├─ openBD API
    │   └─ 書影・内容紹介・書誌補完
    │
    └─ Supabase（PostgreSQL）
        └─ books / authors / publishers テーブルへ upsert

[Vercel（フロントエンド）]
    │
    ├─ Next.js App Router
    │   ├─ SSG: 書籍詳細・著者・出版社・月別アーカイブページ
    │   ├─ SSR/ISR: カレンダー・新刊一覧（日次で再生成）
    │   └─ API Routes: 必要に応じてサーバーサイド処理
    │
    └─ Supabase クライアント（@supabase/supabase-js）
        └─ books テーブルを参照してページ生成
```

---

## 7. 自動化フロー（GitHub Actions バッチ）

### 実行スケジュール
- 毎日 05:00 JST（= UTC 20:00 前日）に cron 実行
- 手動実行（`workflow_dispatch`）も可能にしておく

### バッチ処理の流れ

```
1. 楽天ブックス API 呼び出し
   - 検索条件: ジャンルコード × 発売日ウィンドウ
   - ページネーション処理（1回30件 × 複数ページ）
   - レスポンスから isbn13, title, authors, publisher,
     published_at, price, cover_url, rakuten_url を抽出

2. openBD API 呼び出し（補完）
   - 楽天で取得した ISBN リストを一括送信
   - 内容紹介（description）・書影 URL を補完
   - 楽天の書影が取得できていない場合は openBD の書影を使用

3. Amazon リンク生成
   - ISBN-13 → ISBN-10 変換
   - `https://www.amazon.co.jp/dp/{isbn10}?tag={associate_id}` を生成

4. Supabase upsert
   - isbn13 をユニークキーとして UPSERT
   - 既存レコードは updated_at のみ更新（is_featured は上書きしない）
   - バッチ結果を batch_logs に記録

5. エラー通知
   - 失敗時は GitHub Actions の通知 or メール通知（設定済みの場合）
```

### 環境変数（Secrets）
```
RAKUTEN_APP_ID         楽天 API アプリ ID
RAKUTEN_AFFILIATE_ID   楽天アフィリエイト ID
AMAZON_ASSOCIATE_ID    Amazon アソシエイト ID
SUPABASE_URL           Supabase プロジェクト URL
SUPABASE_SERVICE_KEY   Supabase サービスロールキー（バッチ用）
```

---

## 8. SEO 設計

### 8-1. URL 構造
```
/                           トップページ（注目作＋直近新刊）
/books/{isbn13}             書籍詳細ページ
/authors/{author-slug}      著者ページ
/publishers/{publisher-slug} 出版社ページ
/genres/{genre-slug}        ジャンルページ
/archives/{yyyy}/{mm}       月別アーカイブ（例: /archives/2026/05）
/calendar                   発売日カレンダー
```

### 8-2. 構造化データ（JSON-LD）
- 書籍詳細ページ: `Book` schema
  ```json
  {
    "@context": "https://schema.org",
    "@type": "Book",
    "name": "タイトル",
    "author": { "@type": "Person", "name": "著者名" },
    "isbn": "ISBN13",
    "datePublished": "YYYY-MM-DD",
    "publisher": { "@type": "Organization", "name": "出版社名" },
    "image": "書影URL",
    "description": "内容紹介"
  }
  ```
- 一覧ページ: `ItemList` schema（書籍リストを ListItem で列挙）

### 8-3. メタタグ設計
- `<title>`: 「{タイトル} — {著者名} | 新刊日和」
- `<meta description>`: 内容紹介の先頭 120 文字
- OGP（og:title, og:description, og:image）: 書影を og:image に設定
- Twitter Card: `summary_large_image`

### 8-4. サイトマップ
- `/sitemap.xml` を Next.js の `generateSitemaps` で自動生成
- books / authors / publishers / archives の全 URL を含める
- 書籍詳細ページは発売日の前後に `lastmod` を更新

### 8-5. キーワード戦略
- ページタイトルに「新刊」「発売日」「文芸」を含める
- 月別アーカイブで「2026年6月 文芸新刊」などの検索に対応
- 著者ページで「{著者名} 新刊」の検索に対応

### 8-6. パフォーマンス
- Core Web Vitals 確保（Vercel + Next.js 最適化）
- 書影は `next/image` で最適化（WebP 変換・遅延読み込み）
- カレンダー以外のページは ISR（最大1日キャッシュ）

---

## 9. フェーズ分け

### MVP（フェーズ1）— 最小限で公開できる状態

**目標**: データが自動で蓄積され、訪問者が新刊を見つけて購入リンクへ進める状態

| 機能 | 内容 |
|------|------|
| 自動バッチ | 楽天 + openBD → Supabase 日次更新 |
| カレンダー | 月表示 ＋ 日クリックで一覧表示 |
| 新刊一覧 | 発売日フィルタ・ジャンルフィルタ |
| 書籍詳細 | ISBN ベースの個別ページ（SEO 対応） |
| 購入リンク | 楽天（アフィリエイト）＋ Amazon（静的リンク） |
| 自動生成ページ | 著者・出版社・ジャンル・月別アーカイブ |
| 注目作 | is_featured フラグ ＋ 手動コメント |
| 構造化データ | Book / ItemList schema |
| サイトマップ | 自動生成 |

**MVP の対象外**:
- ユーザー認証・フォロー機能
- Amazon PA-API 連携
- AI スコアリング
- honto など他書店リンク

---

### フェーズ2 — アクセス・売上が立ち始めてから追加

| 機能 | 条件・目安 |
|------|-----------|
| Amazon PA-API 連携 | Amazon 本審査通過後（3件売上達成後） |
| AI 注目作スコアリング | MVP で選定フローが安定してから |
| ユーザー認証・著者フォロー | MAU 500 以上など一定の訪問者獲得後 |
| 新刊メール/プッシュ通知 | フォロー機能の実装後 |
| 他書店リンク（honto など） | 🔲 対応書店は検討中 |
| 読みたいリスト | ユーザー認証実装後 |

---

## 10. 非機能要件・規約順守

### パフォーマンス
- トップページ LCP 2.5 秒以内（Core Web Vitals Good 基準）
- Vercel Edge Network による CDN キャッシュを活用

### セキュリティ
- Supabase の API キーはフロントに公開しない（Row Level Security 設定）
- バッチ用の `SERVICE_KEY` は GitHub Secrets にのみ保存
- `.env.local` は `.gitignore` で除外必須

### 利用規約・著作権
- **楽天ブックス API**: 利用規約に従いアフィリエイト ID を正しく付与する。書影・書誌情報の再配布条件を確認し準拠する
- **openBD**: CC0 ライセンス。利用制限なし
- **Amazon アソシエイト**: 審査前のリンク設置可否を規約で確認する。価格表示は「最新価格は Amazon で確認」などの注記を入れる
- **内容紹介文**: openBD のデータは出版社提供。著作権上問題ない範囲で掲載し、出典を明記することが望ましい

### 可用性
- バッチ失敗時にフロントの表示が止まらないように設計する（Supabase には最後に成功したデータが残る）
- バッチの失敗は `batch_logs` に記録し、定期的にモニタリング

---

## 11. 未決定事項

以下の項目はまだ決まっていません。実装前に確定させてください。

| # | 項目 | 推奨案 | ステータス |
|---|------|--------|-----------|
| 🔲 1 | 発売日ウィンドウ（バッチで取得する範囲） | 過去7日 ＋ 当日 ＋ 今後30日（近刊含む計38日） | 未決定 |
| 🔲 2 | 注目作ピックの選定方法 | `is_featured` フラグ + 手動選定（AI スコアリングはフェーズ2） | 未決定 |
| 🔲 3 | Amazon 以外の購入先書店 | MVP は Amazon＋楽天の2択のみ。honto などはフェーズ2 | 未決定 |
| 🔲 4 | ユーザー機能の優先度 | 著者フォロー → 新刊通知（リテンション強化）をフェーズ2 で実装 | 未決定 |
| 🔲 5 | Amazon PA-API の移行タイミング | Amazon 本審査通過後（3件売上達成後）にフェーズ2 で対応 | 未決定 |
| 🔲 6 | サイトドメイン | shinkan-biyori.jp など（取得前） | 未決定 |
| 🔲 7 | 楽天 API のジャンルコード選定 | 小説・エッセイ・ノンフィクションに対応するコードを要確認 | 未決定 |
| 🔲 8 | 注目作コメントの入力 UI | Supabase の管理画面で直接編集 or 簡易管理画面を別途作成 | 未決定 |

---

*このファイルは決定事項が確定するたびに更新してください。🔲 が全て埋まったら実装フェーズへ移行できます。*
