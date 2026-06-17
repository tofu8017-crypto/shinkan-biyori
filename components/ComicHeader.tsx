import Link from "next/link";

// コミック版の共通ヘッダー。文芸版SiteHeaderと同じ作り（明朝ロゴ＋検索＋リンク）で、
// 色だけ青系（comic-theme側のCSS変数）、リンク先はコミック文脈にする。
export default function ComicHeader() {
  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderColor: "var(--border)" }}
    >
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between" style={{ height: "86px" }}>
        <div className="flex items-end gap-6">
          <a
            href="/comics"
            className="leading-none"
            style={{ fontFamily: "var(--font-serif)", fontSize: "42px", fontWeight: 500, letterSpacing: "0.18em", color: "var(--text-main)", textDecoration: "none" }}
          >
            新刊日和
          </a>
          <span className="mb-1 text-sm font-bold hidden sm:block" style={{ color: "var(--text-main)" }}>
            コミックの新刊カレンダー
          </span>
        </div>
        <div className="flex items-center gap-4">
          <form action="/search" method="get" className="flex items-center search-form">
            <input type="search" name="q" placeholder="作家名・書名で検索" aria-label="作家名・書名で検索" className="search-input" />
            <button type="submit" aria-label="検索" className="search-btn">⌕</button>
          </form>
          <Link href="/" className="text-sm font-bold flex-shrink-0" style={{ color: "var(--highlight)", textDecoration: "none" }}>
            文芸版へ →
          </Link>
        </div>
      </div>
    </header>
  );
}
