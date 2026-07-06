"use client";

// ResultScreen の動作確認ページ（/dev/result）。
// 診断タイプ・avg_match_rate から自動で魔導書リアクションが変わる（success/normal/failure）。
// 本番ループには含めない。担当: harukichi (#18)

import { useState } from "react";
import ResultScreen from "@/components/ResultScreen";
import type { GrimoireVariant } from "@/components/PixelGrimoire";
import type { ResultData } from "@/lib/types";

const PRESETS: { label: string; data: ResultData }[] = [
  {
    label: "完璧型",
    data: {
      session_id: "demo-perfect",
      type_key: "flame_master",
      type_name: "炎陣の詠唱者",
      best_floor: { floor_id: "floor-2", spell_text: "闇よ我が右手に宿れ、滅びの焔となりて敵を穿て", spell_power: 148 },
      ai_verdict: "見事だ……お前の声は、確かに炎を呼ぶ資格を持っている。この魔導書、久々に本気で燃えたぞ。",
      stats: { avg_volume: "loud", total_hesitation: 0, avg_match_rate: 0.94 },
    },
  },
  {
    label: "まずまず型",
    data: {
      session_id: "demo-normal",
      type_key: "wavering_spark",
      type_name: "揺らめく灯火",
      best_floor: { floor_id: "floor-2", spell_text: "闇よ我が手に宿れ、焔となりて穿て", spell_power: 86 },
      ai_verdict: "悪くはない。だが、詠唱に迷いが残っている。あと一歩踏み込めば化けるぞ。",
      stats: { avg_volume: "normal", total_hesitation: 2, avg_match_rate: 0.68 },
    },
  },
  {
    label: "落第型",
    data: {
      session_id: "demo-fail",
      type_key: "faint_voice",
      type_name: "囁きの見習い",
      best_floor: { floor_id: "floor-1", spell_text: "やみ…えっと、右手に…", spell_power: 32 },
      ai_verdict: "……。もう一度、鏡の前で唱えてこい。声も、覚悟も、まだ足りん。",
      stats: { avg_volume: "quiet", total_hesitation: 5, avg_match_rate: 0.36 },
    },
  },
];

export default function ResultDevPage() {
  const [idx, setIdx] = useState(0);
  const [variantSel, setVariantSel] = useState<"random" | GrimoireVariant>("random");
  const [replay, setReplay] = useState(0);

  function apply(i: number) {
    setIdx(i);
    setReplay((r) => r + 1);
  }
  function bump() {
    setReplay((r) => r + 1);
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 16px" }}>
      <h1 style={{ color: "var(--accent)", textAlign: "center", margin: "0 0 4px", fontSize: 20 }}>Result dev</h1>
      <p style={{ opacity: 0.7, fontSize: 12, textAlign: "center", marginTop: 0, marginBottom: 8 }}>
        avg_match_rate から魔導書のリアクション自動判定（/dev/result）。
      </p>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>
        <aside style={{ width: 180, flexShrink: 0 }}>
          <Panel title="プリセット">
            {PRESETS.map((p, i) => (
              <button key={p.label} onClick={() => apply(i)} style={chip(idx === i)}>{p.label}</button>
            ))}
          </Panel>

          <Panel title="バリアント">
            {(["random", "A", "B"] as const).map((v) => (
              <button key={v} onClick={() => { setVariantSel(v); bump(); }} style={chip(variantSel === v)}>
                {v === "random" ? "ランダム" : v}
              </button>
            ))}
          </Panel>

          <Panel title="操作">
            <button onClick={bump} style={{ ...chip(false), background: "transparent", border: "1px solid var(--accent)" }}>
              🔄 再生
            </button>
          </Panel>
        </aside>

        <div style={{ flex: "1 1 460px", minWidth: 320, maxWidth: 500 }}>
          {/* key={replay} で再マウント → 魔導書リアクションとタイプライターを再生 */}
          <ResultScreen key={replay} result={PRESETS[idx].data} variant={variantSel} onRestart={bump} />
        </div>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: "0.06em", marginBottom: 4 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "8px 10px",
    fontSize: 13,
    borderRadius: 8,
    textAlign: "center",
    cursor: "pointer",
    color: "var(--fg)",
    background: active ? "color-mix(in srgb, var(--accent) 70%, transparent)" : "rgba(255,255,255,0.06)",
    border: active ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.15)",
  };
}
