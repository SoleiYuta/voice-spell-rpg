"use client";

// 第2部：ヴァンサバモード（Canvas + requestAnimationFrame ・ドット絵演出）。
// ラウンド制：durationSec 秒生存でクリア → onLevelUp（詠唱で新呪文→新武器）→ 次ラウンド(敵強化・全回復)。
// MAX_LEVEL 制覇で victory、HP0 で defeat。
// 属性ごとに攻撃の挙動が違う：
//   炎=自機から立ち昇るピクセル炎アウラ(周囲へ持続ダメージ) / 氷=高速落下する氷塊(広範囲着弾)
//   雷=最寄りから連鎖する即着弾の電撃(弾なし) / 闇=ブラックホール(吸込+継続) / 光=全方位レーザー
//   風=竜巻(敵をノックバック+軽ダメージ)
// 操作: ドラッグ/タッチで移動（PCは矢印/WASDも可）。攻撃は自動。

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Weapon } from "@/lib/useGame";
import { sfx } from "@/lib/sfx";
import styles from "./SurvivalMode.module.css";

export interface SurvivalModeProps {
  weapons: Weapon[];
  durationSec: number;
  paused: boolean;
  onLevelUp: (nextLevel: number) => void;
  onFinish: (outcome: "victory" | "defeat") => void;
  debug?: boolean;
}

const W = 360;
const H = 520;
const MAX_LEVEL = 5;
const BOSS_HP = 4000; // Lv5の最終ボス（黄色巨大スライム）のHP。倒すとクリア。
const BASE_HP = 43;       // Lv1（1階）の基礎HP
const FLOOR_HP_MUL = 1.3; // 階が上がるごとの敵HP倍率（30秒=1階ごとに1.3倍）

type Elem = "fire" | "ice" | "thunder" | "dark" | "light" | "wind";
const ELEM_ALIAS: Record<string, Elem> = {
  fire: "fire", flame: "fire", 炎: "fire",
  ice: "ice", water: "ice", frost: "ice", 氷: "ice",
  thunder: "thunder", lightning: "thunder", 雷: "thunder",
  dark: "dark", shadow: "dark", 闇: "dark",
  light: "light", 光: "light",
  wind: "wind", 風: "wind",
};
function toElem(t?: string): Elem { return ELEM_ALIAS[(t || "").toLowerCase()] ?? "dark"; }
const PALETTE: Record<Elem, string[]> = {
  fire: ["#fff2a0", "#ffb43c", "#ff5a2f", "#c81e0a"],
  ice: ["#ffffff", "#bff0ff", "#66c8f5", "#2b8fd6"],
  thunder: ["#ffffff", "#fff59a", "#ffd21e", "#f0a500"],
  dark: ["#e6c8ff", "#b06bff", "#7a3fd0", "#4a1f8a"],
  light: ["#ffffff", "#fff3b0", "#ffe066", "#f2c94c"],
  wind: ["#eafff0", "#a6f0c0", "#5ad98a", "#2fa866"],
};
const FIRE_INTERVAL: Record<Elem, number> = {
  fire: 0.9, ice: 0.8, thunder: 0.5, dark: 1.5, light: 1.1, wind: 0.9,
};

// 敵タイプ別の色 [濃い縁, 本体]。0=雑魚(赤) / 1=速い小型(橙) / 2=硬い大型(紫)
const ENEMY_COL: string[][] = [
  ["#8a1810", "#c8341a"],
  ["#c8781a", "#ffb43c"],
  ["#3a1a6a", "#7a3fd0"],
];

// 炎ドット絵（プレイヤーから立ち昇る）。R=赤 O=橙 Y=黄 W=芯
const FLAME_COL: Record<string, string> = { R: "#e01e0a", O: "#ff8c1a", Y: "#ffd21e", W: "#fff2a0" };
const FLAME = [
  "....R....",
  "...RR....",
  "..R.RR...",
  "..RRRR...",
  ".RRROOR..",
  ".RROOOR..",
  "RROOOOOR.",
  "ROOOYOOR.",
  "ROOYYYOR.",
  "ROYYYYYOR",
  "ROYYWYYOR",
  ".ROYYYOR.",
  ".RROOORR.",
  "..RRRRR..",
];

interface Enemy { x: number; y: number; hp: number; maxHp: number; r: number; speed: number; flash: number; type: number; boss?: boolean; stompCd?: number; stompPhase?: number; sx?: number; sy?: number; sT?: number; }
interface Shot { x: number; y: number; vx: number; vy: number; dmg: number; el: Elem; life: number; hit: Set<Enemy>; }
interface DamageText { x: number; y: number; vy: number; life: number; max: number; text: string; color: string; } // 命中ダメージ数字
interface Ring { x: number; y: number; r: number; life: number; max: number; color: string; } // 撃破の弾けリング
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
interface Bolt { pts: { x: number; y: number }[]; life: number; max: number; color: string; }
interface IceFall { x: number; y: number; vy: number; targetY: number; dmg: number; done: boolean; }
interface Hole { x: number; y: number; life: number; max: number; dmg: number; r: number; }
interface Beam { x: number; y: number; angle: number; life: number; max: number; dmg: number; hit: Set<Enemy>; }
interface Tornado { x: number; y: number; angle: number; speed: number; age: number; dmg: number; r: number; }
interface Flame { x: number; y: number; vx: number; vy: number; moveTime: number; stopLife: number; dmg: number; r: number; } // 炎弾（途中で止まって燃え続ける）
interface Gem { x: number; y: number; collected?: boolean; } // XPジェム（撃破ドロップ）

interface World {
  player: { x: number; y: number; hp: number; maxHp: number; r: number; face: number };
  enemies: Enemy[];
  shots: Shot[];
  particles: Particle[];
  bolts: Bolt[];
  iceFalls: IceFall[];
  holes: Hole[];
  beams: Beam[];
  tornados: Tornado[];
  flames: Flame[];
  damageTexts: DamageText[];
  rings: Ring[];
  gems: Gem[];
  xp: number;
  xpNext: number;
  plevel: number;   // カード強化レベル
  dmgMul: number;   // 威力倍率
  fireMul: number;  // 発射間隔倍率(小さいほど速い)
  spdMul: number;   // 移動速度倍率
  boss: Enemy | null;   // Lv5ボス（enemies[]にも入れて全武器で殴れる）
  bossPhase: boolean;   // ボス戦中
  victoryT: number;     // 勝利演出タイマー(>0の間はエフェクトだけ流す)
  kills: number;
  elapsed: number;
  spawnTimer: number;
  fireAt: Record<string, number>;
  awaitingLevel: boolean;
  shake: number;
  hurt: number;
  flash: number;
  flashEl: Elem;
  finished: boolean;
}

// レベルUPで選べる強化カード
interface CardOpt { key: string; label: string; desc: string; color: string; apply: (w: World) => void; }
const CARD_POOL: CardOpt[] = [
  { key: "dmg", label: "威力 +25%", desc: "全魔法のダメージ", color: "#ff5a3c", apply: (w) => { w.dmgMul *= 1.25; } },
  { key: "rate", label: "連射 +18%", desc: "発射が速くなる", color: "#ffd54f", apply: (w) => { w.fireMul *= 0.85; } },
  { key: "spd", label: "移動 +15%", desc: "逃げやすくなる", color: "#5ad98a", apply: (w) => { w.spdMul *= 1.15; } },
  { key: "hp", label: "最大HP +25", desc: "打たれ強く＋回復", color: "#ff6b8a", apply: (w) => { w.player.maxHp += 25; w.player.hp += 25; } },
  { key: "heal", label: "HP回復 +40", desc: "その場で回復", color: "#7be495", apply: (w) => { w.player.hp = Math.min(w.player.maxHp, w.player.hp + 40); } },
];
function rollCards(): CardOpt[] {
  const pool = [...CARD_POOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3);
}

export default function SurvivalMode({
  weapons,
  durationSec,
  paused,
  onLevelUp,
  onFinish,
  debug = false,
}: SurvivalModeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<World | null>(null);
  const internalPaused = useRef(false); // カード選択中はワールドを凍結
  const [cards, setCards] = useState<CardOpt[] | null>(null);

  // カードを選ぶ → 効果適用 → 再開
  const pickCard = (c: CardOpt) => {
    const w = worldRef.current;
    if (w) {
      c.apply(w);
      w.xp = Math.max(0, w.xp - w.xpNext);
      w.xpNext += 4;
      w.plevel += 1;
    }
    setCards(null);
    internalPaused.current = false;
  };

  const weaponsRef = useRef(weapons);
  const pausedRef = useRef(paused);
  const durRef = useRef(durationSec);
  const onLevelUpRef = useRef(onLevelUp);
  const onFinishRef = useRef(onFinish);
  const debugRef = useRef(debug);
  const prevWeaponCount = useRef(weapons.length);

  useEffect(() => { weaponsRef.current = weapons; }, [weapons]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { debugRef.current = debug; }, [debug]);
  useEffect(() => { durRef.current = durationSec; }, [durationSec]);
  useEffect(() => { onLevelUpRef.current = onLevelUp; }, [onLevelUp]);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  useEffect(() => {
    if (weapons.length > prevWeaponCount.current) {
      const w = worldRef.current;
      if (w) {
        w.elapsed = 0;
        w.enemies = []; w.shots = []; w.iceFalls = []; w.holes = []; w.beams = []; w.tornados = []; w.flames = [];
        w.damageTexts = []; w.rings = []; w.gems = []; // 強化(xp/倍率)はラウンド跨ぎで保持、ジェムだけ掃除
        w.boss = null; w.bossPhase = false; w.victoryT = 0;
        w.spawnTimer = 0;
        w.awaitingLevel = false;
        w.player.hp = w.player.maxHp;
        w.player.x = W / 2; w.player.y = H / 2;
        w.hurt = 0;
        w.flash = 1;
        w.flashEl = toElem(weapons[weapons.length - 1]?.spell_type);
      }
      prevWeaponCount.current = weapons.length;
    }
  }, [weapons]);

  const pointer = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const keys = useRef<Set<string>>(new Set());

  useEffect(() => {
    worldRef.current = {
      player: { x: W / 2, y: H / 2, hp: 100, maxHp: 100, r: 12, face: 1 },
      enemies: [], shots: [], particles: [], bolts: [], iceFalls: [], holes: [], beams: [], tornados: [], flames: [],
      damageTexts: [], rings: [], gems: [],
      xp: 0, xpNext: 5, plevel: 0, dmgMul: 1, fireMul: 1, spdMul: 1,
      boss: null, bossPhase: false, victoryT: 0,
      kills: 0, elapsed: 0, spawnTimer: 0, fireAt: {},
      awaitingLevel: false, shake: 0, hurt: 0, flash: 1, flashEl: toElem(weapons[0]?.spell_type),
      finished: false,
    };

    const canvas = canvasRef.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    const toLocal = (cx: number, cy: number) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ((cx - rect.left) / rect.width) * W, y: ((cy - rect.top) / rect.height) * H };
    };
    const onDown = (e: PointerEvent) => { e.preventDefault(); const p = toLocal(e.clientX, e.clientY); pointer.current = { active: true, x: p.x, y: p.y }; };
    const onMove = (e: PointerEvent) => { if (!pointer.current.active) return; const p = toLocal(e.clientX, e.clientY); pointer.current.x = p.x; pointer.current.y = p.y; };
    const onUp = () => { pointer.current.active = false; };
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) {
        e.preventDefault();
        if (down) keys.current.add(k); else keys.current.delete(k);
      }
    };
    const kd = onKey(true), ku = onKey(false);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    const PLAYER_SPEED = 135;
    let raf = 0;
    let prev = performance.now();

    const px = (x: number, y: number, s: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), Math.round(s), Math.round(s));
    };

    const spawnEnemy = (w: World, level: number) => {
      const edge = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      if (edge === 0) { x = Math.random() * W; y = -14; }
      else if (edge === 1) { x = W + 14; y = Math.random() * H; }
      else if (edge === 2) { x = Math.random() * W; y = H + 14; }
      else { x = -14; y = Math.random() * H; }
      const baseHp = BASE_HP * Math.pow(FLOOR_HP_MUL, level - 1) + w.elapsed * 0.8; // 階ごとに×1.3（+経過時間で微増）
      const baseSpeed = 40 + level * 4 + Math.random() * 24;
      const roll = Math.random();
      let type = 0, r = 11, hp = baseHp, speed = baseSpeed;
      if (level >= 3 && roll > 0.86) { type = 2; r = 16; hp = baseHp * 2.2; speed = baseSpeed * 0.62; } // 硬い大型
      else if (level >= 2 && roll < 0.28) { type = 1; r = 8; hp = baseHp * 0.6; speed = baseSpeed * 1.5; } // 速い小型
      w.enemies.push({ x, y, hp, maxHp: hp, r, speed, flash: 0, type });
    };

    const spawnBoss = (w: World) => {
      const b: Enemy = {
        x: W / 2, y: -40, hp: BOSS_HP, maxHp: BOSS_HP, r: 40, speed: 30, flash: 0, type: 3,
        boss: true, stompCd: 2.2, stompPhase: 0, sx: 0, sy: 0, sT: 0,
      };
      w.boss = b; w.enemies.push(b);
      w.flash = 1; w.flashEl = "light"; w.shake = 10;
    };

    // 視覚エフェクトの更新（通常stepの末尾と勝利演出中の両方で使う）
    const updateFX = (w: World, dt: number) => {
      for (const pt of w.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.9; pt.vy *= 0.9; pt.life -= dt; }
      w.particles = w.particles.filter((p) => p.life > 0);
      for (const b of w.bolts) b.life -= dt;
      w.bolts = w.bolts.filter((b) => b.life > 0);
      for (const d of w.damageTexts) { d.y += d.vy * dt; d.vy *= 0.9; d.life -= dt; }
      w.damageTexts = w.damageTexts.filter((d) => d.life > 0);
      for (const rg of w.rings) { rg.r += 130 * dt; rg.life -= dt; }
      w.rings = w.rings.filter((rg) => rg.life > 0);
      w.shake = Math.max(0, w.shake - 26 * dt);
      w.hurt = Math.max(0, w.hurt - 2 * dt);
      w.flash = Math.max(0, w.flash - 2 * dt);
    };

    const burst = (w: World, x: number, y: number, el: Elem, n: number, speed: number) => {
      const pal = PALETTE[el];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = speed * (0.35 + Math.random() * 0.65);
        let vy = Math.sin(a) * sp;
        if (el === "fire") vy -= 30 + Math.random() * 40;
        w.particles.push({
          x, y, vx: Math.cos(a) * sp, vy,
          life: 0.3 + Math.random() * 0.4, max: 0.7,
          color: pal[1 + Math.floor(Math.random() * 3)], size: 2 + Math.floor(Math.random() * 3),
        });
      }
      if (w.particles.length > 380) w.particles.splice(0, w.particles.length - 380);
    };

    const makeBolt = (w: World, x1: number, y1: number, x2: number, y2: number, color: string) => {
      const seg = 6;
      const pts: { x: number; y: number }[] = [];
      const nx = -(y2 - y1), ny = x2 - x1;
      const nl = Math.hypot(nx, ny) || 1;
      for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        const j = i === 0 || i === seg ? 0 : (Math.random() - 0.5) * 18;
        pts.push({ x: x1 + (x2 - x1) * t + (nx / nl) * j, y: y1 + (y2 - y1) * t + (ny / nl) * j });
      }
      w.bolts.push({ pts, life: 0.14, max: 0.14, color });
    };

    const dropGem = (w: World, x: number, y: number) => { w.gems.push({ x, y }); };

    const hitEnemy = (w: World, e: Enemy, dmg: number, el: Elem, fromX?: number, fromY?: number) => {
      if (e.hp <= 0) return;
      e.hp -= dmg;
      e.flash = 0.1; // 被弾で白フラッシュ
      // ダメージ数字（敵の上に浮いて消える）
      w.damageTexts.push({ x: e.x, y: e.y - e.r - 2, vy: -34, life: 0.6, max: 0.6, text: String(Math.round(dmg)), color: PALETTE[el][0] });
      // ノックバック（発生源から外向き。既定はプレイヤー方向）。ボスは動じない。
      if (!e.boss) {
        const sx = fromX ?? w.player.x, sy = fromY ?? w.player.y;
        const kx = e.x - sx, ky = e.y - sy, kd = Math.hypot(kx, ky) || 1;
        e.x += (kx / kd) * 6; e.y += (ky / kd) * 6;
      }
      burst(w, e.x, e.y, el, 6, 130);
      if (e.hp <= 0) {
        w.kills += 1;
        dropGem(w, e.x, e.y);
        burst(w, e.x, e.y, el, 20, 210);
        w.rings.push({ x: e.x, y: e.y, r: e.r, life: 0.2, max: 0.2, color: "#ffffff" }); // 撃破の白リング
        w.shake = Math.min(8, w.shake + 3);
        if (el === "ice") for (let k = 0; k < 5; k++) burst(w, e.x, e.y, "ice", 3, 90);
      } else {
        sfx.playHit();
      }
    };

    const step = (dt: number, w: World) => {
      const level = weaponsRef.current.length;
      w.elapsed += dt;
      const kills0 = w.kills; // このフレームで撃破が増えたら効果音（throttle済み）

      // 勝利演出中：エフェクトだけ流して、終わったら onFinish("victory")
      if (w.victoryT > 0) {
        w.victoryT -= dt;
        if (Math.random() < 0.7) burst(w, Math.random() * W, Math.random() * H, (["fire", "light", "thunder", "ice", "wind", "dark"] as Elem[])[Math.floor(Math.random() * 6)], 12, 300);
        updateFX(w, dt);
        if (w.victoryT <= 0 && !w.finished) { w.finished = true; onFinishRef.current("victory"); }
        return;
      }

      if (!debugRef.current && !w.finished && w.player.hp <= 0) { w.finished = true; onFinishRef.current("defeat"); return; }
      if (!debugRef.current && !w.finished && !w.bossPhase && w.elapsed >= durRef.current) {
        if (!w.awaitingLevel) {
          if (level < MAX_LEVEL) { w.awaitingLevel = true; onLevelUpRef.current(level + 1); return; }
          w.bossPhase = true; spawnBoss(w); // Lv5: ボス出現。以降は通常stepを継続し、撃破で勝利
        }
      }

      // 移動
      let dx = 0, dy = 0;
      if (pointer.current.active) {
        dx = pointer.current.x - w.player.x; dy = pointer.current.y - w.player.y;
        if (Math.hypot(dx, dy) < 4) { dx = 0; dy = 0; }
      } else {
        if (keys.current.has("arrowleft") || keys.current.has("a")) dx -= 1;
        if (keys.current.has("arrowright") || keys.current.has("d")) dx += 1;
        if (keys.current.has("arrowup") || keys.current.has("w")) dy -= 1;
        if (keys.current.has("arrowdown") || keys.current.has("s")) dy += 1;
      }
      const len = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.01) w.player.face = dx > 0 ? 1 : -1; // 向き更新
      if (len > 0) { const sp = PLAYER_SPEED * w.spdMul; w.player.x += (dx / len) * sp * dt; w.player.y += (dy / len) * sp * dt; }
      w.player.x = Math.max(w.player.r, Math.min(W - w.player.r, w.player.x));
      w.player.y = Math.max(w.player.r, Math.min(H - w.player.r, w.player.y));

      // スポーン
      w.spawnTimer -= dt;
      // 湧き密度をレベル連動で増加（Lv1≒2倍 → Lv5≒4倍）。序盤はフェア、最終ラウンドで大群。上限240体。
      const spawnMul = Math.min(4, 2 + (level - 1) * 0.5);
      const spawnInterval = Math.max(0.08, (1.2 - level * 0.1 - w.elapsed * 0.02) / spawnMul);
      if (w.spawnTimer <= 0 && w.enemies.length < 240 && !w.bossPhase) { spawnEnemy(w, level); w.spawnTimer = spawnInterval; }

      // 敵移動＆接触
      for (const e of w.enemies) {
        if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
        if (e.boss) continue; // ボスは専用ロジックで動かす
        const ex = w.player.x - e.x, ey = w.player.y - e.y;
        const d = Math.hypot(ex, ey) || 1;
        e.x += (ex / d) * e.speed * dt; e.y += (ey / d) * e.speed * dt;
        if (d < e.r + w.player.r) { if (!debugRef.current) { w.player.hp -= 16 * dt; w.hurt = Math.min(1, w.hurt + 3 * dt); } w.shake = Math.min(8, w.shake + 16 * dt); }
      }

      // ボス（黄色巨大スライム）：ゆっくり接近＋踏みつけ攻撃
      if (w.boss && w.boss.hp > 0) {
        const b = w.boss;
        if (b.stompPhase === 1) {
          // 溜め（動かない）→ 着地でAoE
          b.sT = (b.sT ?? 0) - dt;
          if ((b.sT ?? 0) <= 0) {
            const hit = Math.hypot(w.player.x - (b.sx ?? 0), w.player.y - (b.sy ?? 0)) < 66 + w.player.r;
            if (hit && !debugRef.current) { w.player.hp -= 34; w.hurt = 1; }
            w.shake = Math.min(12, w.shake + 11);
            burst(w, b.sx ?? 0, b.sy ?? 0, "light", 30, 300); // 着地の衝撃波
            w.rings.push({ x: b.sx ?? 0, y: b.sy ?? 0, r: 12, life: 0.4, max: 0.4, color: "#ffd54f" });
            b.stompPhase = 0; b.stompCd = 2.3;
          }
        } else {
          const ex = w.player.x - b.x, ey = w.player.y - b.y, d = Math.hypot(ex, ey) || 1;
          b.x += (ex / d) * b.speed * dt; b.y += (ey / d) * b.speed * dt;
          b.stompCd = (b.stompCd ?? 0) - dt;
          if ((b.stompCd ?? 0) <= 0) { b.stompPhase = 1; b.sx = w.player.x; b.sy = w.player.y; b.sT = 0.7; } // プレイヤー位置を狙って溜め
        }
      }

      // 自動攻撃（属性ごとに挙動が違う）
      const SHOT_SPEED = 330;
      for (const weapon of weaponsRef.current) {
        const el = toElem(weapon.spell_type);
        const dmg = weapon.damage * w.dmgMul; // カード強化を反映
        w.fireAt[weapon.id] = (w.fireAt[weapon.id] ?? 0) - dt;
        if (w.fireAt[weapon.id] > 0) continue;
        let best: Enemy | null = null, bestD = Infinity;
        for (const e of w.enemies) {
          const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (!best) continue;

        if (el === "fire") {
          // 火を敵へゆっくり撃つ → 途中で止まり、止まったら2秒その場で燃え続ける（範囲持続ダメージ）
          const a = Math.atan2(best.y - w.player.y, best.x - w.player.x);
          w.flames.push({ x: w.player.x, y: w.player.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, moveTime: 0.9, stopLife: 2.0, dmg: dmg, r: 32 });
        } else if (el === "ice") {
          // 高速落下する氷塊：最寄り最大2体の頭上から
          const targets = [...w.enemies]
            .sort((p, q) => Math.hypot(p.x - w.player.x, p.y - w.player.y) - Math.hypot(q.x - w.player.x, q.y - w.player.y))
            .slice(0, 2);
          for (const t of targets) w.iceFalls.push({ x: t.x, y: -20, vy: 1150, targetY: t.y, dmg: dmg, done: false });
        } else if (el === "thunder") {
          // 弾なしの即着弾・連鎖電撃（最寄りから最大3体）
          let cur = { x: w.player.x, y: w.player.y };
          const used = new Set<Enemy>();
          for (let i = 0; i < 3; i++) {
            let n: Enemy | null = null, nd = Infinity;
            for (const e of w.enemies) {
              if (e.hp <= 0 || used.has(e)) continue;
              const d = Math.hypot(e.x - cur.x, e.y - cur.y);
              if (d < nd) { nd = d; n = e; }
            }
            if (!n) break;
            makeBolt(w, cur.x, cur.y, n.x, n.y, PALETTE.thunder[0]);
            hitEnemy(w, n, dmg, "thunder");
            used.add(n); cur = n;
          }
          w.shake = Math.min(8, w.shake + 2);
        } else if (el === "dark") {
          w.holes.push({ x: best.x, y: best.y, life: 1.4, max: 1.4, dmg: dmg, r: 74 });
        } else if (el === "light") {
          const base = Math.random() * Math.PI;
          const N = 8;
          for (let i = 0; i < N; i++) w.beams.push({ x: w.player.x, y: w.player.y, angle: base + (i / N) * Math.PI * 2, life: 0.18, max: 0.18, dmg: dmg, hit: new Set<Enemy>() });
        } else if (el === "wind") {
          // 竜巻：発生してランダムに移動（場外に出たら消滅）。触れた敵をノックバック
          w.tornados.push({ x: best.x, y: best.y, angle: Math.random() * Math.PI * 2, speed: 80, age: 0, dmg: dmg, r: 62 });
        } else {
          const a = Math.atan2(best.y - w.player.y, best.x - w.player.x);
          w.shots.push({ x: w.player.x, y: w.player.y, vx: Math.cos(a) * SHOT_SPEED, vy: Math.sin(a) * SHOT_SPEED, dmg: dmg, el, life: 2.2, hit: new Set<Enemy>() });
        }
        burst(w, w.player.x, w.player.y, el, 4, 80);
        sfx.playAttack(el); // 属性ごとの発射音
        w.fireAt[weapon.id] = (FIRE_INTERVAL[el] ?? 0.7) * w.fireMul;
      }

      // 貫通弾（フォールバック用）
      for (const s of w.shots) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        for (const e of w.enemies) {
          if (e.hp <= 0 || s.hit.has(e)) continue;
          if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + 4) { s.hit.add(e); hitEnemy(w, e, s.dmg, s.el); }
        }
      }
      w.shots = w.shots.filter((s) => s.life > 0 && s.x > -20 && s.x < W + 20 && s.y > -20 && s.y < H + 20);

      // 炎ゾーン：途中で止まり、止まったら2秒その場で燃え続ける（範囲持続ダメージ）
      for (const fl of w.flames) {
        if (fl.moveTime > 0) { fl.x += fl.vx * dt; fl.y += fl.vy * dt; fl.moveTime -= dt; }
        else fl.stopLife -= dt;
        for (const e of w.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - fl.x, e.y - fl.y) < fl.r + e.r) {
            e.hp -= fl.dmg * dt * 3.5;
            if (e.hp <= 0) { w.kills += 1; dropGem(w, e.x, e.y); burst(w, e.x, e.y, "fire", 18, 200); w.shake = Math.min(8, w.shake + 3); }
          }
        }
        if (Math.random() < 0.5) burst(w, fl.x + (Math.random() - 0.5) * fl.r, fl.y + (Math.random() - 0.5) * fl.r, "fire", 1, 25);
      }
      w.flames = w.flames.filter((f) => f.stopLife > 0);

      // 落下氷塊：着弾で広範囲ダメージ
      for (const ic of w.iceFalls) {
        ic.y += ic.vy * dt;
        if (!ic.done && ic.y >= ic.targetY) {
          ic.done = true;
          for (const e of w.enemies) if (Math.hypot(e.x - ic.x, e.y - ic.targetY) < 52) hitEnemy(w, e, ic.dmg, "ice");
          burst(w, ic.x, ic.targetY, "ice", 22, 240);
          w.shake = Math.min(8, w.shake + 3);
        }
      }
      w.iceFalls = w.iceFalls.filter((ic) => !ic.done && ic.y < H + 40);

      // ブラックホール：吸い込み＋継続ダメージ
      for (const ho of w.holes) {
        ho.life -= dt;
        for (const e of w.enemies) {
          if (e.hp <= 0) continue;
          const hx = ho.x - e.x, hy = ho.y - e.y;
          const d = Math.hypot(hx, hy) || 1;
          if (d < ho.r) {
            e.x += (hx / d) * 150 * dt; e.y += (hy / d) * 150 * dt;
            if (d < ho.r * 0.6) {
              e.hp -= ho.dmg * dt * 2.5;
              if (e.hp <= 0) { w.kills += 1; dropGem(w, e.x, e.y); burst(w, e.x, e.y, "dark", 18, 200); w.shake = Math.min(8, w.shake + 3); }
            }
          }
        }
        const a = Math.random() * Math.PI * 2, rr = ho.r * (0.4 + Math.random() * 0.6);
        w.particles.push({ x: ho.x + Math.cos(a) * rr, y: ho.y + Math.sin(a) * rr, vx: -Math.cos(a) * 90, vy: -Math.sin(a) * 90, life: 0.4, max: 0.7, color: PALETTE.dark[1], size: 2 + Math.random() * 2 });
      }
      w.holes = w.holes.filter((h) => h.life > 0);

      // 全方位レーザー
      for (const bm of w.beams) {
        bm.life -= dt;
        const dxu = Math.cos(bm.angle), dyu = Math.sin(bm.angle);
        for (const e of w.enemies) {
          if (e.hp <= 0 || bm.hit.has(e)) continue;
          const vx = e.x - bm.x, vy = e.y - bm.y;
          const proj = vx * dxu + vy * dyu;
          if (proj <= 0 || proj > 480) continue;
          if (Math.abs(vx * dyu - vy * dxu) < e.r + 6) { bm.hit.add(e); hitEnemy(w, e, bm.dmg, "light"); }
        }
      }
      w.beams = w.beams.filter((b) => b.life > 0);

      // 竜巻：ランダムに移動しつつ、触れた敵を外向きにノックバック＋軽ダメージ。場外で消滅。
      for (const to of w.tornados) {
        to.age += dt;
        to.angle += (Math.random() - 0.5) * 2.5 * dt; // ゆらぎ（ランダムウォーク）
        to.x += Math.cos(to.angle) * to.speed * dt;
        to.y += Math.sin(to.angle) * to.speed * dt;
        for (const e of w.enemies) {
          if (e.hp <= 0) continue;
          const tx = e.x - to.x, ty = e.y - to.y;
          const d = Math.hypot(tx, ty) || 1;
          if (d < to.r) {
            e.x += (tx / d) * 220 * dt; e.y += (ty / d) * 220 * dt; // 外向きノックバック
            e.hp -= to.dmg * dt * 2.6; // バランス調整（他属性と揃える）
            if (e.hp <= 0) { w.kills += 1; dropGem(w, e.x, e.y); burst(w, e.x, e.y, "wind", 16, 190); w.shake = Math.min(8, w.shake + 2); }
          }
        }
      }
      const TM = 80; // 場外マージン
      w.tornados = w.tornados.filter((t) => t.age < 8 && t.x > -TM && t.x < W + TM && t.y > -TM && t.y < H + TM);

      if (w.kills > kills0) sfx.playKill();

      // 死亡敵の一括除去
      w.enemies = w.enemies.filter((e) => e.hp > 0);

      // ボス撃破 → クリア（大量エフェクト演出へ）
      if (w.bossPhase && w.boss && w.boss.hp <= 0 && w.victoryT <= 0 && !w.finished) {
        const bx = w.boss.x, by = w.boss.y;
        w.enemies = w.enemies.filter((e) => !e.boss);
        for (let k = 0; k < 10; k++) burst(w, bx + (Math.random() - 0.5) * 100, by + (Math.random() - 0.5) * 100, (["fire", "light", "thunder", "ice"] as Elem[])[k % 4], 26, 340);
        for (let k = 0; k < 7; k++) w.rings.push({ x: bx, y: by, r: 8 + k * 12, life: 0.8, max: 0.8, color: "#ffd54f" });
        w.shake = 12; w.flash = 1; w.flashEl = "light";
        w.victoryT = 1.4; // この間、追加エフェクトを撒いてから勝利
        w.boss = null;
      }

      // XPジェム：近づくと吸引→回収でXP。しきい値でカード選択へ
      for (const g of w.gems) {
        const gx = w.player.x - g.x, gy = w.player.y - g.y, gd = Math.hypot(gx, gy) || 1;
        if (gd < 66) { g.x += (gx / gd) * 260 * dt; g.y += (gy / gd) * 260 * dt; }
        if (gd < w.player.r + 5) { g.collected = true; w.xp += 1; }
      }
      w.gems = w.gems.filter((g) => !g.collected);
      if (!debugRef.current && w.xp >= w.xpNext) { internalPaused.current = true; setCards(rollCards()); }

      // 視覚エフェクト更新
      updateFX(w, dt);
    };

    // 炎ドット絵（火弾＝(cx,cy) を中心に描画）
    const drawFlame = (cx: number, cy: number, cs: number) => {
      const cols = FLAME[0].length, rows = FLAME.length;
      const ox = cx - (cols * cs) / 2;
      const oy = cy - (rows * cs) / 2;
      const bob = (Math.random() - 0.5) * 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ch = FLAME[r][c];
          if (ch === ".") continue;
          if (r < 4 && Math.random() < 0.45) continue; // 上部はちらつく
          ctx.fillStyle = FLAME_COL[ch];
          ctx.fillRect(Math.round(ox + c * cs + bob), Math.round(oy + r * cs), Math.ceil(cs), Math.ceil(cs));
        }
      }
    };

    const draw = (ctx: CanvasRenderingContext2D, w: World) => {
      // 背景（中心やや明るい放射グラデ＝のっぺり感を解消）
      const bg = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, H * 0.78);
      bg.addColorStop(0, "#1c1230");
      bg.addColorStop(1, "#0c0716");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      if (w.shake > 0.1) ctx.translate((Math.random() - 0.5) * w.shake, (Math.random() - 0.5) * w.shake);

      ctx.strokeStyle = "rgba(160,107,255,0.07)"; ctx.lineWidth = 1;
      for (let gx = 0; gx <= W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy <= H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      // ブラックホール（暗い核）
      for (const ho of w.holes) {
        const a = ho.life / ho.max;
        ctx.globalAlpha = a;
        ctx.fillStyle = "#0a0512"; ctx.beginPath(); ctx.arc(ho.x, ho.y, ho.r * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = PALETTE.dark[1]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ho.x, ho.y, ho.r * 0.5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 敵（タイプ別の色・影・歩行の上下ボブ）
      for (const e of w.enemies) {
        if (e.boss) {
          // 黄色巨大スライム（ぷるん）＋踏みつけ予告
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.7, e.r * 0.9, e.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
          const wob = Math.sin(w.elapsed * 4) * 3;
          ctx.fillStyle = e.flash > 0 ? "#ffffff" : "#c8961e";
          ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.15, e.r + wob, e.r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = e.flash > 0 ? "#ffffff" : "#ffd54f";
          ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r - 3 + wob, e.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.beginPath(); ctx.ellipse(e.x - e.r * 0.35, e.y - e.r * 0.3, e.r * 0.22, e.r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#3a2a00";
          ctx.beginPath(); ctx.arc(e.x - e.r * 0.3, e.y - e.r * 0.05, 4, 0, Math.PI * 2); ctx.arc(e.x + e.r * 0.3, e.y - e.r * 0.05, 4, 0, Math.PI * 2); ctx.fill();
          if (e.stompPhase === 1) {
            const prog = 1 - (e.sT ?? 0) / 0.7;
            ctx.strokeStyle = "rgba(255,80,80,0.9)"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(e.sx ?? 0, e.sy ?? 0, 66, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = `rgba(255,120,60,${0.15 + 0.3 * prog})`;
            ctx.beginPath(); ctx.arc(e.sx ?? 0, e.sy ?? 0, 66 * prog, 0, Math.PI * 2); ctx.fill();
          }
          continue;
        }
        // 影
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.85, e.r * 0.8, e.r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
        const ey = e.y + Math.round(Math.sin(w.elapsed * 9 + e.x) * 1.5); // 歩行ボブ
        if (e.flash > 0) {
          px(e.x, ey, e.r * 2, "#ffffff"); // 被弾フラッシュ（真っ白）
        } else {
          const col = ENEMY_COL[e.type] ?? ENEMY_COL[0];
          px(e.x, ey, e.r * 2, col[0]);
          px(e.x, ey, e.r * 1.5, col[1]);
          const eo = e.r * 0.32;
          px(e.x - eo, ey - 2, 2.5, "#1a0605");
          px(e.x + eo, ey - 2, 2.5, "#1a0605");
        }
        if (e.hp < e.maxHp) {
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(e.x - e.r, ey - e.r - 6, e.r * 2, 3);
          ctx.fillStyle = "#ff8a5c"; ctx.fillRect(e.x - e.r, ey - e.r - 6, e.r * 2 * (e.hp / e.maxHp), 3);
        }
      }

      // プレイヤー（影・移動ボブ・向き反映・杖）
      const p = w.player;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 11, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
      const moving = pointer.current.active || keys.current.size > 0;
      const py = p.y + (moving ? Math.round(Math.sin(w.elapsed * 12) * 1.5) : 0);
      const f = p.face;
      px(p.x + f * 11, py + 1, 3, "#ffd23c"); // 杖（向いてる側）
      px(p.x + f * 11, py - 6, 3, "#e9dcb8");
      px(p.x, py + 2, 20, "#4a1f8a");
      px(p.x, py, 16, "#a06bff");
      px(p.x, py - 12, 14, "#2a1250"); // 帽子
      px(p.x, py - 18, 8, "#2a1250");
      px(p.x - 4 + f * 1.5, py - 1, 3, "#fff"); // 目（向きに寄る）
      px(p.x + 4 + f * 1.5, py - 1, 3, "#fff");

      // ===== 光り物：加算合成 =====
      ctx.globalCompositeOperation = "lighter";

      for (const bm of w.beams) {
        ctx.globalAlpha = bm.life / bm.max;
        ctx.strokeStyle = PALETTE.light[0]; ctx.lineWidth = 3; ctx.shadowColor = PALETTE.light[1]; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(bm.x + Math.cos(bm.angle) * 480, bm.y + Math.sin(bm.angle) * 480); ctx.stroke();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }

      for (const ic of w.iceFalls) { px(ic.x, ic.y, 12, PALETTE.ice[2]); px(ic.x, ic.y, 8, PALETTE.ice[1]); px(ic.x, ic.y, 4, PALETTE.ice[0]); }

      // 竜巻（回転するドット）
      for (const to of w.tornados) {
        const spin = to.age * 16;
        ctx.globalAlpha = 0.9;
        for (let k = 0; k < 9; k++) {
          const ang = spin + (k / 9) * Math.PI * 2;
          const rad = to.r * (0.25 + (k % 3) * 0.28);
          px(to.x + Math.cos(ang) * rad, to.y + Math.sin(ang) * rad, 5, PALETTE.wind[1 + (k % 3)]);
        }
        ctx.globalAlpha = 1;
      }

      for (const b of w.bolts) {
        ctx.globalAlpha = b.life / b.max;
        ctx.strokeStyle = b.color; ctx.lineWidth = 2.5; ctx.shadowColor = b.color; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(b.pts[0].x, b.pts[0].y);
        for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y);
        ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }

      // 炎ゾーン（止まると少し大きく燃える）
      for (const fl of w.flames) drawFlame(fl.x, fl.y, fl.moveTime > 0 ? 2 : 2.5);

      for (const s of w.shots) {
        const pal = PALETTE[s.el];
        ctx.shadowColor = pal[2]; ctx.shadowBlur = 10;
        px(s.x, s.y, 5, pal[2]); px(s.x, s.y, 3, pal[0]);
        ctx.shadowBlur = 0;
      }

      for (const pt of w.particles) { ctx.globalAlpha = Math.max(0, pt.life / pt.max); px(pt.x, pt.y, pt.size, pt.color); }

      // XPジェム（光る水色）
      for (const g of w.gems) {
        ctx.shadowColor = "#4fc3f7"; ctx.shadowBlur = 6;
        px(g.x, g.y, 5, "#8fe3ff"); px(g.x, g.y, 2.5, "#ffffff");
        ctx.shadowBlur = 0;
      }

      // 撃破の白リング（拡大しながらフェード）
      for (const rg of w.rings) {
        ctx.globalAlpha = Math.max(0, rg.life / rg.max);
        ctx.strokeStyle = rg.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // ダメージ数字（世界座標・シェイク内）
      ctx.font = "bold 13px monospace"; ctx.textAlign = "center";
      for (const d of w.damageTexts) {
        ctx.globalAlpha = Math.max(0, d.life / d.max);
        ctx.fillStyle = "#000"; ctx.fillText(d.text, d.x + 1, d.y + 1); // 縁取り
        ctx.fillStyle = d.color; ctx.fillText(d.text, d.x, d.y);
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      if (w.flash > 0.01) { ctx.globalAlpha = w.flash * 0.5; ctx.fillStyle = PALETTE[w.flashEl][1]; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

      // ビネット（外周を暗く＝画面に深み）
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.72);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      // 被ダメージ / 低HP の赤い外周フラッシュ
      const lowPulse = p.hp / p.maxHp <= 0.3 ? 0.22 + 0.18 * Math.abs(Math.sin(w.elapsed * 6)) : 0;
      const red = Math.max(w.hurt, lowPulse);
      if (red > 0.01) {
        const rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
        rg.addColorStop(0, "rgba(255,0,0,0)");
        rg.addColorStop(1, `rgba(255,30,30,${Math.min(0.6, red)})`);
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      }

      // ===== HUD =====
      // 上部パネル
      ctx.fillStyle = "rgba(10,6,20,0.45)"; ctx.fillRect(0, 0, W, 40);

      // XPバー（最上部・全幅）
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, 4);
      ctx.fillStyle = "#4fc3f7"; ctx.fillRect(0, 0, W * Math.min(1, w.xp / w.xpNext), 4);

      // HPバー（❤＋数値・低HPで点滅）
      const hpPct = Math.max(0, p.hp / p.maxHp);
      const lowHp = hpPct <= 0.3;
      const barX = 26, barW = 118, barY = 12, barH = 10;
      ctx.textAlign = "left"; ctx.font = "13px monospace"; ctx.fillStyle = "#ff6b8a";
      ctx.fillText("❤", 8, 22);
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(barX, barY, barW, barH);
      const hpCol = lowHp ? "#ff4d4d" : hpPct < 0.6 ? "#ffd54f" : "#5ce08a";
      ctx.globalAlpha = lowHp ? 0.55 + 0.45 * Math.sin(w.elapsed * 9) : 1;
      ctx.fillStyle = hpCol; ctx.fillRect(barX, barY, barW * hpPct, barH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barW, barH);
      ctx.fillStyle = "#fff"; ctx.font = "10px monospace"; ctx.fillText(`${Math.ceil(Math.max(0, p.hp))}`, barX + barW + 5, 21);

      // 中央大タイマー（残り5秒で赤点滅）
      const leftT = Math.max(0, Math.ceil(durRef.current - w.elapsed));
      const danger = leftT <= 5;
      ctx.textAlign = "center"; ctx.font = "bold 26px monospace";
      ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 4;
      ctx.fillStyle = danger ? `rgba(255,80,80,${0.6 + 0.4 * Math.sin(w.elapsed * 11)})` : "#fff";
      ctx.fillText(`${leftT}`, W / 2, 30);
      ctx.shadowBlur = 0;

      // レベル / kill（右上）
      ctx.textAlign = "right";
      ctx.font = "bold 13px monospace"; ctx.fillStyle = "#ffd54f"; ctx.fillText(`Lv ${weaponsRef.current.length}`, W - 8, 17);
      ctx.font = "11px monospace"; ctx.fillStyle = "#eee"; ctx.fillText(`${w.kills} kills`, W - 8, 31);

      // 装備魔法アイコン列（下部）
      const ws = weaponsRef.current;
      if (ws.length) {
        const isz = 18, gap = 6, totalW = ws.length * isz + (ws.length - 1) * gap;
        let ix = (W - totalW) / 2; const iy = H - 24;
        ctx.fillStyle = "rgba(10,6,20,0.5)"; ctx.fillRect(0, H - 30, W, 30);
        for (const wp of ws) {
          ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(ix, iy, isz, isz);
          ctx.fillStyle = wp.color; ctx.fillRect(ix + 3, iy + 3, isz - 6, isz - 6);
          ctx.strokeStyle = wp.color; ctx.lineWidth = 1; ctx.strokeRect(ix + 0.5, iy + 0.5, isz - 1, isz - 1);
          ctx.fillStyle = "#fff"; ctx.font = "8px monospace"; ctx.textAlign = "left";
          ctx.fillText(`${wp.level}`, ix + 1, iy + 8);
          ix += isz + gap;
        }
      }

      // ボスHPバー
      if (w.boss && w.boss.hp > 0) {
        const bw = W - 40, bx = 20, by = 44;
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx, by, bw, 9);
        ctx.fillStyle = "#ffd54f"; ctx.fillRect(bx, by, bw * Math.max(0, w.boss.hp / w.boss.maxHp), 9);
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, 9);
        ctx.fillStyle = "#ffd54f"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.fillText("👑 BOSS", W / 2, by - 2);
      }

      if (debugRef.current) { ctx.textAlign = "left"; ctx.font = "11px monospace"; ctx.fillStyle = "#5ce08a"; ctx.fillText("DEBUG (無敵)", 8, 62); }

      if (pausedRef.current) { ctx.fillStyle = "rgba(10,6,20,0.55)"; ctx.fillRect(0, 0, W, H); }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const w = worldRef.current;
      if (!w) return;
      let dt = (now - prev) / 1000; prev = now;
      if (dt > 0.05) dt = 0.05;
      if (!pausedRef.current && !internalPaused.current && !w.finished) step(dt, w);
      draw(ctx, w);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <div style={{ position: "relative", width: "100%", maxWidth: 380 }}>
        <canvas ref={canvasRef} className={styles.canvas} style={{ aspectRatio: `${W} / ${H}` }} />
        {cards && (
          <div style={cardOverlay}>
            <div style={cardTitle}>⬆ LEVEL UP! 強化を選べ</div>
            <div style={cardCol}>
              {cards.map((c) => (
                <button key={c.key} style={{ ...cardBtn, borderColor: c.color }} onClick={() => pickCard(c)}>
                  <span style={{ color: c.color, fontWeight: 700, fontSize: 15 }}>{c.label}</span>
                  <span style={{ fontSize: 11, opacity: 0.8 }}>{c.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={styles.hint}>ドラッグで移動 / 矢印・WASD可 ・ 攻撃は自動 ・ 30秒生存でレベルUP</div>
      <div className={styles.weapons}>
        {weapons.map((w) => (
          <span key={w.id} className={styles.chip} style={{ borderColor: w.color, color: w.color }}>
            Lv{w.level}・{w.spell_type}・{w.damage}
          </span>
        ))}
      </div>
    </div>
  );
}

// レベルUPカード選択オーバーレイ
const cardOverlay: CSSProperties = {
  position: "absolute", inset: 0, borderRadius: 8,
  background: "rgba(10,6,20,0.82)",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 16,
};
const cardTitle: CSSProperties = { color: "var(--accent)", fontFamily: "var(--pixel-font)", fontSize: 16, textShadow: "0 0 10px var(--accent)" };
const cardCol: CSSProperties = { display: "flex", flexDirection: "column", gap: 10, width: "88%", maxWidth: 300 };
const cardBtn: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 3, alignItems: "center",
  padding: "12px 10px", borderRadius: 8, cursor: "pointer",
  border: "2px solid", background: "rgba(0,0,0,0.45)", color: "#fff", fontFamily: "var(--pixel-font)",
};
