export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import ColumnHero from "@/components/ColumnHero";
import { getPublishedColumns } from "@/lib/supabase";

const DESCRIPTION =
  "新刊や本にまつわる読み物コラム。気になるテーマからお気に入りの一冊を見つけてください。";

export const metadata: Metadata = {
  title: "コラム",
  description: DESCRIPTION,
  alternates: {
    canonical: "/column",
  },
  openGraph: {
    title: "コラム｜新刊日和",
    description: DESCRIPTION,
    url: "https://shinkanbiyori.com/column",
    images: ["/hero.jpg"],
  },
};

// 公開日時を「2026年6月8日」形式に整形する（nullガードあり）
function formatPublishedJP(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  return new Date(publishedAt).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });
}

export default async function ColumnListPage() {
  const columns = await getPublishedColumns();

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="max-w-6xl mx-auto w-full px-4 py-14">
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "34px",
            fontWeight: 500,
            letterSpacing: "0.14em",
            color: "var(--text-main)",
            margin: "0 0 28px",
          }}
        >
          コラム
        </h1>

        {columns.length === 0 ? (
          <p className="py-8 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            コラムは準備中です。
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "22px",
            }}
          >
            {columns.map((col) => {
              const dateJP = formatPublishedJP(col.published_at);
              return (
                <a
                  key={col.id}
                  href={"/column/" + col.slug}
                  style={{
                    display: "block",
                    background: "#fff",
                    borderRadius: "6px",
                    boxShadow: "0 1px 2px rgba(61,53,48,0.06)",
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                    textDecoration: "none",
                  }}
                >
                  <ColumnHero title={col.title} genreId={col.genre_id} variant="list" />
                  <div style={{ padding: "16px 18px 18px" }}>
                    <h2
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: "20px",
                        fontWeight: 500,
                        color: "var(--text-main)",
                        margin: "0 0 8px",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {col.title}
                    </h2>
                    {col.excerpt && (
                      <p
                        style={{
                          fontSize: "13px",
                          lineHeight: 1.7,
                          color: "var(--text-muted)",
                          margin: "0 0 10px",
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {col.excerpt}
                      </p>
                    )}
                    {dateJP && (
                      <p
                        className="text-xs font-bold"
                        style={{ color: "var(--text-muted)", margin: 0 }}
                      >
                        {dateJP}
                      </p>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
