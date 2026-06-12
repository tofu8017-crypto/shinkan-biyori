// 構造化データ（JSON-LD）を <script> として出力する共通コンポーネント。
// XSS対策として "<" をエスケープしてから埋め込む（Next.js標準のお作法）。

export default function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export const SITE_URL = "https://shinkanbiyori.com";

// パンくずリストのJSON-LDを組み立てる。
// items は [{ name, path }] の配列（path は "/books/xxx" のような絶対パス）。
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}
