export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import ColumnHero from "@/components/ColumnHero";
import { getColumnBySlug } from "@/lib/supabase";
import { notFound } from "next/navigation";

const BASE_URL = "https://shinkanbiyori.com";

// 公開日時を「2026年6月8日」形式に整形する（nullガードあり）
function formatPublishedJP(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  return new Date(publishedAt).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const column = await getColumnBySlug(slug);

  if (!column) {
    return { title: "ページが見つかりません", robots: { index: false, follow: false } };
  }

  const description = column.excerpt ?? column.title;

  return {
    title: column.title,
    description,
    alternates: {
      canonical: `/column/${slug}`,
    },
    openGraph: {
      title: `${column.title}｜新刊日和`,
      description,
      type: "article",
      url: `${BASE_URL}/column/${slug}`,
      images: [column.hero_image_url ?? "/hero.jpg"],
    },
  };
}

export default async function ColumnDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const column = await getColumnBySlug(slug);

  if (!column) {
    notFound();
  }

  const articleUrl = `${BASE_URL}/column/${slug}`;
  const dateJP = formatPublishedJP(column.published_at);
  const image = column.hero_image_url ?? `${BASE_URL}/hero.jpg`;

  // 記事本体の構造化データ（BlogPosting）。文芸書キュレーションの読み物コラム向け
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: column.title,
    description: column.excerpt ?? column.title,
    image,
    datePublished: column.published_at ?? undefined,
    dateModified: column.updated_at,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    author: {
      "@type": "Organization",
      name: "新刊日和",
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "新刊日和",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/hero.jpg`,
      },
    },
  };

  // パンくずの構造化データ：ホーム > コラム > 記事
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "ホーム",
        item: BASE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "コラム",
        item: `${BASE_URL}/column`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: column.title,
        item: articleUrl,
      },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <SiteHeader />

      <article className="max-w-3xl mx-auto w-full px-4 py-14">
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "34px",
            fontWeight: 500,
            letterSpacing: "0.04em",
            lineHeight: 1.4,
            color: "var(--text-main)",
            margin: "0 0 12px",
          }}
        >
          {column.title}
        </h1>

        {dateJP && (
          <p
            className="text-sm font-bold"
            style={{ color: "var(--text-muted)", margin: "0 0 28px" }}
          >
            {dateJP}
          </p>
        )}

        <div style={{ borderRadius: "9px", overflow: "hidden", margin: "0 0 32px" }}>
          <ColumnHero title={column.title} genreId={column.genre_id} variant="detail" />
        </div>

        {/* body_html は自社のAIが生成し人間がレビュー済みの信頼できる内部コンテンツ */}
        <div
          className="column-body"
          dangerouslySetInnerHTML={{ __html: column.body_html }}
        />
      </article>
    </div>
  );
}
