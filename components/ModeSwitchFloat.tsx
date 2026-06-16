"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 文芸版（ライト）⇄ コミック版（ダーク）を行き来するフロートのトグルスイッチ。
// 全ページに常時表示。現在地が /comics 配下かどうかでスイッチのオン/オフと行き先が変わる。
// オフ(左)=文芸版（☀ ライト） / オン(右)=コミック版（🌙 ダーク）。
export default function ModeSwitchFloat() {
  const pathname = usePathname();
  const inComic = pathname === "/comics" || pathname.startsWith("/comics/");

  // クリックで反対側のモードへ遷移する
  const href = inComic ? "/" : "/comics";
  const label = inComic ? "文芸版へ切り替え" : "コミック版へ切り替え";

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`mode-switch${inComic ? " on" : ""}`}
    >
      {/* 左ラベル：文芸（ライト） */}
      <span className="mode-switch-side left">☀ 文芸</span>
      {/* 右ラベル：コミック（ダーク） */}
      <span className="mode-switch-side right">🌙 コミック</span>
      {/* スライドする丸ノブ */}
      <span className="mode-switch-knob" aria-hidden="true">
        {inComic ? "🌙" : "☀"}
      </span>
    </Link>
  );
}
