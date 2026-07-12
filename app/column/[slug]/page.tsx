export const revalidate = 86400;

import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import ColumnHero from "@/components/ColumnHero";
import ShareButton from "@/components/ShareButton";
import MonthCalendarSection from "@/components/MonthCalendarSection";
import { getColumnBySlug, getSeoOverride } from "@/lib/supabase";
import { pickColumnImage } from "@/lib/column-images";
import { formatColumnBody } from "@/lib/format-column";
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
  // og:image は記事ごとのアイキャッチ（書影プール）を絶対URLで。hero未設定でも /hero.jpg 一律にしない
  const ogImage = column.hero_image_url ?? `${BASE_URL}${pickColumnImage(slug)}`;
  // 週次自律改善ループの上書き（検索結果の表示のみ。本文h1は元タイトルのまま）
  const ov = await getSeoOverride("column", slug);

  return {
    title: ov?.title ?? column.title,
    description: ov?.description ?? description,
    alternates: {
      canonical: `/column/${slug}`,
    },
    openGraph: {
      title: `${column.title}｜新刊日和`,
      description,
      type: "article",
      url: `${BASE_URL}/column/${slug}`,
      images: [ogImage],
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
  const image = column.hero_image_url ?? `${BASE_URL}${pickColumnImage(slug)}`;

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
      name: "新刊日和編集部",
      url: `${BASE_URL}/about`,
    },
    publisher: {
      "@type": "Organization",
      name: "新刊日和",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/icon.png`,
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
        <div style={{ borderRadius: "8px", overflow: "hidden", marginBottom: "28px" }}>
          <ColumnHero slug={column.slug} genreId={column.genre_id} heroImageUrl={column.hero_image_url} variant="detail" />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "34px",
            fontWeight: 500,
            letterSpacing: "0.04em",
            lineHeight: 1.5,
            color: "var(--text-main)",
            margin: "0 0 12px",
          }}
        >
          {column.title}
        </h1>

        {/* 著者バイライン＋日付（可視の著者表記もE-E-A-Tの信頼性シグナルになる） */}
        <p
          className="text-sm font-bold"
          style={{ color: "var(--text-muted)", margin: "0 0 36px" }}
        >
          文：
          <a href="/about" style={{ color: "var(--text-muted)", textDecoration: "underline" }}>
            新刊日和編集部
          </a>
          {dateJP && <>　|　{dateJP}</>}
        </p>

        {/* body_html は自社のAIが生成し人間がレビュー済みの信頼できる内部コンテンツ */}
        <div
          className="column-body"
          dangerouslySetInnerHTML={{ __html: formatColumnBody(column.body_html) }}
        />

        <div style={{ marginTop: "40px", paddingTop: "28px", borderTop: "1px solid var(--border)" }}>
          <ShareButton url={articleUrl} title={column.title} />
        </div>
      </article>

      {/* 発売日カレンダー（戻らず別の日へ行けるよう常設） */}
      <MonthCalendarSection />
    </div>
  );
}
