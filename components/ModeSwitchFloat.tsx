"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 文芸版 ⇄ コミック版を行き来するフロートのスライダー（トグル）。
// 全ページに常時表示。現在地が /comics 配下かどうかでノブの左右と行き先が変わる。
// 左=文芸版 / 右=コミック版。
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
      {/* 左ラベル：文芸 */}
      <span className="mode-switch-side left">文芸</span>
      {/* 右ラベル：コミック */}
      <span className="mode-switch-side right">コミック</span>
      {/* スライドする丸ノブ（マークなし） */}
      <span className="mode-switch-knob" aria-hidden="true" />
    </Link>
  );
}
