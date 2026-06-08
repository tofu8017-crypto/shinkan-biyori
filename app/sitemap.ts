import type { MetadataRoute } from "next";
import { GENRES } from "@/types/book";
import { getBookCountByDate, getPublishedColumns } from "@/lib/supabase";

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
      lastModified: today,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return entries;
}
