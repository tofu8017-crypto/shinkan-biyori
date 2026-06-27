import Link from "next/link";

// 全ページ共通フッター。SNS（X / Instagram）への導線＋データ出典＋コピーライト。
// SNSアカウントが増えたら下の配列に1行足すだけ。URLが空の項目は表示しない。
const SOCIALS: { name: string; url: string; icon: "x" | "instagram" }[] = [
  { name: "X (旧Twitter)", url: "https://x.com/shinkanbiyori", icon: "x" },
  // InstagramのURLが分かったらここに設定する（空のうちは非表示）
  { name: "Instagram", url: "", icon: "instagram" },
];

function Icon({ kind }: { kind: "x" | "instagram" }) {
  if (kind === "x") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2zm0 1.8c-3.15 0-3.5.01-4.74.07-.89.04-1.37.19-1.69.31-.42.17-.73.36-1.05.68-.32.32-.51.63-.68 1.05-.12.32-.27.8-.31 1.69-.06 1.24-.07 1.59-.07 4.74s.01 3.5.07 4.74c.04.89.19 1.37.31 1.69.17.42.36.73.68 1.05.32.32.63.51 1.05.68.32.12.8.27 1.69.31 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c.89-.04 1.37-.19 1.69-.31.42-.17.73-.36 1.05-.68.32-.32.51-.63.68-1.05.12-.32.27-.8.31-1.69.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.04-.89-.19-1.37-.31-1.69a2.8 2.8 0 0 0-.68-1.05 2.8 2.8 0 0 0-1.05-.68c-.32-.12-.8-.27-1.69-.31C15.5 4.01 15.15 4 12 4zm0 3.05A4.95 4.95 0 1 1 7.05 12 4.95 4.95 0 0 1 12 7.05zm0 1.8A3.15 3.15 0 1 0 15.15 12 3.15 3.15 0 0 0 12 8.85zm5.14-.95a1.15 1.15 0 1 1-1.15-1.15 1.15 1.15 0 0 1 1.15 1.15z" />
    </svg>
  );
}

export default function SiteFooter() {
  const socials = SOCIALS.filter((s) => s.url);
  return (
    <footer
      className="mt-auto border-t"
      style={{ background: "var(--bg-subtle)", borderColor: "var(--border)", padding: "40px 0 32px" }}
    >
      <div className="max-w-5xl mx-auto px-4 flex flex-col items-center gap-5 text-center">
        <p style={{ fontFamily: "var(--font-serif)", fontSize: "20px", letterSpacing: "0.12em", color: "var(--text-main)" }}>
          新刊日和
        </p>

        {/* SNS導線 */}
        {socials.length > 0 && (
          <div className="flex items-center gap-4">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                title={s.name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "42px",
                  height: "42px",
                  borderRadius: "999px",
                  background: "#fff",
                  border: "1px solid var(--border)",
                  color: "var(--text-sub)",
                }}
              >
                <Icon kind={s.icon} />
              </a>
            ))}
          </div>
        )}

        {/* ナビ */}
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-bold" style={{ color: "var(--text-sub)" }}>
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>ホーム</Link>
          <Link href="/column" style={{ textDecoration: "none", color: "inherit" }}>コラム</Link>
          <Link href="/about" style={{ textDecoration: "none", color: "inherit" }}>このサイトについて</Link>
          <Link href="/contact" style={{ textDecoration: "none", color: "inherit" }}>お問い合わせ</Link>
        </nav>

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          書誌データ提供：楽天ブックスAPI・openBD
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          © {2026} 新刊日和
        </p>
      </div>
    </footer>
  );
}
