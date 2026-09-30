import type { MetadataRoute } from "next";
import { getAllBooksForSitemap } from "@/lib/supabase";
import { splitAuthors, authorSlug } from "@/lib/normalize-author";

// 作家ページ専用のサイトマップ（/authors/sitemap.xml）。
// 作家URLは書籍の author 欄から作られるため、書籍一覧が1000冊で打ち切られていた影響を
// そのまま受けて1,508人分しか載っていなかった（実際は24,366人）。
// 詳しい経緯は app/books/sitemap.ts のコメントを参照。
//
// lastModified は付けない。作家ページの中身は担当書籍が増えたときだけ変わるが、
// その日付をここで正確に出せない。毎日「今日更新した」と嘘を申告するくらいなら
// 省くほうがよい（不正確な lastmod は無視される）。
const BASE_URL = "https://shinkanbiyori.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const books = await getAllBooksForSitemap();
    const slugs = new Set<string>();
    for (const b of books) {
      for (const a of splitAuthors(b.author)) slugs.add(authorSlug(a));
    }
    return [...slugs].map((slug) => ({
      url: `${BASE_URL}/authors/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
  } catch {
    return [];
  }
}
