"use client";

// 新刊ゼロの日のための癒しエフェクト。
// 大きな実写の猫が伸びをして、画面を横切っていく（無限ループ・ゆっくり）。
// 装飾なので pointer-events 無効・スクリーンリーダーからは隠す。
export default function NoBooksCat() {
  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        width: "100%",
        height: 220,
        overflow: "hidden",
        marginTop: 4,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cat-stretch.png"
        alt=""
        className="nobooks-cat"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 340,
          height: "auto",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
      <style>{`
        @keyframes nobooks-cat-walk {
          0%   { transform: translateX(-360px) translateY(0)   scale(1, 1);    }
          44%  { transform: translateX(38vw)   translateY(0)   scale(1, 1);    }
          50%  { transform: translateX(41vw)   translateY(-6px) scale(1.05, 0.96); } /* ひと伸び */
          56%  { transform: translateX(44vw)   translateY(0)   scale(1, 1);    }
          100% { transform: translateX(calc(100vw + 60px)) translateY(0) scale(1, 1); }
        }
        .nobooks-cat {
          animation: nobooks-cat-walk 17s ease-in-out infinite;
          will-change: transform;
        }
        @media (max-width: 680px) {
          .nobooks-cat { width: 220px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nobooks-cat { animation: none; left: 50%; transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
