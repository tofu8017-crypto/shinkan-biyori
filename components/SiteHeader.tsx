"use client";
import { usePathname } from "next/navigation";
import { GENRES } from "@/types/book";

// public/cats/ にアイコン画像が存在するジャンルID。
// ここに無いジャンル（文庫など）は壊れた画像を出さず、頭文字だけ表示する。
const ICON_GENRE_IDS = new Set([
  "001004001",
  "001004002",
  "001004003",
  "001004008",
  "001004009",
  "001006",
]);

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
          <div className="flex items-center gap-6 font-bold text-sm flex-shrink-0" style={{ color: "var(--text-main)" }}>
            {/* コラムはスマホでも表示。お気に入り（未実装の飾り）はデスクトップのみ */}
            <a href="/column" style={{ color: "var(--text-main)", textDecoration: "none" }}>
              コラム
            </a>
            <span className="hidden sm:inline">♡ お気に入り</span>
          </div>
        </div>
      </div>

      {/* ジャンルタブ */}
      <nav
        className="border-t genre-nav"
        style={{ borderColor: "rgba(232,221,214,0.7)" }}
      >
        {/* スクロール領域をmax-w-6xl内に収める。タブはヘッダーと左右が揃い、
            入りきらない分はこのコンテナ内で横スクロールする（右へのはみ出し・見切れ防止）。 */}
        <div className="max-w-6xl mx-auto px-4 overflow-x-auto genre-scroller">
        <div
          className="flex items-center gap-6 genre-nav-inner"
          style={{ height: "112px" }}
        >
          {/* すべて */}
          <a
            href="/"
            className="relative flex items-center gap-3 whitespace-nowrap font-bold flex-shrink-0 h-full pb-7 pt-6"
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

          {/* コミック(001001)は別サイト /comics に分離したのでジャンルタブからは外す */}
          {GENRES.filter((g) => g.id !== "001001").map((g) => {
            const isActive = pathname === `/genre/${g.id}`;
            return (
              <a
                key={g.id}
                href={`/genre/${g.id}`}
                className="relative flex items-center gap-3 whitespace-nowrap font-bold flex-shrink-0 h-full pb-7 pt-6"
                style={{ color: "var(--text-main)", textDecoration: "none" }}
              >
                <div
                  className="relative rounded-full overflow-hidden border flex-shrink-0 flex items-center justify-center text-2xl genre-circle"
                  style={{
                    width: "48px",
                    height: "48px",
                    borderColor: "var(--border)",
                    background: g.color + "55",
                    boxShadow: "inset 0 0 0 6px rgba(255,255,255,0.35)",
                  }}
                >
                  {/* アイコン画像があるジャンルだけ画像を表示。無いジャンル（文庫など）は
                      ジャンル名の頭文字を丸の中に表示する。壊れた画像を出さないため、
                      JSのonErrorに頼らず存在するIDだけを画像表示する。 */}
                  {ICON_GENRE_IDS.has(g.id) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`/cats/${g.id}.png`}
                      alt={g.label}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                  ) : (
                    <span style={{ color: "var(--text-main)" }}>
                      {(g.short ?? g.label).charAt(0)}
                    </span>
                  )}
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
        </div>
      </nav>
    </header>
  );
}
