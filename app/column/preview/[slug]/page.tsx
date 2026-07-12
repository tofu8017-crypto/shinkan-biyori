export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import ColumnHero from "@/components/ColumnHero";
import { getColumnBySlugAnyStatus } from "@/lib/supabase";
import { formatColumnBody } from "@/lib/format-column";
import { notFound } from "next/navigation";

// 下書きを含むコラムのプレビュー（非公開・noindex）。公開前の確認用。
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const column = await getColumnBySlugAnyStatus(slug);
  return {
    title: column ? `［プレビュー］${column.title}` : "ページが見つかりません",
    robots: { index: false, follow: false },
  };
}

export default async function ColumnPreviewDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const column = await getColumnBySlugAnyStatus(slug);
  if (!column) notFound();

  const isPublished = column.status === "published";

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <article className="max-w-3xl mx-auto w-full px-4 py-14">
        {/* プレビュー用の操作バー（公開状況と一覧へ戻る導線） */}
        <div
          className="flex items-center justify-between mb-6 px-4 py-3 rounded-lg"
          style={{ background: "var(--bg-subtle)" }}
        >
          <span className="text-sm font-bold" style={{ color: "var(--text-sub)" }}>
            プレビュー（status: {column.status}）
            {isPublished && "／このコラムは公開中です"}
          </span>
          <Link
            href="/column/preview"
            className="text-sm font-bold"
            style={{ color: "var(--highlight)", textDecoration: "none" }}
          >
            下書き一覧へ
          </Link>
        </div>

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

        {column.target_keyword && (
          <p className="text-sm font-bold" style={{ color: "var(--text-muted)", margin: "0 0 24px" }}>
            狙うキーワード: {column.target_keyword}
          </p>
        )}

        <div style={{ borderRadius: "9px", overflow: "hidden", margin: "0 0 32px" }}>
          <ColumnHero slug={column.slug} genreId={column.genre_id} heroImageUrl={column.hero_image_url} variant="detail" />
        </div>

        <div
          className="column-body"
          dangerouslySetInnerHTML={{ __html: formatColumnBody(column.body_html) }}
        />

        {/* 公開コマンドの案内（操作は人間が手動で行う） */}
        <div
          className="mt-12 px-4 py-4 rounded-lg text-sm"
          style={{ background: "var(--bg-subtle)", color: "var(--text-sub)" }}
        >
          <p className="font-bold" style={{ margin: "0 0 6px" }}>このコラムを公開するには</p>
          <p style={{ margin: 0 }}>
            問題なければ、公開コマンドを実行します（藤澤さんが「
            <code>{column.slug}</code> を公開して」と伝えるだけでOK）。
          </p>
        </div>
      </article>
    </div>
  );
}
