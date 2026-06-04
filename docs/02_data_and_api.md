# 02. データとAPI（取得元・スキーマ・規約）

最終更新: 2026-06-03

データの基本方針: **公式APIで取得 → ISBNで名寄せ → Supabaseに upsert（追加・更新）**。
スクレイピング（HTMLの直接読み取り）はしない（規約・安定性・凍結リスク回避のため）。

---

## 1. データソース（3層）

### ① 楽天ブックス書籍検索API（取得 ＋ アフィリエイトの起点）✅

- **役割**: 「今日発売の文芸書」を横断取得する主軸。
- **返ってくる主な項目（裏取り済み）**: `title`（書名）, `author`（著者）, `publisherName`（出版社）, `salesDate`（発売日）, `isbn`, `itemPrice`（税込価格）, `affiliateUrl`（アフィリエイトURL）, ジャンル情報, 在庫(`availability`) など。
- **絞り込みパラメータ**: `title` / 楽天ブックスジャンルID / `isbn` のいずれか必須。`hits`（1〜30, 既定30）, `page`（ページング）, `sort`, `availability`（0〜6）, `outOfStockFlag` など。
- **アフィリエイト**: アプリ登録時にアフィリエイトIDを含めれば、`affiliateUrl` がそのままアフィリエイトリンクになる。**楽天アフィリエイトは登録すれば初日から収益化可能** → ここが収益の起点。
- **レート制限（重要）**: 1つの applicationId につき **1秒に1回**以下。超え続けるとアプリIDが利用停止になり得る。大規模アフィリエイト用途は緩和申請が可能。
  - → バッチ設計で「1リクエストごとに1秒以上あける」ことを必須にする（[03](03_architecture.md)）。
- 出典:
  - [楽天ブックス系API解説（mynavi）](https://news.mynavi.jp/techplus/article/excelvbaweb-12/)
  - [BooksTotal/Search 非公式ドキュメント](https://rakuten-api-documentation.antoniotajuelo.com/ja/rakuten-books/bookstotal-search)
  - [楽天ブックスジャンル検索API（公式）](https://webservice.rakuten.co.jp/documentation/books-genre-search)
  - [レート制限FAQ（公式）](https://webservice.faq.rakuten.net/hc/en-us/articles/900001974383-What-is-the-request-limit-for-each-API)

### ② openBD（書誌情報・書影の補完）✅

- **役割**: 楽天で拾ったISBNをキーに、**書影・内容紹介・書誌情報**を肉付けする。
- **無料・商用OK**: 本を紹介する目的なら個人・法人問わず無料。書店の販促やサービス開発にも使える。
- **近刊情報を含む**: 発売前の本も取れる → 近刊カレンダーに使える。
- **注意（規約）**: 近刊を含むため、書影や内容は後から変更・削除され得る。**キャッシュする場合は変更をできるだけ早く反映**すること。
- 出典:
  - [openBD 公式](https://openbd.jp/) ／ [利用規約](https://openbd.jp/terms/)
  - [版元ドットコム 書誌・書影の利用承諾](https://www.hanmoto.com/permission-for-use/agreement)

### ③ Amazon（購入リンク。最初はISBNリンク、PA-APIは後）✅

- **最初はリンクを貼るだけ**で十分（PA-APIは不要）。
  - **ISBN-13（978始まり）→ ISBN-10 に変換** すれば `https://www.amazon.co.jp/dp/{ISBN10}` で商品ページに飛べる（書籍のAmazon商品ID＝ASINはISBN-10と一致するため）。
  - ⚠️ **979始まりのISBN-13にはISBN-10が無い** → この場合はdpリンクを機械生成できないので、PA-API検索や手動対応が必要（少数なので後回しでよい）。
- **PA-API（価格・在庫の自動取得）はさらに後**。売上実績が前提（→ [04](04_monetization_marketing.md) のアソシエイト審査）。
- 出典:
  - [PA-API 5: 外部ID（ISBN等）での検索](https://webservices.amazon.com/paapi5/documentation/use-cases/search-with-external-identifiers.html)

---

## 2. データモデル（Supabase / `books` テーブル案）

> ※これは叩き台です。確定はジャンル定義（[05](05_open_questions.md) Q6）と購入先（Q3）が決まってから。

| カラム | 型 | 説明 |
|---|---|---|
| `isbn13` | text（主キー） | 正規化キー。ISBN-13 |
| `isbn10` | text | Amazon dpリンク生成用（978始まりのみ）|
| `title` | text | 書名 |
| `title_kana` | text | 読みがな（あれば。並べ替え用）|
| `author` | text | 著者 |
| `publisher` | text | 出版社 |
| `sales_date` | date | 発売日（カレンダーの軸）|
| `price` | integer | 税込価格 |
| `genre_id` | text | 楽天ジャンルID |
| `category` | text | 文芸内の分類（小説/エッセイ/ノンフィクション 等）|
| `cover_url` | text | 書影URL（openBD優先、無ければ楽天）|
| `description` | text | 内容紹介（openBD。**転載でなく要約＋出典明記**）|
| `rakuten_url` | text | 楽天アフィリエイトURL |
| `amazon_url` | text | `dp/{isbn10}`（後でアフィリ化）|
| `availability` | text | 在庫状態 |
| `is_featured` | boolean | 注目作ピックか |
| `editor_note` | text | ピック時の編集コメント |
| `source` | text | 取得元の記録 |
| `created_at` / `updated_at` / `last_synced_at` | timestamptz | 作成・更新・最終同期日時 |

- **インデックス**（検索を速くする索引）を `sales_date` / `genre_id` / `author` / `publisher` に張る。
- 派生ページ（著者別・出版社別・月別など）は `books` テーブルから動的に組み立てる（プログラマティックSEOの土台）。

## 3. 規約・法務チェックリスト（公開前に必ず確認）

- [ ] **楽天API**: 1秒1リクエストを守る。アフィリエイトIDの規約を確認。
- [ ] **openBD**: キャッシュは変更を早く反映。書影は「本の紹介目的」の範囲で使う。
- [ ] **あらすじ・内容紹介**: そのまま転載しない。**要約・オリジナル文に書き換え、出典を明記**。
- [ ] **書影のSNS利用**: 販促・紹介目的の範囲かを確認（→ [04](04_monetization_marketing.md)）。
- [ ] **Amazon/楽天アフィリンクのチャネル制限**: メールや一部SNSでのリンク利用に制限があるため、配信前に各規約を確認。

## 4. 裏取りの状態

- ✅ 楽天APIが `salesDate`/`affiliateUrl`/`isbn` を返すこと、1秒1リクエスト制限 → 検索で確認済み。
- ✅ openBD 無料・商用OK・近刊含む・キャッシュ反映義務 → 公式規約で確認済み。
- ✅ Amazonアソシエイト「180日で3件の適格販売→本審査」 → 検索で確認済み（→ [04](04_monetization_marketing.md)）。
- 🔲 楽天のどのジャンルIDを「文芸」に含めるか → 実装前にジャンル検索APIで一覧を取得して確定する。

## 5. 網羅性の限界と補完（重要・2026-06-03追記）

**「楽天APIで全書籍を完全網羅」ではない。** 楽天ブックスAPIは「楽天ブックスが取り扱う本のカタログ」。以下は抜ける:
- 取次を通さない自費出版・同人・極小出版社の本
- 楽天が取扱なし/品切れの一部
- 登録タイミングのズレ（発売日と前後することがある）
- 電子書籍(Kindle)は別カタログ（楽天Koboも別API）

ただし**狙う読者（30〜40代女性向けの文芸＝大手出版社の小説・エッセイ・ノンフィクション）が読む本は、ほぼ 取次→楽天ブックス に載る**ため、MVPは楽天主軸で実用上十分。「全自費出版まで完璧に網羅」は不要。

より網羅的な新刊データの本命（将来の補完候補）:
- **JPRO（出版情報登録センター）**: 925社参加・月約4,000件の新刊/近刊を登録。出版業界の新刊情報の中核。個人向けの手軽なAPIではない。
- **openBD**: 版元ドットコム＋JPRO＋国会図書館サーチを集約した書誌。ただし**ISBN指定の照会型**で「日付で新刊を発見する検索」はできない → 書影・内容紹介の補完に使う。
- **国立国会図書館サーチAPI**: 無料・日付検索可・納本制度で網羅性が高い（JPRO連携で近刊も）。ただし新刊登録に遅れがあり、リアルタイム性は楽天が上。

**役割分担（推奨）**:
- 楽天API … 新刊の発見＋買えるリンク＋価格・在庫（収益の起点）
- openBD … 書影・内容紹介の補完
- （必要なら）国会図書館サーチ … 楽天に無い本を拾って網羅性アップ
- すべて **ISBNでマージ**。「楽天にある本＝買えるリンク付き」「楽天に無いが出る本＝書誌のみ掲載（リンクはAmazon ISBNリンク等）」の二段構え。

**API実務メモ**: 楽天は1回30件＋ページングで取得。1クエリの取得総数に上限（ページング上限）があるため、**「発売日ウィンドウ × ジャンル」で分割取得**して取りこぼしを防ぐ。

出典: [JPRO/openBD・国会図書館サーチ連携](https://current.ndl.go.jp/car/173758) ／ [openBDプロジェクト](https://internet.watch.impress.co.jp/docs/news/1040445.html)
