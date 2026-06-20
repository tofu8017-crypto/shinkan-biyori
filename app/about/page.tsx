export const revalidate = 86400;

import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import MonthCalendarSection from "@/components/MonthCalendarSection";
import JsonLd, { SITE_URL, breadcrumbJsonLd } from "@/components/JsonLd";

const TITLE = "運営者情報・編集方針";
const DESCRIPTION =
  "新刊日和の運営者情報、編集方針、書誌データの出典、アフィリエイトの開示についてのご案内です。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    title: `${TITLE}｜新刊日和`,
    description: DESCRIPTION,
    url: `${SITE_URL}/about`,
    images: ["/hero.jpg"],
  },
};

// 運営組織の構造化データ。publishingPrinciples にこのページ自身を指定し、
// 「編集方針を公開している媒体」であることを明示する（E-E-A-Tの信頼性シグナル）。
const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "新刊日和",
  alternateName: "新刊日和編集部",
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  description:
    "今日発売の文芸書・コミックの新刊を毎日まとめて紹介する新刊カレンダー。",
  publishingPrinciples: `${SITE_URL}/about`,
  knowsAbout: ["文芸書", "小説", "コミック", "新刊情報", "書評"],
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "20px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: "var(--text-main)",
          margin: "0 0 12px",
        }}
      >
        {title}
      </h2>
      <div className="text-sm leading-relaxed" style={{ color: "var(--text-sub)", lineHeight: 1.9 }}>
        {children}
      </div>
    </section>
  );
}

export default function AboutPage() {
  const breadcrumb = breadcrumbJsonLd([
    { name: "ホーム", path: "/" },
    { name: TITLE, path: "/about" },
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <JsonLd data={orgJsonLd} />
      <JsonLd data={breadcrumb} />
      <SiteHeader />

      <main className="max-w-3xl mx-auto w-full px-4 pt-5 pb-14">
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "30px",
            fontWeight: 500,
            letterSpacing: "0.1em",
            color: "var(--text-main)",
            margin: "0 0 24px",
          }}
        >
          {TITLE}
        </h1>

        <Section title="新刊日和について">
          <p>
            新刊日和は、今日発売の文芸書（小説・エッセイ・ミステリー・SFなど）とコミックの新刊を、
            発売日順に毎日まとめてお届けする新刊カレンダーです。「書店に行く時間はないけれど、
            気になる新刊は逃したくない」という読書好きのための道しるべを目指しています。
          </p>
        </Section>

        <Section title="編集体制・著者について">
          <p>
            記事・コラムは<strong>新刊日和編集部</strong>が執筆・編集しています。文芸の新刊を日々追い、
            書誌情報（発売日・版元・レーベル）と作品の特徴を、できるだけ具体的にお伝えすることを
            編集方針としています。掲載内容は公開前に編集部で確認しています。
          </p>
        </Section>

        <Section title="書誌データの出典">
          <p>
            書名・著者・発売日・書影などの書誌データは、<strong>楽天ブックスAPI</strong> および
            <strong> openBD</strong>（版元ドットコム・JPRO提供）を利用して取得し、毎日自動で更新しています。
            データは提供元に由来するため、実際の発売日・在庫・価格と異なる場合があります。
            最新の情報は各販売サイトでご確認ください。
          </p>
        </Section>

        <Section title="アフィリエイトについて">
          <p>
            当サイトは、Amazon.co.jpを宣伝しリンクすることによって紹介料を獲得できる
            Amazonアソシエイト・プログラムの参加者です。また楽天アフィリエイトなど、
            第三者配信のアフィリエイト・プログラムを利用しています。各販売サイトへのリンクには
            広告（アフィリエイトリンク）が含まれますが、紹介する内容の選定は編集部が独自に行っています。
          </p>
        </Section>

        <Section title="お問い合わせ">
          <p>
            掲載内容の誤りのご指摘・ご要望などは、
            <a href="/contact" style={{ color: "var(--highlight)", textDecoration: "underline" }}>
              お問い合わせフォーム
            </a>
            からお寄せください。可能な範囲で対応します。
          </p>
        </Section>
      </main>

      <MonthCalendarSection />
    </div>
  );
}
