"use client";
import { usePathname } from "next/navigation";
import { GENRES } from "@/types/book";

// "2026-06-17" → "2026年6月17日" に整形（パンくず用）
function dateLabel(s: string): string {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

// 現在のパスからパンくずを組み立てる。ホーム・コミックでは空（表示しない）。
function buildCrumbs(pathname: string): { label: string; href?: string }[] {
  if (pathname === "/" || pathname.startsWith("/comics")) return [];
  const segs = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [{ label: "ホーム", href: "/" }];
  if (segs[0] === "genre" && segs[1]) {
    const g = GENRES.find((x) => x.id === segs[1]);
    crumbs.push({ label: g ? g.label : "ジャンル" });
  } else if (segs[0] === "date" && segs[1]) {
    crumbs.push({ label: `${dateLabel(segs[1])}の新刊` });
  } else if (segs[0] === "search") {
    crumbs.push({ label: "検索結果" });
  } else if (segs[0] === "column") {
    if (segs[1]) crumbs.push({ label: "コラム", href: "/column" }, { label: "記事" });
    else crumbs.push({ label: "コラム" });
  } else if (segs[0] === "books") {
    crumbs.push({ label: "書籍" });
  } else if (segs[0] === "authors") {
    crumbs.push({ label: "著者" });
  } else if (segs[0] === "series") {
    crumbs.push({ label: "シリーズ" });
  } else {
    crumbs.push({ label: segs[0] });
  }
  return crumbs;
}

export default function SiteHeader() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

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
          <div className="flex items-center gap-6 font-bold text-sm flex-shrink-0" style={{ color: "var(--text-main)" }}>
            {/* コラムはスマホでも表示。お気に入り（未実装の飾り）はデスクトップのみ */}
            <a href="/column" style={{ color: "var(--text-main)", textDecoration: "none" }}>
              コラム
            </a>
            <a href="/favorites" className="hidden sm:inline" style={{ color: "var(--text-main)", textDecoration: "none" }}>
              ♡ お気に入り
            </a>
            <a href="/about" className="hidden sm:inline" style={{ color: "var(--text-main)", textDecoration: "none" }}>
              運営者情報
            </a>
          </div>
        </div>
      </div>

      {/* パンくず（ジャンルの丸ナビは廃止し、現在地をパンくずで示す。
          ホーム・コミックでは crumbs が空になり、この帯ごと非表示になる） */}
      {crumbs.length > 0 && (
        <nav
          aria-label="パンくずリスト"
          className="border-t"
          style={{ borderColor: "rgba(232,221,214,0.7)" }}
        >
          <div
            className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 text-sm font-bold overflow-x-auto"
            style={{ color: "var(--text-muted)" }}
          >
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-2 whitespace-nowrap">
                {i > 0 && <span style={{ opacity: 0.45 }}>›</span>}
                {c.href ? (
                  <a href={c.href} style={{ color: "var(--text-muted)", textDecoration: "none" }}>
                    {c.label}
                  </a>
                ) : (
                  <span style={{ color: "var(--text-main)" }}>{c.label}</span>
                )}
              </span>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
