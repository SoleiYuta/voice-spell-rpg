"use client";

// 3択の呪文カード（属性ごとの派手エフェクト付き）。#71 / 担当: satoryudev
// spell_type を6属性に正規化し、炎/雷/氷/闇/光/風それぞれのCSSエフェクトを重ねる。
// 枠色は useGame.colorForSpell と揃える（--el を inline で渡す）。

import type { CSSProperties } from "react";
import type { SpellData } from "@/lib/types";
import { colorForSpell } from "@/lib/useGame";
import styles from "./SpellChoiceCard.module.css";

// spell_type（表記ゆれ含む）→ エフェクトの属性キー
const NORM: Record<string, string> = {
  fire: "fire", flame: "fire",
  ice: "ice", water: "ice", frost: "ice",
  thunder: "thunder", lightning: "thunder",
  wind: "wind",
  dark: "dark", shadow: "dark", earth: "dark",
  light: "light",
};
const META: Record<string, { ja: string; icon: string }> = {
  fire: { ja: "炎", icon: "🔥" },
  ice: { ja: "氷", icon: "❄️" },
  thunder: { ja: "雷", icon: "⚡" },
  dark: { ja: "闇", icon: "🌑" },
  light: { ja: "光", icon: "✨" },
  wind: { ja: "風", icon: "🌪️" },
};

function Effect({ kind }: { kind: string }) {
  if (kind === "fire") {
    return (
      <span className={styles.fx} aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={`f${i}`}
            className={styles.flame}
            style={{ left: `${6 + i * 15}%`, height: `${30 + (i % 3) * 12}px`, animationDelay: `${i * 0.09}s` }}
          />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={`e${i}`} className={styles.emb} style={{ left: `${8 + i * 11}%`, animationDelay: `${i * 0.18}s` }} />
        ))}
      </span>
    );
  }
  if (kind === "thunder") {
    return (
      <span className={styles.fx} aria-hidden>
        <span className={styles.bolt}>
          <svg viewBox="0 0 100 60" preserveAspectRatio="none">
            <polyline points="18,2 40,26 28,30 60,58" />
            <polyline points="72,4 86,28 76,30 94,56" />
          </svg>
        </span>
        <span className={styles.zapflash} />
      </span>
    );
  }
  if (kind === "ice") {
    return (
      <span className={styles.fx} aria-hidden>
        <span className={styles.frost} />
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className={styles.shard}
            style={{ left: `${5 + i * 9.5}%`, animationDelay: `${i * 0.22}s`, animationDuration: `${1.5 + (i % 4) * 0.35}s` }}
          />
        ))}
      </span>
    );
  }
  if (kind === "dark") {
    return (
      <span className={styles.fx} aria-hidden>
        <span className={styles.vortex} />
        <span className={styles.dpulse} />
      </span>
    );
  }
  if (kind === "light") {
    return (
      <span className={styles.fx} aria-hidden>
        <span className={styles.rays} />
        <span className={styles.lpulse} />
        {["18%", "70%", "44%", "82%"].map((l, i) => (
          <span key={i} className={styles.sparkle} style={{ left: l, top: `${18 + i * 18}%`, animationDelay: `${i * 0.4}s` }}>
            ✦
          </span>
        ))}
      </span>
    );
  }
  // wind
  return (
    <span className={styles.fx} aria-hidden>
      <span className={styles.swirl} />
      {Array.from({ length: 4 }).map((_, i) => (
        <span key={i} className={styles.gust} style={{ top: `${20 + i * 20}%`, width: `${40 + i * 12}%`, animationDelay: `${i * 0.3}s` }} />
      ))}
    </span>
  );
}

export default function SpellChoiceCard({ spell, onClick }: { spell: SpellData; onClick: () => void }) {
  const kind = NORM[(spell.spell_type || "").toLowerCase()] ?? "dark";
  const meta = META[kind];
  const color = colorForSpell(spell.spell_type);
  const stars = "★".repeat(Math.max(1, Math.min(5, spell.difficulty)));
  return (
    <button
      type="button"
      className={styles.card}
      style={{ ["--el"]: color } as CSSProperties}
      onClick={onClick}
    >
      <Effect kind={kind} />
      <span className={styles.body}>
        <span className={styles.icon}>{meta.icon}</span>
        <span className={styles.txt}>
          <span className={styles.label}>
            <b>{meta.ja}</b> ・ {stars}
          </span>
          <span className={styles.spell}>「{spell.spell_text}」</span>
        </span>
      </span>
    </button>
  );
}
