import Link from "next/link";
import DateStripScroller from "./DateStripScroller";

// TOP・日付ページと同じ「±数日の横スクロール日付バー」。指定日を中央に表示し、
// 各日付クリックでその日の新刊一覧(/date/[d])へ。冊数がある日は色付き。
// （TOP/日付ページの inline 実装と見た目を揃えた共通部品）

function fmt(dateStr: string) {
  // サーバーのTZに依存しないよう曜日はUTC基準、月日は文字列から直接組み立てる
  const [y, m, dd] = dateStr.split("-").map(Number);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const dow = days[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  return { mmdd: `${m}/${dd}`, dow };
}

export default function DateStrip({
  dates,
  counts,
  activeDate,
}: {
  dates: string[];
  counts: Record<string, number>;
  activeDate: string;
}) {
  return (
    <DateStripScroller
      className="flex items-stretch gap-2 mb-8 overflow-x-auto"
      style={{ paddingBottom: "4px" }}
    >
      {dates.map((d) => {
        const f = fmt(d);
        const c = counts[d] ?? 0;
        const isCur = d === activeDate;
        return (
          <Link
            key={d}
            href={`/date/${d}`}
            data-active={isCur ? "true" : undefined}
            className="flex flex-col items-center justify-center flex-shrink-0"
            style={{
              width: "60px",
              padding: "8px 0",
              borderRadius: "10px",
              textDecoration: "none",
              background: isCur ? "var(--highlight)" : c > 0 ? "var(--accent-sage)" : "var(--bg-subtle)",
              color: isCur ? "#fff" : "var(--text-main)",
              opacity: c > 0 || isCur ? 1 : 0.5,
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 700, lineHeight: 1.1 }}>{f.mmdd}</span>
            <span style={{ fontSize: "10px" }}>{f.dow}</span>
            <span style={{ fontSize: "10px", fontWeight: 700, marginTop: "3px" }}>
              {c > 0 ? `${c}冊` : "—"}
            </span>
          </Link>
        );
      })}
    </DateStripScroller>
  );
}
