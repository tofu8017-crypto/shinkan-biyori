"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "done" | "error";

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
          website: data.get("website"), // ハニーポット
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "送信に失敗しました。");
      setStatus("done");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "送信に失敗しました。");
    }
  }

  if (status === "done") {
    return (
      <p className="text-sm font-bold" style={{ color: "var(--text-main)", lineHeight: 1.9 }}>
        送信しました。お問い合わせありがとうございます。<br />
        内容を確認のうえ、必要に応じてご返信します。
      </p>
    );
  }

  const labelStyle = { fontSize: "13px", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px", display: "block" } as const;
  const inputStyle = {
    width: "100%",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    background: "#fff",
    padding: "10px 12px",
    fontSize: "14px",
    color: "var(--text-main)",
    outline: "none",
  } as const;

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <div className="mb-4">
        <label htmlFor="name" style={labelStyle}>お名前（任意）</label>
        <input id="name" name="name" type="text" autoComplete="name" style={inputStyle} />
      </div>
      <div className="mb-4">
        <label htmlFor="email" style={labelStyle}>メールアドレス（返信が必要な場合）</label>
        <input id="email" name="email" type="email" autoComplete="email" style={inputStyle} />
      </div>
      <div className="mb-4">
        <label htmlFor="message" style={labelStyle}>お問い合わせ内容 *</label>
        <textarea id="message" name="message" required rows={6} style={{ ...inputStyle, resize: "vertical" }} />
      </div>
      {/* ハニーポット（CSSで隠す。botが埋めたら送信は無視される） */}
      <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status === "error" && (
        <p className="text-sm font-bold mb-3" style={{ color: "#c0392b" }}>{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="text-sm font-bold rounded-full px-7 py-3 transition-opacity hover:opacity-80"
        style={{ background: "var(--highlight)", color: "#fff", border: "none", cursor: status === "sending" ? "default" : "pointer", opacity: status === "sending" ? 0.6 : 1 }}
      >
        {status === "sending" ? "送信中…" : "送信する"}
      </button>
    </form>
  );
}
