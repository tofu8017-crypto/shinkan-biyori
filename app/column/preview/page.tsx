export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import ColumnHero from "@/components/ColumnHero";
import { getDraftColumns } from "@/lib/supabase";

// プレビュー（下書き確認）用の非公開ページ。検索エンジンには出さない。
export const metadata: Metadata = {
  title: "コラム下書きプレビュー",
  robots: { index: false, follow: false },
};

function formatUpdatedJP(s: string | null): string | null {
  if (!s) return null;
  return new Date(s).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export default async function ColumnPreviewListPage() {
  const drafts = await getDraftColumns();

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="max-w-5xl mx-auto w-full px-4 py-14">
        <div className="mb-8">
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "30px",
              fontWeight: 500,
              letterSpacing: "0.1em",
              color: "var(--text-main)",
              margin: "0 0 8px",
            }}
          >
            コラム下書きプレビュー
          </h1>
          <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            未公開の下書き一覧です（このページは検索エンジンに表示されません）。
            内容を確認し、公開してよいものを選んでください。
          </p>
        </div>

        {drafts.length === 0 ? (
          <p className="py-8 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            現在、下書きはありません。
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "22px",
            }}
          >
            {drafts.map((col) => (
              <Link
                key={col.id}
                href={`/column/preview/${col.slug}`}
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
                <ColumnHero genreId={col.genre_id} variant="list" />
                <div style={{ padding: "16px 18px 18px" }}>
                  <span
                    className="inline-block text-xs font-bold mb-2"
                    style={{
                      borderRadius: "999px",
                      background: "var(--highlight)",
                      color: "#fff",
                      padding: "2px 10px",
                    }}
                  >
                    {col.status}
                  </span>
                  <h2
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "17px",
                      fontWeight: 500,
                      lineHeight: 1.5,
                      color: "var(--text-main)",
                      margin: "0 0 6px",
                    }}
                  >
                    {col.title}
                  </h2>
                  {col.target_keyword && (
                    <p className="text-xs font-bold" style={{ color: "var(--text-muted)", margin: "0 0 4px" }}>
                      狙うKW: {col.target_keyword}
                    </p>
                  )}
                  <p className="text-xs" style={{ color: "var(--text-muted)", margin: 0 }}>
                    更新: {formatUpdatedJP(col.updated_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
