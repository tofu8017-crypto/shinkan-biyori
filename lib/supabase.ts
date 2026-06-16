import type { Book } from "@/types/book";
import type { Column } from "@/types/column";
import { MOCK_BOOKS } from "./mock-data";
import { isSameAuthor, splitAuthors } from "./normalize-author";
import { groupBySeries, seriesSlug } from "./detect-series";
import { isLikelyLightNovel } from "./is-light-novel";

// ラノベが紛れ込みやすい「小説系」ジャンル。これらの表示からはラノベを除外し、
// ラノベ専用タブ(001017)へ寄せる。
const RANOBE_ID = "001017";
const NOVEL_GENRE_IDS = ["001004008", "001004009", "001004001", "001004002", "001019"];

function isValidSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") && url !== "https://xxxxxx.supabase.co";
  } catch {
    return false;
  }
}

const useMock = !isValidSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

// トップ（今日の新刊・直近7日間・日付ページ）から除外するジャンル＝ビジネス・実用書。
// 看板が「文芸書の新刊カレンダー」なので、実用書は専用タブ(/genre/001006)からのみ閲覧可とする。
const HOME_EXCLUDED_GENRE = "001006";

// ジャンルページで「直近の新刊」とみなす日数（今日からこの日数前まで）
const GENRE_RECENT_DAYS = 14;

function jstToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
function addDaysUTC(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function getClient() {
  if (useMock) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// サーバー側専用クライアント。RLSをバイパスして下書き(draft)も読める。
// SUPABASE_SERVICE_ROLE_KEY が無い環境では null を返す（プレビューは空になる）。
// このキーは NEXT_PUBLIC_ を付けないため、ブラウザには絶対に出ない。
async function getServiceClient() {
  if (useMock) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export async function getLatestBooks(
  onOrBefore: string,
  limit: number
): Promise<Book[]> {
  if (useMock) {
    return MOCK_BOOKS.filter(
      (b) => b.published_date <= onOrBefore && b.genre_id !== HOME_EXCLUDED_GENRE
    )
      .sort(
        (a, b) =>
          b.published_date.localeCompare(a.published_date) ||
          a.title.localeCompare(b.title, "ja")
      )
      .slice(0, limit);
  }

  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .lte("published_date", onOrBefore)
    .not("title", "ilike", "%写真集%")
    .not("title", "ilike", "%グラビア%")
    .not("title", "ilike", "%アイドル%")
    .neq("genre_id", HOME_EXCLUDED_GENRE)
    .order("published_date", { ascending: false })
    .order("title")
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// 検索語から空白・ワイルドカード記号を取り除き、各文字の間に % を挟んだ
// ilikeパターンを作る。これで「東野圭吾」が「東野 圭吾」「東野　圭吾(全角空白)」
// のように姓名の間に空白が入った著者名にもヒットする（空白無視のあいまい検索）。
function buildSearchPattern(q: string): string | null {
  // ilikeの特殊文字(% _)とor()を壊す記号(, ( ))、各種空白を除去
  const chars = Array.from(q).filter(
    (c) => !/[\s,()%_*]/.test(c)
  );
  if (chars.length === 0) return null;
  return `%${chars.join("%")}%`;
}

export async function searchBooks(
  query: string,
  limit = 200
): Promise<Book[]> {
  const q = query.trim();
  if (!q) return [];

  if (useMock) {
    // モックでも空白を無視して比較する
    const strip = (s: string) => s.replace(/[\s　]/g, "").toLowerCase();
    const needle = strip(q);
    return MOCK_BOOKS.filter(
      (b) =>
        strip(b.title).includes(needle) ||
        strip(b.author ?? "").includes(needle)
    )
      .sort((a, b) => b.published_date.localeCompare(a.published_date))
      .slice(0, limit);
  }

  const pattern = buildSearchPattern(q);
  if (!pattern) return [];

  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .or(`title.ilike.${pattern},author.ilike.${pattern}`)
    .not("title", "ilike", "%写真集%")
    .not("title", "ilike", "%グラビア%")
    .not("title", "ilike", "%アイドル%")
    .order("published_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBooksByDate(date: string): Promise<Book[]> {
  if (useMock) {
    return MOCK_BOOKS.filter(
      (b) => b.published_date === date && b.genre_id !== HOME_EXCLUDED_GENRE
    ).sort((a, b) =>
      a.title.localeCompare(b.title, "ja")
    );
  }

  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .eq("published_date", date)
    .not("title", "ilike", "%写真集%")
    .not("title", "ilike", "%グラビア%")
    .not("title", "ilike", "%アイドル%")
    .neq("genre_id", HOME_EXCLUDED_GENRE)
    .order("title");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBooksByGenre(genreId: string): Promise<Book[]> {
  // ジャンルページは「直近に出た新刊」だけを表示する（背景の古い本は出さない）
  const today = jstToday();
  const since = addDaysUTC(today, -GENRE_RECENT_DAYS);

  if (useMock) {
    let rows = MOCK_BOOKS.filter(
      (b) => b.published_date >= since && b.published_date <= today
    );
    if (genreId === RANOBE_ID) {
      rows = rows.filter((b) => b.genre_id === RANOBE_ID || isLikelyLightNovel(b));
    } else {
      rows = rows.filter((b) => b.genre_id === genreId);
      if (NOVEL_GENRE_IDS.includes(genreId)) rows = rows.filter((b) => !isLikelyLightNovel(b));
    }
    return rows.sort((a, b) => b.published_date.localeCompare(a.published_date));
  }

  const sb = await getClient();

  // ラノベタブ: 小説系ジャンルの直近 + genre_id=001017 を集め、ラノベ判定で絞る
  if (genreId === RANOBE_ID) {
    const { data, error } = await sb!
      .from("books")
      .select("*")
      .in("genre_id", [...NOVEL_GENRE_IDS, RANOBE_ID])
      .gte("published_date", since)
      .lte("published_date", today)
      .not("title", "ilike", "%写真集%")
      .not("title", "ilike", "%グラビア%")
      .not("title", "ilike", "%アイドル%")
      .order("published_date", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .filter((b) => b.genre_id === RANOBE_ID || isLikelyLightNovel(b))
      .slice(0, 120);
  }

  const { data, error } = await sb!
    .from("books")
    .select("*")
    .eq("genre_id", genreId)
    .gte("published_date", since)
    .lte("published_date", today)
    .not("title", "ilike", "%写真集%")
    .not("title", "ilike", "%グラビア%")
    .not("title", "ilike", "%アイドル%")
    .order("published_date", { ascending: false })
    .limit(120);

  if (error) throw new Error(error.message);
  let rows = data ?? [];
  // 小説系ジャンルからはラノベを除外（ラノベ専用タブへ寄せる）
  if (NOVEL_GENRE_IDS.includes(genreId)) {
    rows = rows.filter((b) => !isLikelyLightNovel(b));
  }
  return rows;
}

export async function getBooksByDateRange(
  from: string,
  to: string
): Promise<Book[]> {
  if (useMock) {
    return MOCK_BOOKS.filter(
      (b) =>
        b.published_date >= from &&
        b.published_date <= to &&
        b.genre_id !== HOME_EXCLUDED_GENRE
    ).sort((a, b) => a.published_date.localeCompare(b.published_date));
  }

  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .gte("published_date", from)
    .lte("published_date", to)
    .not("title", "ilike", "%写真集%")
    .not("title", "ilike", "%グラビア%")
    .not("title", "ilike", "%アイドル%")
    .neq("genre_id", HOME_EXCLUDED_GENRE)
    .order("published_date");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBookCountByDate(
  from: string,
  to: string
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  if (useMock) {
    const books = await getBooksByDateRange(from, to);
    for (const b of books) {
      counts[b.published_date] = (counts[b.published_date] ?? 0) + 1;
    }
    return counts;
  }

  // Supabaseは1リクエスト最大1000行。月の冊数は1000を超えるため、published_dateだけを
  // 1000件ずつページングして全件集計する（.select("*")だと前半1000件で打ち切られ、
  // 月後半が0件に見える不具合になる）。フィルタは getBooksByDateRange と揃える。
  const sb = await getClient();
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb!
      .from("books")
      .select("published_date")
      .gte("published_date", from)
      .lte("published_date", to)
      .not("title", "ilike", "%写真集%")
      .not("title", "ilike", "%グラビア%")
      .not("title", "ilike", "%アイドル%")
      .neq("genre_id", HOME_EXCLUDED_GENRE)
      .order("published_date")
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const b of rows) {
      counts[b.published_date] = (counts[b.published_date] ?? 0) + 1;
    }
    if (rows.length < PAGE) break;
  }
  return counts;
}

// ISBN13で書籍を1冊取得する。見つからなければ null。書籍詳細ページ用。
export async function getBookByIsbn(isbn13: string): Promise<Book | null> {
  if (useMock) {
    return MOCK_BOOKS.find((b) => b.isbn13 === isbn13) ?? null;
  }

  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .eq("isbn13", isbn13)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

// 指定書籍と同じ著者の他の新刊（自身は除く）を発売日降順で取得する。内部リンク用。
export async function getBooksBySameAuthor(
  book: Book,
  limit = 8
): Promise<Book[]> {
  const authors = splitAuthors(book.author);
  if (authors.length === 0) return [];

  if (useMock) {
    return MOCK_BOOKS.filter(
      (b) =>
        b.isbn13 !== book.isbn13 &&
        authors.some((a) => isSameAuthor(a, b.author))
    )
      .sort((a, b) => b.published_date.localeCompare(a.published_date))
      .slice(0, limit);
  }

  const sb = await getClient();
  // 著者名は文字列カラムのため、代表著者名であいまい一致（部分一致）を取る。
  // 連名の最初の著者をキーにする（完全な正規化はバッチ側の責務）。
  const pattern = `%${authors[0].replace(/\s/g, "%")}%`;
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .ilike("author", pattern)
    .neq("isbn13", book.isbn13)
    .order("published_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// 指定著者名（正規化済み）の新刊を発売日降順で取得する。著者ページ用。
export async function getBooksByAuthor(
  authorName: string,
  limit = 100
): Promise<Book[]> {
  if (useMock) {
    return MOCK_BOOKS.filter((b) =>
      splitAuthors(b.author).some((a) => isSameAuthor(a, authorName))
    ).sort((a, b) => b.published_date.localeCompare(a.published_date));
  }

  const sb = await getClient();
  const pattern = `%${authorName.replace(/\s/g, "%")}%`;
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .ilike("author", pattern)
    .order("published_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  // 部分一致のノイズ（別人の同字含み）を正規化判定で絞り込む
  return (data ?? []).filter((b) =>
    splitAuthors(b.author).some((a) => isSameAuthor(a, authorName))
  );
}

// 同日発売の他の本（自身を除く）。内部リンク用。
export async function getBooksSameDay(book: Book, limit = 8): Promise<Book[]> {
  const books = await getBooksByDate(book.published_date);
  return books.filter((b) => b.isbn13 !== book.isbn13).slice(0, limit);
}

// sitemap / generateStaticParams 用に全書籍の最小情報を取得する。
export async function getAllBooksForSitemap(): Promise<
  Pick<Book, "isbn13" | "author" | "last_synced_at">[]
> {
  if (useMock) {
    return MOCK_BOOKS.map((b) => ({
      isbn13: b.isbn13,
      author: b.author,
      last_synced_at: b.last_synced_at,
    }));
  }

  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("isbn13, author, last_synced_at")
    .order("published_date", { ascending: false })
    .limit(50000);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// 文芸ジャンルの新刊を広めに取得する内部ヘルパー。
// シリーズ判定・月別カレンダーで母集団として使う。ビジネス・実用書は除外。
async function getBooksForGrouping(limit = 5000): Promise<Book[]> {
  if (useMock) {
    return MOCK_BOOKS.filter((b) => b.genre_id !== HOME_EXCLUDED_GENRE);
  }
  const sb = await getClient();
  const { data, error } = await sb!
    .from("books")
    .select("*")
    .neq("genre_id", HOME_EXCLUDED_GENRE)
    .order("published_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// slug指定でシリーズの巻一覧（巻数昇順）を取得する。見つからなければ空配列。
export async function getSeriesBySlug(slug: string): Promise<{
  base: string;
  books: Book[];
} | null> {
  const all = await getBooksForGrouping();
  const groups = groupBySeries(all);
  for (const [base, books] of groups) {
    if (seriesSlug(base) === slug) return { base, books };
  }
  return null;
}

// sitemap用に全シリーズの slug と base を返す。
export async function getAllSeriesForSitemap(): Promise<
  { slug: string; base: string }[]
> {
  const all = await getBooksForGrouping();
  const groups = groupBySeries(all);
  return [...groups.keys()].map((base) => ({ slug: seriesSlug(base), base }));
}

// 指定年月（"YYYY-MM"）の新刊を取得する。月別カレンダーページ用。
// genreId を渡すとそのジャンルに絞り込む。
export async function getBooksByMonth(
  yyyymm: string,
  genreId?: string
): Promise<Book[]> {
  const from = `${yyyymm}-01`;
  const [y, m] = yyyymm.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${yyyymm}-${String(lastDay).padStart(2, "0")}`;

  if (useMock) {
    return MOCK_BOOKS.filter(
      (b) =>
        b.published_date >= from &&
        b.published_date <= to &&
        b.genre_id !== HOME_EXCLUDED_GENRE &&
        (!genreId || b.genre_id === genreId)
    ).sort((a, b) => a.published_date.localeCompare(b.published_date));
  }

  const sb = await getClient();
  let q = sb!
    .from("books")
    .select("*")
    .gte("published_date", from)
    .lte("published_date", to)
    .neq("genre_id", HOME_EXCLUDED_GENRE)
    .not("title", "ilike", "%写真集%")
    .not("title", "ilike", "%グラビア%")
    .not("title", "ilike", "%アイドル%");
  if (genreId) q = q.eq("genre_id", genreId);
  const { data, error } = await q.order("published_date").limit(2000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// 公開済みコラムを新しい順に取得する。
// "columns" テーブルはまだ存在しない可能性があるため、try/catchで握りつぶし、
// エラー時は空配列を返してページがクラッシュしないようにする
export async function getPublishedColumns(limit = 50): Promise<Column[]> {
  if (useMock) return [];

  try {
    const sb = await getClient();
    const { data, error } = await sb!
      .from("columns")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data ?? [];
  } catch {
    return [];
  }
}

// slug指定で公開済みコラムを1件取得する。見つからない・エラー時はnullを返す
export async function getColumnBySlug(slug: string): Promise<Column | null> {
  if (useMock) return null;

  try {
    const sb = await getClient();
    const { data, error } = await sb!
      .from("columns")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ?? null;
  } catch {
    return null;
  }
}

// 下書きを含む全ステータスのコラムを新しい順に取得する（プレビュー用・非公開導線）。
// 下書きはRLSで匿名キーから読めないため、サービスキー(getServiceClient)で取得する。
export async function getDraftColumns(limit = 100): Promise<Column[]> {
  if (useMock) return [];
  try {
    const sb = await getServiceClient();
    if (!sb) return [];
    const { data, error } = await sb
      .from("columns")
      .select("*")
      .neq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch {
    return [];
  }
}

// slug指定でステータスを問わずコラムを1件取得する（プレビュー用）。
// 下書きも読めるようサービスキーを使う。無い場合は公開分のみのクライアントにフォールバック。
export async function getColumnBySlugAnyStatus(slug: string): Promise<Column | null> {
  if (useMock) return null;
  try {
    const sb = (await getServiceClient()) ?? (await getClient());
    if (!sb) return null;
    const { data, error } = await sb
      .from("columns")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  } catch {
    return null;
  }
}

// ===== /stats ダッシュボード用の集計 =====
export type SiteStats = {
  totalBooks: number;
  thisMonthBooks: number;
  publishedColumns: number;
  byGenre: { id: string; count: number }[];
  pages: number;          // 生成ページ数の概算（書籍+コラム+ジャンル+カレンダー等）
  lastSyncedAt: string | null;
};

export async function getSiteStats(): Promise<SiteStats> {
  const GENRE_IDS = [
    "001004008", "001004009", "001004001",
    "001004002", "001004003", "001019", "001006",
  ];
  const today = jstToday();
  const ym = today.slice(0, 7);
  const monthFrom = `${ym}-01`;
  const [y, m] = ym.split("-").map(Number);
  const monthTo = `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;

  if (useMock) {
    const byGenre = GENRE_IDS.map((id) => ({
      id,
      count: MOCK_BOOKS.filter((b) => b.genre_id === id).length,
    }));
    return {
      totalBooks: MOCK_BOOKS.length,
      thisMonthBooks: MOCK_BOOKS.filter((b) => b.published_date >= monthFrom && b.published_date <= monthTo).length,
      publishedColumns: 0,
      byGenre,
      pages: MOCK_BOOKS.length + GENRE_IDS.length,
      lastSyncedAt: null,
    };
  }

  const sb = await getClient();

  const totalBooksRes = await sb!.from("books").select("*", { count: "exact", head: true });
  const totalBooks = totalBooksRes.count ?? 0;

  const monthRes = await sb!
    .from("books")
    .select("*", { count: "exact", head: true })
    .gte("published_date", monthFrom)
    .lte("published_date", monthTo);
  const thisMonthBooks = monthRes.count ?? 0;

  const byGenre: { id: string; count: number }[] = [];
  for (const id of GENRE_IDS) {
    const r = await sb!.from("books").select("*", { count: "exact", head: true }).eq("genre_id", id);
    byGenre.push({ id, count: r.count ?? 0 });
  }

  let publishedColumns = 0;
  try {
    const c = await sb!.from("columns").select("*", { count: "exact", head: true }).eq("status", "published");
    publishedColumns = c.count ?? 0;
  } catch {
    publishedColumns = 0;
  }

  // 最終更新（最新のlast_synced_at）
  let lastSyncedAt: string | null = null;
  try {
    const ls = await sb!.from("books").select("last_synced_at").order("last_synced_at", { ascending: false }).limit(1).maybeSingle();
    lastSyncedAt = ls.data?.last_synced_at ?? null;
  } catch {
    lastSyncedAt = null;
  }

  // 生成ページ概算: 書籍詳細 + コラム + ジャンル7 + 今月カレンダー1
  const pages = totalBooks + publishedColumns + GENRE_IDS.length + 1;

  return { totalBooks, thisMonthBooks, publishedColumns, byGenre, pages, lastSyncedAt };
}
