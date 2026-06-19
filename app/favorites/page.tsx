import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import FavoritesGrid from "@/components/FavoritesGrid";
import MonthCalendarSection from "@/components/MonthCalendarSection";

// お気に入りは端末ローカル（localStorage）なので検索エンジンには登録させない
export const metadata: Metadata = {
  title: "お気に入り",
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="max-w-6xl mx-auto w-full px-4 pt-5 pb-14">
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "30px",
            fontWeight: 500,
            letterSpacing: "0.12em",
            color: "var(--text-main)",
            margin: "0 0 20px",
          }}
        >
          お気に入り
        </h1>
        <FavoritesGrid />
      </main>
      <MonthCalendarSection />
    </div>
  );
}
