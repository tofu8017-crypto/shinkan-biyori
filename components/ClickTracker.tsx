"use client";

import { useEffect } from "react";

// 全ページ共通のアフィリエイトクリック計測。
// 楽天(rakuten.co.jp)/Amazon(amazon.co.jp)へのリンククリックを検知し、
// navigator.sendBeacon で /api/track に送る（遷移を妨げない・失敗してもUXに影響しない）。
// 個々のリンクに手を入れず、book詳細・一覧カード・コラム本文のリンクをまとめて拾える。
export default function ClickTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const a = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!a || !a.href) return;

      let host = "";
      try {
        host = new URL(a.href).hostname;
      } catch {
        return;
      }
      const store = host.includes("rakuten.co.jp")
        ? "rakuten"
        : host.includes("amazon.co.jp")
        ? "amazon"
        : null;
      if (!store) return;

      // ページが /books/<isbn13> ならISBNを拾う（任意）
      const m = window.location.pathname.match(/\/books\/(\d{13})/);
      const payload = JSON.stringify({
        store,
        page: window.location.pathname,
        isbn13: m ? m[1] : null,
      });

      try {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/track", blob);
      } catch {
        // sendBeacon非対応環境は黙ってスキップ
      }
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
  }, []);

  return null;
}
