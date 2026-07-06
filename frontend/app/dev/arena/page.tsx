"use client";

// BattleField（プレイアブル・群れ殲滅）の動作確認ページ（/dev/arena）。
// WASD/矢印/テンキーで移動、詠唱ボタンでキャラの向き方向へAoE発射。
// 本番ループには含めない。担当: harukichi

import { useState } from "react";
import BattleField from "@/components/BattleField";
import type { SpellType } from "@/components/SpellEffect";

const SPELLS: { type: SpellType; label: string }[] = [
  { type: "fire", label: "🔥 炎" },
  { type: "ice", label: "❄️ 氷" },
  { type: "thunder", label: "⚡ 雷" },
  { type: "dark", label: "🌑 闇" },
];

export default function FieldDevPage() {
  const [type, setType] = useState<SpellType>("fire");
  const [level, setLevel] = useState(4);
  const [nonce, setNonce] = useState(0);
  const [charging, setCharging] = useState(false);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "12px 16px" }}>
      <h1 style={{ color: "var(--accent)", textAlign: "center", margin: "0 0 4px", fontSize: 20 }}>Field dev</h1>
      <p style={{ opacity: 0.7, fontSize: 12, textAlign: "center", marginTop: 0, marginBottom: 8 }}>
        まずフィールドをクリックしてフォーカス → WASD/矢印/テンキーで移動。詠唱でキャラの向き方向へAoE（/dev/arena）。
      </p>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>
        <aside style={{ width: 160, flexShrink: 0 }}>
          <Panel title="属性">
            {SPELLS.map((s) => (
              <button key={s.type} onClick={() => setType(s.type)} style={chip(type === s.type)}>{s.label}</button>
            ))}
          </Panel>
          <Panel title="派手さ(1..5)">
            {[1, 2, 3, 4, 5].map((lv) => (
              <button key={lv} onClick={() => setLevel(lv)} style={chip(level === lv)}>Lv{lv}</button>
            ))}
          </Panel>
        </aside>

        <div style={{ flex: "1 1 600px", minWidth: 320, maxWidth: 620 }}>
          <BattleField spell_type={type} level={level} castNonce={nonce} charging={charging} />
        </div>

        <aside style={{ width: 160, flexShrink: 0 }}>
          <Panel title="詠唱">
            <button
              onMouseDown={() => setCharging(true)}
              onMouseUp={() => { setCharging(false); setNonce((n) => n + 1); }}
              onMouseLeave={() => setCharging(false)}
              style={{ ...chip(false), background: "var(--accent)", color: "#fff" }}
            >
              🎤 押して溜め→離して発射
            </button>
            <button onClick={() => setNonce((n) => n + 1)} style={chip(false)}>🪄 即発射</button>
          </Panel>
        </aside>
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
    padding: "8px 10px", fontSize: 13, borderRadius: 8, textAlign: "center", cursor: "pointer",
    color: "var(--fg)",
    background: active ? "color-mix(in srgb, var(--accent) 70%, transparent)" : "rgba(255,255,255,0.06)",
    border: active ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.15)",
  };
}
