export const revalidate = 600;

import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { GENRES } from "@/types/book";
import { getSiteStats } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "サイトの稼働状況｜新刊日和",
  description: "新刊日和の掲載冊数・ページ数・公開コラム数・更新状況をリアルタイムに表示します。",
  alternates: { canonical: "/stats" },
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: "10px",
        boxShadow: "0 2px 12px rgba(61,53,48,0.06)",
        padding: "24px 22px",
      }}
    >
      <div className="text-sm font-bold" style={{ color: "var(--text-muted)", marginBottom: "8px" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: "40px", fontWeight: 600, color: "var(--text-main)", lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs font-bold" style={{ color: "var(--text-muted)", marginTop: "6px" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function formatJST(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export default async function StatsPage() {
  const stats = await getSiteStats();
  const maxGenre = Math.max(1, ...stats.byGenre.map((g) => g.count));

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="max-w-5xl mx-auto w-full px-4 py-14">
        <div className="mb-8">
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "34px",
              fontWeight: 500,
              letterSpacing: "0.12em",
              color: "var(--text-main)",
              margin: "0 0 8px",
            }}
          >
            サイトの稼働状況
          </h1>
          <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            毎日自動で更新される文芸書データベースの規模と稼働状況です。数値は表示時点のリアルタイム値。
          </p>
        </div>

        {/* 主要指標 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          <StatCard label="掲載冊数（累計）" value={stats.totalBooks.toLocaleString()} sub="文芸書の書誌データ" />
          <StatCard label="今月の新刊" value={stats.thisMonthBooks.toLocaleString()} sub="自動収集された当月発売分" />
          <StatCard label="生成ページ数（概算）" value={stats.pages.toLocaleString()} sub="書籍・コラム・ジャンル等" />
          <StatCard label="公開コラム" value={stats.publishedColumns.toLocaleString()} sub="AI執筆＋人の確認後に公開" />
        </div>

        {/* ジャンル別 */}
        <section className="mb-12">
          <h2
            style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: 500, letterSpacing: "0.08em", color: "var(--text-main)", margin: "0 0 16px" }}
          >
            ジャンル別の掲載冊数
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {stats.byGenre.map((g) => {
              const genre = GENRES.find((x) => x.id === g.id);
              const pct = Math.round((g.count / maxGenre) * 100);
              return (
                <div key={g.id} className="flex items-center gap-3">
                  <div className="text-xs font-bold" style={{ width: "110px", color: "var(--text-sub)", flexShrink: 0 }}>
                    {genre?.label ?? g.id}
                  </div>
                  <div style={{ flex: 1, background: "var(--bg-subtle)", borderRadius: "999px", height: "16px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: genre?.color ?? "var(--accent-sage)" }} />
                  </div>
                  <div className="text-xs font-bold" style={{ width: "56px", textAlign: "right", color: "var(--text-main)", flexShrink: 0 }}>
                    {g.count.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 稼働状況 */}
        <section
          style={{ background: "var(--bg-subtle)", borderRadius: "10px", padding: "20px 22px" }}
        >
          <h2 className="text-sm font-bold" style={{ color: "var(--text-sub)", margin: "0 0 8px" }}>
            自動更新の状況
          </h2>
          <p className="text-sm font-bold" style={{ color: "var(--text-main)", margin: 0 }}>
            最終データ更新：{formatJST(stats.lastSyncedAt)}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)", margin: "8px 0 0" }}>
            楽天ブックスAPI・openBDから毎朝自動で新刊を収集し、コラムも毎朝自動生成しています（人の作業は確認・公開のみ）。
          </p>
        </section>
      </main>
    </div>
  );
}
