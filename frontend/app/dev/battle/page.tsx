"use client";

// BattleScene / SpellEffect の動作確認用プレイグラウンド（統合 page.tsx とは別。/dev/battle）。
// 左=攻撃(属性+派手さ) / 中央=戦闘画面 / 右=敵 の3カラム。
// 派手さボタンは押すたびにエフェクトを再生（HPは減らさない＝繰り返し確認用）。
// HPを減らす本発動は「詠唱（発動）」ボタン。本番ループには含めない。
// 担当: harukichi (#2)

import Link from "next/link";
import { useState } from "react";
import BattleScene from "@/components/BattleScene";
import type { SpellType } from "@/components/SpellEffect";

const MAX_HP = 100;

// 呪文属性（4属性すべて実装済み）
const SPELLS: { type: SpellType; label: string }[] = [
  { type: "fire", label: "🔥 炎" },
  { type: "ice", label: "❄️ 氷" },
  { type: "thunder", label: "⚡ 雷" },
  { type: "dark", label: "🌑 闇" },
];

// 派手さ5段階（詠唱精度のイメージ）
const LEVELS = [
  { lv: 1, label: "Lv1 ぎこちない" },
  { lv: 2, label: "Lv2 たどたどしい" },
  { lv: 3, label: "Lv3 まずまず" },
  { lv: 4, label: "Lv4 よどみなく" },
  { lv: 5, label: "Lv5 完璧詠唱" },
];

// 敵の種類（スプライト未用意のため絵文字）
const ENEMIES = ["👾", "🐉", "💀", "🧟", "🪼"];

export default function BattleDevPage() {
  const [hp, setHp] = useState(MAX_HP);
  const [type, setType] = useState<SpellType>("fire");
  const [level, setLevel] = useState(3);
  const [enemy, setEnemy] = useState(ENEMIES[0]);
  const [cast, setCast] = useState(0); // 発動トークン（key 用）
  const [withDamage, setWithDamage] = useState(false); // 直近の発動でHPを減らしたか

  // 派手さボタン：選択＋即エフェクト再生（HPは減らさない＝繰り返し確認用）
  function preview(lv: number) {
    setLevel(lv);
    setWithDamage(false);
    setCast((c) => c + 1);
  }

  // 属性ボタン：選択＋現在の派手さで即エフェクト再生
  function previewType(t: SpellType) {
    setType(t);
    setWithDamage(false);
    setCast((c) => c + 1);
  }

  // 本発動：HPを減らしてダメージ数字も出す
  function castReal() {
    setWithDamage(true);
    setHp((prev) => Math.max(0, prev - level * 14));
    setCast((c) => c + 1);
  }

  function reset() {
    setHp(MAX_HP);
    setWithDamage(false);
    setCast(0);
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <h1 style={{ color: "var(--accent)", textAlign: "center", margin: "0 0 4px" }}>BattleScene dev</h1>
      <p style={{ opacity: 0.7, fontSize: 13, textAlign: "center", marginTop: 0 }}>
        左＝攻撃 / 右＝敵。派手さボタンを押すたびにエフェクト再生（/dev/battle）。
        <br />
        <Link href="/dev/field" style={{ color: "var(--accent)" }}>→ 実験フィールド（敵配置・当たり判定） (/dev/field)</Link>
      </p>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>
        {/* 左：攻撃（属性 + 派手さ） */}
        <aside style={{ width: 190, flexShrink: 0 }}>
          <Panel title="属性（押すと発動）">
            {SPELLS.map((s) => (
              <button key={s.type} onClick={() => previewType(s.type)} style={chip(type === s.type)}>
                {s.label}
              </button>
            ))}
          </Panel>

          <Panel title="派手さ（押すと発動）">
            {LEVELS.map((l) => (
              <button key={l.lv} onClick={() => preview(l.lv)} style={chip(level === l.lv)}>
                {l.label}
              </button>
            ))}
          </Panel>
        </aside>

        {/* 中央：戦闘画面 */}
        <div style={{ flex: "1 1 360px", minWidth: 300, maxWidth: 480 }}>
          {/* key={cast} で毎回マウントし直し、同条件の連打でも演出を再発火 */}
          <BattleScene
            key={cast}
            enemy_hp={hp}
            max_hp={MAX_HP}
            enemy_emoji={enemy}
            spell_type={type}
            intensity={cast > 0 ? level : undefined}
            spell_power={cast > 0 && withDamage ? level * 14 : undefined}
          />

          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
            <button onClick={castReal} style={{ ...btn, fontSize: 16, padding: "12px 24px" }}>
              🪄 詠唱（発動・ダメージ）
            </button>
            <button onClick={reset} style={{ ...btn, background: "transparent", border: "1px solid var(--accent)" }}>
              リセット
            </button>
          </div>

          <p style={{ textAlign: "center", opacity: 0.7, marginTop: 12, fontSize: 13 }}>
            残りHP: {hp} / {MAX_HP}
            {hp <= 0 ? " — 撃破！" : ""}
          </p>
        </div>

        {/* 右：敵 */}
        <aside style={{ width: 130, flexShrink: 0 }}>
          <Panel title="敵の種類">
            {ENEMIES.map((e) => (
              <button key={e} onClick={() => setEnemy(e)} style={{ ...chip(enemy === e), fontSize: 22 }}>
                {e}
              </button>
            ))}
          </Panel>
        </aside>
      </div>
    </main>
  );
}

// 縦並びのコントロールパネル（サイドカラム用）
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: "0.06em", marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 18px",
  fontSize: 15,
  color: "#fff",
  background: "var(--accent)",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

function chip(active: boolean, disabled = false): React.CSSProperties {
  return {
    padding: "9px 12px",
    fontSize: 14,
    borderRadius: 8,
    textAlign: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    color: "var(--fg)",
    background: active ? "color-mix(in srgb, var(--accent) 70%, transparent)" : "rgba(255,255,255,0.06)",
    border: active ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.15)",
    opacity: disabled ? 0.45 : 1,
  };
}
