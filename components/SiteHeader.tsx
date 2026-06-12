"use client";
import { usePathname } from "next/navigation";
import { GENRES } from "@/types/book";

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: "rgba(250,246,241,0.92)",
        backdropFilter: "blur(12px)",
        borderColor: "var(--border)",
      }}
    >
      {/* トップバー */}
      <div
        className="max-w-6xl mx-auto px-4 flex items-center justify-between topbar"
        style={{ height: "86px" }}
      >
        <div className="flex items-end gap-6">
          <a
            href="/"
            className="leading-none site-logo"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "42px",
              fontWeight: 500,
              letterSpacing: "0.18em",
              color: "var(--text-main)",
              textDecoration: "none",
            }}
          >
            新刊日和
          </a>
          <span
            className="mb-1 text-sm font-bold hidden sm:block"
            style={{ color: "var(--text-main)" }}
          >
            文芸書の新刊カレンダー
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* 検索フォーム（JSなしのGET送信。/search?q=... へ遷移） */}
          <form action="/search" method="get" className="flex items-center search-form">
            <input
              type="search"
              name="q"
              placeholder="作家名・書名で検索"
              aria-label="作家名・書名で検索"
              className="search-input"
            />
            <button type="submit" aria-label="検索" className="search-btn">
              ⌕
            </button>
          </form>
          <div className="hidden sm:flex gap-6 font-bold text-sm" style={{ color: "var(--text-main)" }}>
            <a href="/column" style={{ color: "var(--text-main)", textDecoration: "none" }}>
              コラム
            </a>
            <span>♡ お気に入り</span>
          </div>
        </div>
      </div>

      {/* ジャンルタブ */}
      <nav
        className="border-t overflow-x-auto genre-nav"
        style={{ borderColor: "rgba(232,221,214,0.7)" }}
      >
        <div
          className="max-w-6xl mx-auto px-4 flex items-center gap-6 genre-nav-inner"
          style={{ height: "112px" }}
        >
          {/* すべて */}
          <a
            href="/"
            className="relative flex items-center gap-3 whitespace-nowrap font-bold flex-shrink-0 pb-7 pt-6"
            style={{
              color: "var(--text-main)",
              textDecoration: "none",
            }}
          >
            <div
              className="rounded-full flex items-center justify-center border text-2xl genre-circle"
              style={{
                width: "48px",
                height: "48px",
                background: "#fff6ef",
                borderColor: "var(--border)",
                boxShadow: "inset 0 0 0 6px rgba(255,255,255,0.35)",
              }}
            >
              全
            </div>
            すべて
            {pathname === "/" && (
              <span
                className="absolute left-0 right-0 bottom-0 rounded-full"
                style={{ height: "5px", background: "var(--highlight)" }}
              />
            )}
          </a>

          {GENRES.map((g) => {
            const isActive = pathname === `/genre/${g.id}`;
            return (
              <a
                key={g.id}
                href={`/genre/${g.id}`}
                className="relative flex items-center gap-3 whitespace-nowrap font-bold flex-shrink-0 pb-7 pt-6"
                style={{ color: "var(--text-main)", textDecoration: "none" }}
              >
                <div
                  className="rounded-full overflow-hidden border flex-shrink-0 genre-circle"
                  style={{
                    width: "48px",
                    height: "48px",
                    borderColor: "var(--border)",
                    background: g.color + "55",
                    boxShadow: "inset 0 0 0 6px rgba(255,255,255,0.35)",
                  }}
                >
                  {/* アイコン画像が無いジャンル（例: 文庫）はリンク切れにせず、
                      色付きの丸だけ見せる（imgを隠す）フォールバック */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/cats/${g.id}.png`}
                    alt={g.label}
                    className="w-full h-full object-cover object-center"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                {g.short ?? g.label}
                {isActive && (
                  <span
                    className="absolute left-0 right-0 bottom-0 rounded-full"
                    style={{ height: "5px", background: "var(--highlight)" }}
                  />
                )}
              </a>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
