"use client";

// BattleArena（群れアリーナ）の動作確認ページ（/dev/arena）。
// useGame は使わず、enemy_hp を手動で削って「群れが減る→AoE発射」を確認する。
// 本番ループには含めない。担当: harukichi

import { useState } from "react";
import BattleArena from "@/components/BattleArena";
import type { SpellType } from "@/components/SpellEffect";

const MAX_HP = 2.4;

const SPELLS: { type: SpellType; label: string }[] = [
  { type: "fire", label: "🔥 炎" },
  { type: "ice", label: "❄️ 氷" },
  { type: "thunder", label: "⚡ 雷" },
  { type: "dark", label: "🌑 闇" },
];

export default function ArenaDevPage() {
  const [hp, setHp] = useState(MAX_HP);
  const [type, setType] = useState<SpellType>("fire");
  const [level, setLevel] = useState(3);
  const [cast, setCast] = useState(0);
  const [charging, setCharging] = useState(false);

  function fire() {
    // 威力=level相当でHPを削る（本番は spell_power で useGame が削る）
    const power = 0.3 + level * 0.22;
    setHp((h) => Math.max(0, Math.round((h - power) * 100) / 100));
    setCast((c) => c + 1);
  }
  function reset() {
    setHp(MAX_HP);
    setCast(0);
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "12px 16px" }}>
      <h1 style={{ color: "var(--accent)", textAlign: "center", margin: "0 0 4px", fontSize: 20 }}>Arena dev</h1>
      <p style={{ opacity: 0.7, fontSize: 12, textAlign: "center", marginTop: 0, marginBottom: 8 }}>
        群れが前進 → 詠唱でキャラの向き方向へAoE。HP比率＝群れ残数（/dev/arena）。
      </p>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>
        <aside style={{ width: 170, flexShrink: 0 }}>
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

        <div style={{ flex: "1 1 560px", minWidth: 320, maxWidth: 580 }}>
          <BattleArena
            enemy_hp={hp}
            max_hp={MAX_HP}
            spell_type={type}
            intensity={cast > 0 ? level : undefined}
            spell_power={cast > 0 ? 0.3 + level * 0.22 : undefined}
            charging={charging}
          />
        </div>

        <aside style={{ width: 170, flexShrink: 0 }}>
          <Panel title="操作">
            <button
              onMouseDown={() => setCharging(true)}
              onMouseUp={() => { setCharging(false); fire(); }}
              onMouseLeave={() => setCharging(false)}
              style={{ ...chip(false), background: "var(--accent)", color: "#fff" }}
            >
              🎤 押して詠唱→離して発射
            </button>
            <button onClick={fire} style={chip(false)}>🪄 即発射</button>
            <button onClick={reset} style={{ ...chip(false), background: "transparent", border: "1px solid var(--accent)" }}>リセット</button>
          </Panel>
          <Panel title="状態">
            <div style={{ fontSize: 12, opacity: 0.8 }}>HP {hp} / {MAX_HP}{hp <= 0 ? " — 殲滅！" : ""}</div>
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
