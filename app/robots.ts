import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 下書きプレビュー・稼働状況ダッシュボードは非公開。クロール・インデックスさせない
      disallow: ["/column/preview", "/stats"],
    },
    // 書籍・作家は件数が多くサイトマップを分けている。3本とも通知する
    sitemap: [
      "https://shinkanbiyori.com/sitemap.xml",
      "https://shinkanbiyori.com/books/sitemap.xml",
      "https://shinkanbiyori.com/authors/sitemap.xml",
    ],
    host: "https://shinkanbiyori.com",
  };
}
