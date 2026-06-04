import type { Metadata } from "next";
import { Noto_Serif_JP, M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";

const notoSerifJP = Noto_Serif_JP({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const mPlusRounded = M_PLUS_Rounded_1c({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "新刊日和 — 文芸書の新刊カレンダー",
  description: "今日発売の文芸書（小説・エッセイ・ミステリー・SF）を毎日まとめ。Amazon・楽天のリンク付き。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSerifJP.variable} ${mPlusRounded.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: "var(--font-sans), sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
