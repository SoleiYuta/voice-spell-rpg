"use client";

// 呪文エフェクト（ピクセルアート風・多属性）。type と level(1..5) を受け取り、
// 詠唱精度＝派手さの5段階で見た目が変化する。属性ごとに動き・配色・スプライトが異なる。
// 担当: harukichi (#2 / #4)

import { useMemo } from "react";
import styles from "./SpellEffect.module.css";

export type SpellType = "fire" | "ice" | "thunder" | "dark";

export interface SpellEffectProps {
  type: SpellType;
  /** 1..5。詠唱精度に応じた派手さ。範囲外はクランプ。 */
  level: number;
}

type Motion = "rise" | "fall" | "burst";

interface LevelParams {
  scale: number; // 中心スプライトの大きさ
  count: number; // メインパーティクル数
  sparks: number; // 放射状の追加火花
  flash: number; // 画面フラッシュ強度(0..1)
  dist: number; // パーティクル移動量(px)
  durMs: number; // 全体の長さ
}

interface SpellConfig {
  colors: Record<string, string>; // スプライトの色インデックス
  frameA: string[];
  frameB: string[];
  particlePalette: string[]; // パーティクルの色
  flashCore: string;
  flashColor: string;
  motion: Motion;
  coreAnchor: "bottom" | "center";
  levels: Record<number, LevelParams>;
}

// ── 🔥 炎：下から立ち上る火の粉 ──
const FIRE: SpellConfig = {
  colors: { "1": "#7a0d0d", "2": "#c81e1e", "3": "#ff4d2e", "4": "#ff8a3c", "5": "#ffd23c", "6": "#fff4c2" },
  frameA: ["...5...", "..454..", "..565..", ".45654.", "4566654", "4566654", "3566653", "2566652", "1455541", ".13331."],
  frameB: ["...5...", "..545..", ".45654.", ".45654.", "4566654", "3566653", "3566653", "2566652", "2455542", ".12321."],
  particlePalette: ["#ff4d2e", "#ff8a3c", "#ffd23c", "#fff4c2"],
  flashCore: "#fff6cf",
  flashColor: "#ff7a33",
  motion: "rise",
  coreAnchor: "bottom",
  levels: {
    1: { scale: 0.7, count: 5, sparks: 0, flash: 0.0, dist: 46, durMs: 600 },
    2: { scale: 0.95, count: 11, sparks: 0, flash: 0.12, dist: 70, durMs: 720 },
    3: { scale: 1.3, count: 18, sparks: 6, flash: 0.28, dist: 96, durMs: 820 },
    4: { scale: 1.7, count: 28, sparks: 13, flash: 0.5, dist: 132, durMs: 920 },
    5: { scale: 2.3, count: 44, sparks: 22, flash: 0.82, dist: 178, durMs: 1060 },
  },
};

// ── ❄️ 氷：降り注ぐ結晶の破片 ──
const ICE: SpellConfig = {
  colors: { "1": "#1b6fb3", "2": "#2f9be0", "3": "#6fd6ff", "4": "#bff0ff", "5": "#ffffff" },
  frameA: ["...4...", "..343..", "..343..", ".34543.", "3454543", "3454543", ".34543.", "..343..", "..343..", "...4..."],
  frameB: ["...5...", "..454..", "..343..", ".34543.", "3445443", "3445443", ".34543.", "..343..", "..454..", "...5..."],
  particlePalette: ["#6fd6ff", "#bff0ff", "#ffffff", "#9bb8ff"],
  flashCore: "#ffffff",
  flashColor: "#5fcaff",
  motion: "fall",
  coreAnchor: "center",
  levels: {
    1: { scale: 0.7, count: 6, sparks: 0, flash: 0.0, dist: 50, durMs: 700 },
    2: { scale: 0.95, count: 12, sparks: 2, flash: 0.08, dist: 80, durMs: 820 },
    3: { scale: 1.3, count: 20, sparks: 6, flash: 0.2, dist: 110, durMs: 950 },
    4: { scale: 1.7, count: 30, sparks: 12, flash: 0.38, dist: 150, durMs: 1080 },
    5: { scale: 2.3, count: 46, sparks: 20, flash: 0.6, dist: 200, durMs: 1200 },
  },
};

// ── ⚡ 雷：放射状に弾ける高速の火花 ──
const THUNDER: SpellConfig = {
  colors: { "1": "#6a2fd0", "2": "#9b5cff", "3": "#ffe34d", "4": "#fff7b0", "5": "#ffffff" },
  frameA: ["...554.", "..554..", "..54...", ".4554..", "..4554.", "...54..", "..554..", ".554...", ".54....", "54....."],
  frameB: ["..554..", "...554.", "...54..", "..4554.", ".4554..", "..54...", "...554.", "..554..", "..54...", ".54...."],
  particlePalette: ["#ffe34d", "#fff7b0", "#ffffff", "#c9a3ff"],
  flashCore: "#ffffff",
  flashColor: "#c9a3ff",
  motion: "burst",
  coreAnchor: "center",
  // 高速・鋭い。威力が上がるほど稲妻は大きくなる一方、ポヤポヤ（放射粒子・グロー）は減らして鋭く。
  levels: {
    1: { scale: 0.8, count: 8, sparks: 4, flash: 0.18, dist: 55, durMs: 150 },
    2: { scale: 1.15, count: 6, sparks: 3, flash: 0.2, dist: 64, durMs: 165 },
    3: { scale: 1.55, count: 4, sparks: 2, flash: 0.22, dist: 72, durMs: 180 },
    4: { scale: 2.05, count: 3, sparks: 1, flash: 0.24, dist: 82, durMs: 200 },
    5: { scale: 2.6, count: 2, sparks: 0, flash: 0.26, dist: 92, durMs: 220 },
  },
};

// ── 🌑 闇：渦巻く瘴気が放射状に飛散 ──
const DARK: SpellConfig = {
  colors: { "1": "#15071f", "2": "#3a1163", "3": "#7a23c2", "4": "#c44bff", "5": "#f0b3ff" },
  frameA: ["..242..", ".24342.", "2434342", "2433342", "2433342", "2434342", ".24342.", "..242.."],
  frameB: ["..242..", ".23442.", "2443432", "2433342", "2433342", "2343442", ".24432.", "..242.."],
  particlePalette: ["#c44bff", "#7a23c2", "#f0b3ff", "#3a1163"],
  flashCore: "#f0b3ff",
  flashColor: "#7a23c2",
  motion: "burst",
  coreAnchor: "center",
  levels: {
    1: { scale: 0.7, count: 6, sparks: 2, flash: 0.05, dist: 46, durMs: 650 },
    2: { scale: 0.95, count: 12, sparks: 6, flash: 0.15, dist: 72, durMs: 780 },
    3: { scale: 1.3, count: 18, sparks: 12, flash: 0.3, dist: 100, durMs: 900 },
    4: { scale: 1.7, count: 28, sparks: 20, flash: 0.52, dist: 140, durMs: 1020 },
    5: { scale: 2.3, count: 42, sparks: 32, flash: 0.8, dist: 188, durMs: 1160 },
  },
};

const CONFIGS: Record<SpellType, SpellConfig> = { fire: FIRE, ice: ICE, thunder: THUNDER, dark: DARK };

function clampLevel(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

// 中心スプライトの描画実寸(px)。当たり判定を見た目に合わせる用途（1セル=8px×scale）。
export function coreSpriteSize(type: SpellType, level: number): { w: number; h: number } {
  const cfg = CONFIGS[type];
  const s = cfg.levels[clampLevel(level)].scale;
  return { w: cfg.frameA[0].length * 8 * s, h: cfg.frameA.length * 8 * s };
}

// ドットマップ → <rect>（crispEdges で 1セル=1ドット）
function PixelSprite({
  map,
  colors,
  className,
}: {
  map: string[];
  colors: Record<string, string>;
  className?: string;
}) {
  const w = map[0].length;
  const h = map.length;
  const rects: React.ReactNode[] = [];
  map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = colors[ch];
      if (fill) {
        rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
      }
    });
  });
  return (
    <svg
      className={`${styles.sprite} ${className ?? ""}`}
      viewBox={`0 0 ${w} ${h}`}
      width={w * 8}
      height={h * 8}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      {rects}
    </svg>
  );
}

interface Particle {
  id: number;
  size: number;
  color: string;
  durMs: number;
  delayMs: number;
  motion: Motion;
  left?: number; // rise/fall
  dist?: number; // rise/fall
  dx: number;
  dy?: number; // burst
}

function genParticles(n: number, motion: Motion, p: LevelParams, palette: string[]): Particle[] {
  return Array.from({ length: n }, (_, i) => {
    const r = (x: number) => Math.random() * x;
    const common = {
      id: i,
      size: 3 + Math.floor(r(3)),
      color: palette[Math.floor(r(palette.length))],
      durMs: p.durMs * (0.55 + r(0.5)),
      delayMs: r(160),
    };
    if (motion === "burst") {
      const a = r(Math.PI * 2);
      const d = 40 + r(1) * (30 + p.scale * 40);
      return { ...common, motion, dx: Math.cos(a) * d, dy: Math.sin(a) * d };
    }
    // rise / fall
    return {
      ...common,
      motion,
      left: 50 + (r(2) - 1) * (10 + p.scale * 7),
      dx: (r(2) - 1) * (12 + p.scale * 14),
      dist: p.dist * (0.6 + r(0.7)),
    };
  });
}

function ParticleSpan({ p }: { p: Particle }) {
  const cls =
    p.motion === "rise" ? styles.rise : p.motion === "fall" ? styles.fall : styles.burst;
  const vars: Record<string, string | number> = {
    "--size": `${p.size}px`,
    "--color": p.color,
    "--pdur": `${p.durMs}ms`,
    "--delay": `${p.delayMs}ms`,
    "--dx": `${p.dx}px`,
  };
  if (p.motion === "burst") {
    vars["--dy"] = `${p.dy}px`;
  } else {
    vars["--left"] = `${p.left}%`;
    vars["--dist"] = `${p.dist}px`;
  }
  return <span className={`${styles.particle} ${cls}`} style={vars as React.CSSProperties} />;
}

export default function SpellEffect({ type, level }: SpellEffectProps) {
  const lv = clampLevel(level);
  const cfg = CONFIGS[type];
  const p = cfg.levels[lv];

  // パーティクルはマウント時に1回だけ生成（key で再マウント＝再生成される想定）
  const main = useMemo(
    () => genParticles(p.count, cfg.motion, p, cfg.particlePalette),
    [type, lv], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const sparks = useMemo(
    () => genParticles(p.sparks, "burst", p, cfg.particlePalette),
    [type, lv], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const layerVars = {
    "--dur": `${p.durMs}ms`,
    "--flashCore": cfg.flashCore,
    "--flashColor": cfg.flashColor,
  } as React.CSSProperties;

  const coreVars = {
    "--scale": p.scale,
    "--dur": `${p.durMs}ms`,
  } as React.CSSProperties;

  const coreCls = cfg.coreAnchor === "bottom" ? styles.coreBottom : styles.coreCenter;

  return (
    <div className={styles.layer} style={layerVars}>
      <div className={styles.flash} style={{ ["--flash" as string]: p.flash } as React.CSSProperties} />

      <div className={`${styles.core} ${coreCls}`} style={coreVars}>
        <PixelSprite map={cfg.frameA} colors={cfg.colors} />
        <PixelSprite map={cfg.frameB} colors={cfg.colors} className={styles.frameB} />
      </div>

      {main.map((pt) => (
        <ParticleSpan key={`m${pt.id}`} p={pt} />
      ))}
      {sparks.map((pt) => (
        <ParticleSpan key={`s${pt.id}`} p={pt} />
      ))}
    </div>
  );
}
