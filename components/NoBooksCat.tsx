"use client";

// 新刊ゼロの日の癒しエフェクト。
// 実写の猫が「歩いて入ってくる→立ち止まって伸びをする→また歩いて去る」。
// 歩行中は上下に小さくバウンドし、伸びの瞬間に体がぐっと伸びる（姿勢を2枚で切替）。
// 装飾なので pointer-events 無効・スクリーンリーダーから隠す・動き低減設定に配慮。
// variant="black": ジャンルページの「本日発売なし」用の黒猫（実写猫を黒シルエット加工した版）。
export default function NoBooksCat({ variant = "normal" }: { variant?: "normal" | "black" }) {
  const walk = variant === "black" ? "/cat-walk-black.png" : "/cat-walk.png";
  const stretch = variant === "black" ? "/cat-stretch-black.png" : "/cat-stretch.png";
  return (
    <div
      aria-hidden
      style={{ position: "relative", width: "100%", height: 230, overflow: "hidden", marginTop: 4 }}
    >
      <div className="nbc-mover">
        {/* eslint-disable @next/next/no-img-element */}
        <img src={walk} alt="" className="nbc nbc-walk" />
        <img src={stretch} alt="" className="nbc nbc-stretch" />
        {/* eslint-enable @next/next/no-img-element */}
      </div>
      <style>{`
        .nbc-mover { position: absolute; bottom: 0; left: 0; animation: nbc-x 18s linear infinite; will-change: transform; }
        .nbc { position: absolute; bottom: 0; left: 0; width: 340px; max-width: none; height: auto; pointer-events: none; user-select: none; }
        .nbc-walk   { animation: nbc-walkfade 18s linear infinite, nbc-bob .5s ease-in-out infinite alternate; }
        .nbc-stretch{ animation: nbc-stretch 18s linear infinite; transform-origin: bottom center; }

        /* 横移動：歩いて入る → 中央で停止(伸び) → 歩いて去る */
        @keyframes nbc-x {
          0%   { transform: translateX(-380px); }
          33%  { transform: translateX(40vw); }
          60%  { transform: translateX(40vw); }
          100% { transform: translateX(112vw); }
        }
        /* 歩き姿勢の表示（伸びの間だけ消す） */
        @keyframes nbc-walkfade {
          0%, 30% { opacity: 1; }
          35%, 58% { opacity: 0; }
          63%, 100% { opacity: 1; }
        }
        /* 歩行の上下バウンド（歩き姿勢が見えている間だけ意味を持つ） */
        @keyframes nbc-bob { from { transform: translateY(0); } to { transform: translateY(-5px); } }
        /* 伸び姿勢：中央で出現し、ぐっと伸びてから戻る */
        @keyframes nbc-stretch {
          0%, 30%  { opacity: 0; transform: scale(1, 1); }
          36%      { opacity: 1; transform: scale(1, 1); }
          47%      { opacity: 1; transform: scale(1.06, 0.97); }
          58%      { opacity: 1; transform: scale(1, 1); }
          63%, 100%{ opacity: 0; transform: scale(1, 1); }
        }

        @media (max-width: 680px) { .nbc { width: 230px; } }
        @media (prefers-reduced-motion: reduce) {
          .nbc-mover { animation: none; left: 50%; transform: translateX(-50%); }
          .nbc-walk { display: none; }
          .nbc-stretch { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
