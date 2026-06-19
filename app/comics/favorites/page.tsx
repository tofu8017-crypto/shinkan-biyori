import type { Metadata } from "next";
import ComicHeader from "@/components/ComicHeader";
import FavoritesGrid from "@/components/FavoritesGrid";
import ComicCalendarSection from "@/components/ComicCalendarSection";

export const metadata: Metadata = {
  title: "お気に入り（コミック）",
  robots: { index: false, follow: true },
};

export default function ComicFavoritesPage() {
  return (
    <div className="comic-theme min-h-screen flex flex-col">
      <ComicHeader />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 pt-5 pb-14">
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
        <FavoritesGrid comicOnly />
      </main>
      <ComicCalendarSection />
    </div>
  );
}
