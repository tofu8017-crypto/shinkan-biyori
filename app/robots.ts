import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 下書きプレビュー・稼働状況ダッシュボードは非公開。クロール・インデックスさせない
      disallow: ["/column/preview", "/stats"],
    },
    sitemap: "https://shinkanbiyori.com/sitemap.xml",
    host: "https://shinkanbiyori.com",
  };
}
