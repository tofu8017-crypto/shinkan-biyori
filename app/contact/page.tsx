import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import ContactForm from "@/components/ContactForm";
import { SITE_URL } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "新刊日和へのお問い合わせ・ご指摘はこちらのフォームからお寄せください。",
  alternates: { canonical: "/contact" },
  // フォームページはインデックス不要
  robots: { index: false, follow: true },
  openGraph: {
    title: "お問い合わせ｜新刊日和",
    url: `${SITE_URL}/contact`,
    images: ["/hero.jpg"],
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="max-w-3xl mx-auto w-full px-4 pt-5 pb-20">
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "30px",
            fontWeight: 500,
            letterSpacing: "0.1em",
            color: "var(--text-main)",
            margin: "0 0 16px",
          }}
        >
          お問い合わせ
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-sub)", lineHeight: 1.9 }}>
          掲載内容の誤りのご指摘、ご要望、その他のお問い合わせはこちらからお寄せください。
          返信が必要な場合はメールアドレスをご記入ください。
        </p>
        <ContactForm />
      </main>
    </div>
  );
}
