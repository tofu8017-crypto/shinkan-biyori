"use client";

import { useState } from "react";

type Props = {
  url: string;
  title: string;
};

export default function ShareButton({ url, title }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    // スマホ等でWeb Share APIが使える場合はネイティブ共有シートを出す
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // キャンセルは無視
      }
      return;
    }
    // デスクトップはクリップボードにコピー
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const xUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
      <button
        onClick={handleShare}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 18px",
          borderRadius: "999px",
          border: "1px solid var(--border)",
          background: "var(--bg-card)",
          color: "var(--text-sub)",
          fontSize: "13px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {copied ? "✓ コピーしました" : "🔗 この記事をシェア"}
      </button>

      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 18px",
          borderRadius: "999px",
          border: "1px solid var(--border)",
          background: "#000",
          color: "#fff",
          fontSize: "13px",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        𝕏 でシェア
      </a>
    </div>
  );
}
