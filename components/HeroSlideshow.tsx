"use client";
import { useEffect, useState } from "react";

// ヒーロー背景を3枚の画像でクロスフェード巡回させるスライドショー。
// 画像は public/hero-1.jpg 〜 hero-3.jpg（後日差し替え）。
const IMAGES = ["/hero-1.jpg", "/hero-2.jpg", "/hero-3.jpg"];
const INTERVAL_MS = 5000; // 切り替え間隔

export default function HeroSlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % IMAGES.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {IMAGES.map((src, i) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            opacity: i === active ? 1 : 0,
            transition: "opacity 1.2s ease-in-out",
          }}
        />
      ))}
    </>
  );
}
