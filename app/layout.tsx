import type { Metadata } from "next";
import { Noto_Serif_JP, M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";
import ModeSwitchFloat from "@/components/ModeSwitchFloat";

const notoSerifJP = Noto_Serif_JP({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const mPlusRounded = M_PLUS_Rounded_1c({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const SITE_DESCRIPTION =
  "今日発売の文芸書（小説・エッセイ・ミステリー・SF）を毎日まとめ。Amazon・楽天のリンク付き。";

export const metadata: Metadata = {
  metadataBase: new URL("https://shinkanbiyori.com"),
  title: {
    default: "新刊日和 — 文芸書の新刊カレンダー",
    template: "%s｜新刊日和",
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "新刊日和",
    title: "新刊日和 — 文芸書の新刊カレンダー",
    description: SITE_DESCRIPTION,
    url: "https://shinkanbiyori.com",
    locale: "ja_JP",
    images: ["/hero.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "新刊日和 — 文芸書の新刊カレンダー",
    description: SITE_DESCRIPTION,
    images: ["/hero.jpg"],
  },
};

// サイト全体のJSON-LD（WebSite + Organization）。schema.orgの@graphで2エンティティをまとめる
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "新刊日和",
      url: "https://shinkanbiyori.com",
      description: SITE_DESCRIPTION,
      inLanguage: "ja",
    },
    {
      "@type": "Organization",
      name: "新刊日和",
      alternateName: "新刊日和編集部",
      url: "https://shinkanbiyori.com",
      logo: "https://shinkanbiyori.com/icon.png",
      publishingPrinciples: "https://shinkanbiyori.com/about",
    },
  ],
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
        {/* サイト全体の構造化データ（JSON-LD）。XSS対策で < をエスケープしてから埋め込む */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(siteJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
        <ModeSwitchFloat />
      </body>
    </html>
  );
}
