# 新刊日和 📚

> 今日発売の文芸書が、毎朝ここに集まる。

文芸書（小説・ミステリー・SF/ホラー・エッセイ）の新刊を毎日自動収集し、カレンダー形式で見せる**自律型キュレーションサイト**です。Amazon・楽天の購入リンク付きで、気になった本をその場で買えます。

🌐 **デモ**: （公開後に追記）

---

## なぜ作ったか

本好きとして長年感じていた不満がありました。

「今週どんな文芸書が出たか」を調べるには、各出版社のサイトを何社もまわるか、大型書店に足を運ぶしかない。文芸書に絞って・発売日順に・毎日更新してくれる場所がなかった。

**なら作ろう**、と思って作りました。

---

## 特徴

### 📅 毎日自動更新（自律性）

GitHub Actions の日次 cron で毎朝9時に動きます。

```
毎朝9:00 JST（自動）
  ↓ 楽天ブックスAPIから文芸ジャンルの新刊を取得
  ↓ openBD で書影・書誌情報を補完
  ↓ ISBN-13 で名寄せして Supabase に保存
  ↓ Next.js サイトに即時反映
```

人が何もしなくても毎日データが更新されます。Claude・AIはバッチでは使いません。APIコストゼロ。

### ✍️ AIが選ぶ「今日の一冊」（フェーズ2実装予定）

Claude API（Haiku）で今日の新刊の中から1冊を選び、オリジナルの紹介文を自動生成します。「今日はどれを読もうか」という問いへの、AIによる編集判断です。

### 💰 収益モデル（事業性）

| 収益源 | 概要 | タイミング |
|---|---|---|
| 楽天アフィリエイト | 本1冊あたり約3%（約¥30） | 初日から |
| もしも経由Amazon | Amazon アソシエイト本審査前の代替 | 初日から |
| Amazon アソシエイト直 | 180日以内に3件の適格販売で本審査 | 6ヶ月以内 |
| Kindle Unlimited 登録 | KU経由の読み放題開始で¥500/件 | 中期 |

毎日更新 × 積み上がるページ数 × SEO で長期的に収益が安定する構造を設計しています。

---

## 技術スタック

| 役割 | 技術 |
|---|---|
| フロントエンド | Next.js 16（App Router + TypeScript）|
| データベース | Supabase（PostgreSQL）|
| ホスティング | Vercel |
| 日次バッチ | GitHub Actions（毎朝9時 JST / UTC 0:00）|
| 書誌データ | 楽天ブックスAPI + openBD |
| AI選書（予定）| Claude API（claude-haiku-4-5-20251001）|
| フォント | Noto Serif JP × M PLUS Rounded 1c |

---

## ジャンル構成

楽天ブックスAPIのジャンルコードに完全準拠。新しいジャンルの追加は `types/book.ts` に1行足すだけです。

| 表示名 | 楽天ジャンルID |
|---|---|
| 小説（日本）| `001004008` |
| 小説（海外）| `001004009` |
| ミステリー | `001004001` |
| SF・ホラー | `001004002` |
| エッセイ | `001004003` |

---

## セットアップ

### 必要なもの

- Node.js 18以上
- Supabase アカウント（無料枠で動きます）
- 楽天デベロッパーアカウント（無料）

### 1. リポジトリをクローン

```bash
git clone https://github.com/tofu8017-crypto/shinkan-biyori.git
cd shinkan-biyori
npm install
```

### 2. 環境変数を設定

```bash
cp .env.local.example .env.local
# .env.local を編集して各値を入力
```

| 変数名 | 取得場所 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `RAKUTEN_APP_ID` | 楽天デベロッパーポータル |
| `RAKUTEN_AFFILIATE_ID` | 楽天アフィリエイト（任意）|

### 3. Supabase にテーブルを作成

Supabase の SQL Editor で `scripts/create-tables.sql` を実行してください。

### 4. ローカル起動

```bash
npm run dev
# → http://localhost:3000
```

環境変数が未設定の場合はモックデータで動作します。

### 5. 日次バッチ（テスト実行）

```bash
RAKUTEN_APP_ID=your_id node scripts/fetch-books.js
```

---

## プロジェクト構成

```
shinkan-biyori/
├── app/                    # Next.js ページ
│   ├── page.tsx            # トップ（今日の新刊）
│   └── layout.tsx
├── components/             # UI コンポーネント
│   ├── BookCard.tsx        # 書籍カード
│   └── SiteHeader.tsx      # ヘッダー＋ジャンルタブ
├── lib/                    # クライアント・ユーティリティ
│   ├── supabase.ts         # DB アクセス（未設定時はモック）
│   ├── rakuten.ts          # 楽天 API クライアント
│   └── mock-data.ts        # 開発用モックデータ
├── scripts/                # バッチスクリプト
│   ├── fetch-books.js      # 日次データ収集
│   └── create-tables.sql   # DB テーブル定義
├── types/
│   └── book.ts             # 型定義・ジャンル設定
├── docs/                   # 設計ドキュメント
│   ├── 01_requirements.md
│   ├── 02_data_and_api.md
│   ├── 03_architecture.md
│   ├── 04_monetization_marketing.md
│   ├── 05-design-system.md
│   ├── 06_contest_strategy.md
│   └── 07_content_blog.md
└── .github/workflows/
    └── fetch-books.yml     # 日次 cron（毎朝9時 JST）
```

---

## ロードマップ

- [x] デザインシステム確定（生成り × くすみパステル・本屋カフェ風）
- [x] Next.js プロジェクト初期化
- [x] 書籍カード・ジャンルタブ実装
- [x] Supabase 連携（未設定時はモックデータで動作）
- [ ] 日次バッチ完成・GitHub Actions 設定
- [ ] 楽天 API で本物のデータを表示
- [ ] 書籍詳細ページ（`/books/[isbn]`）
- [ ] コラムページ（`/column/[slug]`）+ パンくず
- [ ] AI 選書「今日の一冊」（Claude API Haiku）
- [ ] Vercel デプロイ・独自ドメイン設定
- [ ] 楽天・Amazon アフィリエイト本番設定

---

## データ・規約について

- 書誌データは**楽天ブックスAPI**（利用規約準拠・1秒1リクエスト遵守）および**openBD**（CC0）から取得しています
- スクレイピングは一切行っていません
- 内容紹介は openBD のデータを要約・書き換えて掲載します（原文転載ではありません）

---

*新刊日和 — 毎日更新の文芸書新刊カレンダー*
