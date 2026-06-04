import { GENRES } from "@/types/book";

export default function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" className="flex items-baseline gap-2">
          <span
            className="text-xl"
            style={{ fontFamily: "var(--font-serif)", color: "var(--text-main)" }}
          >
            新刊日和
          </span>
          <span className="text-xs hidden sm:inline" style={{ color: "var(--text-muted)" }}>
            文芸書の新刊カレンダー
          </span>
        </a>
      </div>

      {/* ジャンルタブ（猫キャラはスロット確保済み） */}
      <div
        className="border-t overflow-x-auto"
        style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            <a
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
              style={{ background: "var(--highlight)", color: "#fff" }}
            >
              すべて
            </a>
            {GENRES.map((g) => (
              <a
                key={g.id}
                href={`/genre/${g.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border"
                style={{
                  color: "var(--text-sub)",
                  borderColor: "var(--border)",
                  background: "var(--bg-card)",
                }}
              >
                {/* 猫キャラスロット：画像が来たら <img src={`/cats/${g.id}.png`} /> に差し替え */}
                <span
                  className="w-4 h-4 rounded-full border border-dashed flex-shrink-0"
                  style={{ borderColor: "var(--text-muted)" }}
                />
                {g.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
