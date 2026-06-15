"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 文芸版（ライト）⇄ コミック版（ダーク）を行き来するフロート切り替えボタン。
// 全ページに常時表示。現在地が /comic 配下かどうかで行き先と見た目を変える。
export default function ModeSwitchFloat() {
  const pathname = usePathname();
  const inComic = pathname === "/comic" || pathname.startsWith("/comic/");

  const href = inComic ? "/" : "/comic";
  const label = inComic ? "文芸版へ" : "コミック版へ";
  const icon = inComic ? "📖" : "📚";

  return (
    <Link
      href={href}
      aria-label={label}
      className="mode-switch-float"
      style={
        inComic
          ? {
              // コミック版にいるとき：明るい文芸版へ戻るボタン
              background: "#FAF6F1",
              color: "#3D3530",
              boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
            }
          : {
              // 文芸版にいるとき：暗いコミック版へ行くボタン
              background: "#16161f",
              color: "#f4f4f6",
              boxShadow: "0 10px 28px rgba(20,20,40,0.3)",
            }
      }
    >
      <span style={{ fontSize: "18px", lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
