import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 下書きプレビューは非公開。クロール・インデックスさせない
      disallow: "/column/preview",
    },
    sitemap: "https://shinkanbiyori.com/sitemap.xml",
    host: "https://shinkanbiyori.com",
  };
}
