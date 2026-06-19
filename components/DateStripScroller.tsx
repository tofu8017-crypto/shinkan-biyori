"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

// 横スクロールする日付帯のラッパー。マウント時に data-active="true" のセル
// （＝今日／表示中の日付）が帯の中央に来るよう、コンテナ内だけを横スクロールする。
// scrollIntoView ではなくコンテナの scrollLeft を動かすので、ページ全体は飛ばない。
export default function DateStripScroller({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const active = c.querySelector<HTMLElement>('[data-active="true"]');
    if (!active) return;
    const left = active.offsetLeft - (c.clientWidth - active.clientWidth) / 2;
    c.scrollTo({ left: Math.max(0, left), behavior: "auto" });
  }, []);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
