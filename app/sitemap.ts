import type { MetadataRoute } from "next";
import { GENRES } from "@/types/book";
import {
  getBookCountByDate,
  getPublishedColumns,
  getAllSeriesForSitemap,
} from "@/lib/supabase";

const BASE_URL = "https://shinkanbiyori.com";

function todayJST(): string {
  // en-CAロケールは "YYYY-MM-DD" 形式を返す。timeZone指定で日本の暦日を正しく取得する
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function addDays(isoDate: string, n: number): string {
  // "YYYY-MM-DD" を UTC基準の Date にして n日進め、再び "YYYY-MM-DD" に戻す
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = todayJST();

  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: today,
      changeFrequency: "daily",
      priority: 1,
    },
    ...GENRES.map((g) => ({
      url: `${BASE_URL}/genre/${g.id}`,
      lastModified: today,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    {
      url: `${BASE_URL}/about`,
      lastModified: today,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // 直近30日のうち、実際に新刊がある日付ページだけを追加する。
  // DB障害でサイトマップ全体が壊れないよう try/catch で握りつぶす
  try {
    const start = addDays(today, -30);
    const counts = await getBookCountByDate(start, today);
    for (const [date, count] of Object.entries(counts)) {
      if (count > 0) {
        entries.push({
          url: `${BASE_URL}/date/${date}`,
          lastModified: today,
          changeFrequency: "daily",
          priority: 0.6,
        });
      }
    }
  } catch {
    // 日付ページはスキップし、ホーム＋ジャンルだけ返す
  }

  // 書籍詳細ページと著者ページは件数が多く（書籍28,900・作家24,366）、
  // ここに入れるとサイトマップ1ファイルの上限50,000URLを超える。
  // それぞれ app/books/sitemap.ts（/books/sitemap.xml）と
  // app/authors/sitemap.ts（/authors/sitemap.xml）に分離した。robots.txt で3本とも通知している。

  // シリーズページ
  try {
    const series = await getAllSeriesForSitemap();
    for (const s of series) {
      entries.push({
        url: `${BASE_URL}/series/${s.slug}`,
        lastModified: today,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  } catch {
    // シリーズページはスキップ
  }

  // 月別カレンダーページ（前後3ヶ月＋当月、ジャンル別含む）
  for (let i = -1; i <= 2; i++) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i);
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    entries.push({
      url: `${BASE_URL}/calendar/${ym}`,
      lastModified: today,
      changeFrequency: "daily",
      priority: 0.7,
    });
    for (const g of GENRES) {
      entries.push({
        url: `${BASE_URL}/calendar/${ym}/${g.id}`,
        lastModified: today,
        changeFrequency: "daily",
        priority: 0.5,
      });
    }
  }

  // コラム一覧ページ
  entries.push({
    url: `${BASE_URL}/column`,
    lastModified: today,
    changeFrequency: "weekly",
    priority: 0.7,
  });

  // 公開済みコラム各記事。getPublishedColumns はエラー時 [] を返すのでサイトマップは壊れない
  const columns = await getPublishedColumns();
  for (const col of columns) {
    entries.push({
      url: `${BASE_URL}/column/${col.slug}`,
      // 実際の更新日を出す（全コラムを"今日更新"扱いにすると新規ドメインで逆効果）
      lastModified: (col.updated_at || col.published_at || today).slice(0, 10),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return entries;
}
