import { GENRES } from "@/types/book";

// 全ジャンルを常にピル（チップ）で表示し、クリックでそのジャンルのページへ遷移する
// ナビゲーション。撤去したヘッダーの丸ナビの代わり。「すべて」はトップへ戻る。
// activeId に現在のジャンルID（または "all"）を渡すとそのチップを強調表示する。
export default function GenreChips({ activeId = "all" }: { activeId?: string }) {
  const items = [
    { id: "all", label: "すべて", href: "/" },
    // コミック(001001)は別サイト /comics に分離しているのでジャンルチップからは外す
    ...GENRES.filter((g) => g.id !== "001001").map((g) => ({
      id: g.id,
      label: g.label,
      href: `/genre/${g.id}`,
    })),
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-8">
      {items.map((it) => {
        const active = it.id === activeId;
        return (
          <a
            key={it.id}
            href={it.href}
            className="rounded-full font-bold whitespace-nowrap"
            style={{
              padding: "9px 20px",
              fontSize: "14px",
              textDecoration: "none",
              border: "1px solid var(--border)",
              background: active ? "var(--highlight)" : "#fff",
              color: active ? "#fff" : "var(--text-main)",
            }}
          >
            {it.label}
          </a>
        );
      })}
    </div>
  );
}
