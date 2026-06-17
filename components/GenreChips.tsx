import { GENRES } from "@/types/book";

// 全ジャンルを常にピル（チップ）で表示し、クリックでそのジャンルのページへ遷移する
// ナビゲーション。撤去したヘッダーの丸ナビの代わり。「すべて」はトップへ戻る。
// activeId に現在のジャンルID（または "all"）を渡すとそのチップを強調表示する。
export default function GenreChips({ activeId = "all" }: { activeId?: string }) {
  const items = [
    { id: "all", label: "すべて", href: "/" },
    // コミック(001001)は別サイト /comics に分離しているのでジャンルチップからは外す
    // 短縮名(short)があれば使う（ラノベ/ビジネス等）。スマホで横幅を抑えるため。
    ...GENRES.filter((g) => g.id !== "001001").map((g) => ({
      id: g.id,
      label: g.short ?? g.label,
      href: `/genre/${g.id}`,
    })),
  ];

  // スマホは小さめ＋詰めて2行に収め、PCは通常サイズに戻す（レスポンシブ）。
  return (
    <div className="flex flex-wrap gap-1 sm:gap-2 mb-8">
      {items.map((it) => {
        const active = it.id === activeId;
        return (
          <a
            key={it.id}
            href={it.href}
            className="rounded-full font-bold whitespace-nowrap border text-[11px] sm:text-sm px-2.5 py-1 sm:px-5 sm:py-2"
            style={{
              textDecoration: "none",
              borderColor: "var(--border)",
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
