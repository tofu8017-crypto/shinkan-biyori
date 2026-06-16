import Link from "next/link";

// 月間カレンダー（7列グリッド）。発売がある日はハイライトし冊数を表示、
// クリックでその日の新刊一覧(/date/[date])へ。スマホでも7列が収まるよう小さめ。

type Props = {
  yyyymm: string; // "2026-06"
  counts: Record<string, number>; // { "2026-06-13": 5, ... }
  today: string; // JSTの今日 "2026-06-14"
  // 前月・翌月の「薄表示」用。trueのとき各日付のリンクを外し（呼び出し側で月全体を
  // 1つのリンクにできるよう）、今日の枠線ハイライトも出さない。
  muted?: boolean;
  // 各日のリンク先ベース。文芸版は "/date"、コミック版は "/comics/date"。
  hrefBase?: string;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function MonthCalendar({ yyyymm, counts, today, muted = false, hrefBase = "/date" }: Props) {
  const [y, m] = yyyymm.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  // セル配列（先頭の空白＋1〜末日）
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${yyyymm}-${String(d).padStart(2, "0")}`);
  }

  return (
    <div>
      {/* 曜日ヘッダー */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "6px" }}>
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className="text-center"
            style={{
              fontSize: "11px",
              fontWeight: 700,
              padding: "2px 0",
              color: i === 0 ? "#c98c8c" : i === 6 ? "#8ca7c9" : "var(--text-muted)",
            }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
        {cells.map((date, idx) => {
          if (!date) return <div key={`b${idx}`} />;
          const day = Number(date.slice(8));
          const count = counts[date] ?? 0;
          const isToday = !muted && date === today;
          const has = count > 0;

          const inner = (
            <div
              className="flex flex-col items-center justify-center"
              style={{
                aspectRatio: "1 / 1",
                borderRadius: "8px",
                background: has ? "var(--accent-sage)" : "transparent",
                border: isToday ? "2px solid var(--highlight)" : "1px solid var(--border)",
                color: "var(--text-main)",
                opacity: has ? 1 : 0.55,
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: has ? 700 : 500, lineHeight: 1 }}>{day}</span>
              {has && (
                <span style={{ fontSize: "9px", fontWeight: 700, marginTop: "2px", color: "var(--text-sub)" }}>
                  {count}冊
                </span>
              )}
            </div>
          );

          // 薄表示（前月・翌月）では各日のリンクを張らない。月全体を呼び出し側で
          // 1つのリンクにするため（aの入れ子はNG）。
          return has && !muted ? (
            <Link key={date} href={`${hrefBase}/${date}`} style={{ textDecoration: "none" }}>
              {inner}
            </Link>
          ) : (
            <div key={date}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
