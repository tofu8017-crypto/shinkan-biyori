import type { MetadataRoute } from "next";
import { getAllBooksForSitemap } from "@/lib/supabase";

// 書籍詳細ページ専用のサイトマップ（/books/sitemap.xml）。
//
// もともとは app/sitemap.ts に同居していたが、Supabaseの1000行上限で1000冊しか
// 載っておらず、残り27,900冊はサイトマップ未掲載＝クロールが7週間に1回まで落ちていた。
// 全件だと 28,900 + 作家24,366 でサイトマップ1ファイルの上限50,000URLを超えるため、
// 書籍・作家・その他の3本に分けた。1本あたりは上限内に収まるので分割(generateSitemaps)は不要。
//
// このルートはビルド時に静的生成される（/sitemap.xml と同じ）。Cloudflare Free では
// リクエストごとにCPU制限があるため、実行時に生成させず静的ファイルとして配信させる。
// 反映は次回の `npm run cf:deploy` のタイミングになる。
const BASE_URL = "https://shinkanbiyori.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const books = await getAllBooksForSitemap();
    return books.map((b) => ({
      url: `${BASE_URL}/books/${b.isbn13}`,
      lastModified: b.last_synced_at?.slice(0, 10) || undefined,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
  } catch {
    // DB障害時に空を返す。ビルドを落とすより、既存のサイトマップを残すほうが安全
    return [];
  }
}
