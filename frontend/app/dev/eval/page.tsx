"use client";

// EvaluationBars / GMComment の動作確認ページ（/dev/eval）。
// 3カラムレイアウト（戦闘フィールド準拠・PC1画面に収まる想定）：
//   左 = プリセット / 表示切替（コンパクト・ドット風）
//   中央 = プレビュー（EvaluationBars + GMComment）
//   右 = 反応(mood) / バリアント(A/B) / 個別調整スライダー
// 本番ループには含めない。担当: harukichi (#4)

import { useMemo, useState } from "react";
import EvaluationBars from "@/components/EvaluationBars";
import GMComment from "@/components/GMComment";
import { moodFromMatchRate, pickGrimoireVariant, type GrimoireMood, type GrimoireVariant } from "@/components/PixelGrimoire";
import type { EvaluationResult, Volume } from "@/lib/types";

const PRESETS: { label: string; data: EvaluationResult }[] = [
  {
    label: "完璧詠唱",
    data: { transcript: "闇よ我が手に宿れ", match_rate: 0.96, volume: "loud", speed_wpm: 165, completion_rate: 1.0, hesitation_count: 0, confidence: 0.92, gm_comment: "見事だ……完璧な詠唱。敵は塵となって消えた。", spell_power: 148 },
  },
  {
    label: "まずまず",
    data: { transcript: "やみよわがてに", match_rate: 0.74, volume: "normal", speed_wpm: 120, completion_rate: 0.8, hesitation_count: 1, confidence: 0.6, gm_comment: "悪くない。だがまだ魔力に迷いが見えるぞ。", spell_power: 86 },
  },
  {
    label: "失敗",
    data: { transcript: "やみ…えっと", match_rate: 0.38, volume: "quiet", speed_wpm: 70, completion_rate: 0.45, hesitation_count: 3, confidence: 0.25, gm_comment: "なんだその詠唱は。声も自信も足りん。出直してこい。", spell_power: 32 },
  },
];

const VOLUMES: Volume[] = ["quiet", "normal", "loud"];
const MOOD_LABEL: Record<GrimoireMood, string> = { idle: "通常", success: "成功", normal: "普通", failure: "失敗" };

export default function EvalDevPage() {
  const [result, setResult] = useState<EvaluationResult>(PRESETS[0].data);
  const [replay, setReplay] = useState(0);
  const [compact, setCompact] = useState(false);
  const [pixel, setPixel] = useState(true);
  const [moodSel, setMoodSel] = useState<"auto" | GrimoireMood>("auto");
  const [variantSel, setVariantSel] = useState<"auto" | GrimoireVariant>("auto");

  const mood: GrimoireMood = moodSel === "auto" ? moodFromMatchRate(result.match_rate) : moodSel;
  // auto のときは replay ごとに再ランダム
  const variant: GrimoireVariant = useMemo(
    () => (variantSel === "auto" ? pickGrimoireVariant() : variantSel),
    [variantSel, replay],
  );

  function apply(data: EvaluationResult) {
    setResult(data);
    setReplay((r) => r + 1);
  }
  function set<K extends keyof EvaluationResult>(key: K, value: EvaluationResult[K]) {
    setResult((prev) => ({ ...prev, [key]: value }));
  }
  function bump() {
    setReplay((r) => r + 1);
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 16px" }}>
      <h1 style={{ color: "var(--accent)", textAlign: "center", margin: "0 0 4px", fontSize: 20 }}>Evaluation dev</h1>
      <p style={{ opacity: 0.7, fontSize: 12, textAlign: "center", marginTop: 0, marginBottom: 8 }}>
        左＝表示切替 / 中央＝プレビュー / 右＝反応・調整（/dev/eval）。
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>
        {/* 左：プリセット・表示切替 */}
        <aside style={{ width: 178, flexShrink: 0 }}>
          <Panel title="プリセット">
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => apply(p.data)} style={btn}>{p.label}</button>
            ))}
          </Panel>

          <Panel title="表示">
            <button onClick={() => setCompact((c) => !c)} style={chip(compact)}>
              {compact ? "コンパクト ON" : "コンパクト OFF"}
            </button>
            <button onClick={() => { setPixel((p) => !p); bump(); }} style={chip(pixel)}>
              {pixel ? "ドット風 ON" : "ドット風 OFF"}
            </button>
            <button onClick={bump} style={ghost}>🔄 再生</button>
          </Panel>
        </aside>

        {/* 中央：プレビュー */}
        <div style={{ flex: "1 1 380px", minWidth: 280, maxWidth: 440, display: "flex", flexDirection: "column", gap: 12 }}>
          <EvaluationBars result={result} compact={compact} pixel={pixel} />
          <GMComment key={replay} comment={result.gm_comment} pixel={pixel} mood={mood} variant={variant} />
        </div>

        {/* 右：反応・調整 */}
        <aside style={{ width: 200, flexShrink: 0 }}>
          <Panel title={`反応（現在: ${MOOD_LABEL[mood]} ${variant}）`}>
            {(["auto", "success", "normal", "failure"] as const).map((m) => (
              <button key={m} onClick={() => { setMoodSel(m); bump(); }} style={chip(moodSel === m)}>
                {m === "auto" ? "自動（一致率→）" : MOOD_LABEL[m]}
              </button>
            ))}
          </Panel>

          <Panel title="バリアント">
            {(["auto", "A", "B"] as const).map((v) => (
              <button key={v} onClick={() => { setVariantSel(v); bump(); }} style={chip(variantSel === v)}>
                {v === "auto" ? "ランダム" : v}
              </button>
            ))}
          </Panel>

          <Panel title="個別調整">
            <Slider label="発音一致率" value={result.match_rate} onChange={(v) => set("match_rate", v)} />
            <Slider label="詠唱完成度" value={result.completion_rate} onChange={(v) => set("completion_rate", v)} />
            <Slider label="自信" value={result.confidence} onChange={(v) => set("confidence", v)} />
            <Slider label="速度" value={result.speed_wpm} min={0} max={220} step={5} onChange={(v) => set("speed_wpm", v)} />
            <Slider label="詰まり" value={result.hesitation_count} min={0} max={5} step={1} onChange={(v) => set("hesitation_count", v)} />
            <Slider label="威力" value={result.spell_power} min={0} max={200} step={1} onChange={(v) => set("spell_power", v)} />
            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.7 }}>音量</div>
            <div style={{ display: "flex", gap: 4 }}>
              {VOLUMES.map((v) => (
                <button key={v} onClick={() => set("volume", v)} style={chip(result.volume === v)}>{v}</button>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: "0.06em", marginBottom: 4 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{children}</div>
    </div>
  );
}

function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <label style={{ fontSize: 11, opacity: 0.85 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
    </label>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13,
  color: "#fff",
  background: "var(--accent)",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

const ghost: React.CSSProperties = { ...btn, background: "transparent", border: "1px solid var(--accent)" };

function chip(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "7px 8px",
    fontSize: 13,
    borderRadius: 8,
    textAlign: "center",
    cursor: "pointer",
    color: "var(--fg)",
    background: active ? "color-mix(in srgb, var(--accent) 70%, transparent)" : "rgba(255,255,255,0.06)",
    border: active ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.15)",
  };
}
