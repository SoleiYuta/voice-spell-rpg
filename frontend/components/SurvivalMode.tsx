"use client";

// 第2部：ヴァンサバモード（Canvas + requestAnimationFrame の自作アクション・ドット絵演出）。
// 詠唱パートで鍛造した武器(=魔法)で、湧く敵を自動攻撃しながら durationSec 秒サバイブする。
// ★ ラウンド制：durationSec 秒 生存でクリア → onLevelUp（詠唱パートで新呪文→新武器追加）
//    → 次ラウンド（敵が強くなる／HP全回復）。HP0 で onFinish("defeat")、最大レベル制覇で "victory"。
// 操作: 画面をドラッグ/タッチした方向へ移動（PCは矢印/WASDも可）。攻撃は自動。
// エフェクトは属性(炎/氷/雷/闇/光/風)ごとのドット絵＋加算合成グローで派手に。

import { useEffect, useRef } from "react";
import type { Weapon } from "@/lib/useGame";
import styles from "./SurvivalMode.module.css";

export interface SurvivalModeProps {
  weapons: Weapon[];
  durationSec: number;
  paused: boolean;
  onLevelUp: (nextLevel: number) => void;
  onFinish: (outcome: "victory" | "defeat") => void;
}

const W = 360;
const H = 520;
const MAX_LEVEL = 5; // これだけラウンドを制覇したら victory（診断へ）

// ===== 属性システム（ドット絵の色 & 挙動）=====
type Elem = "fire" | "ice" | "thunder" | "dark" | "light" | "wind";
const ELEM_ALIAS: Record<string, Elem> = {
  fire: "fire", flame: "fire", 炎: "fire",
  ice: "ice", water: "ice", frost: "ice", 氷: "ice",
  thunder: "thunder", lightning: "thunder", 雷: "thunder",
  dark: "dark", shadow: "dark", 闇: "dark",
  light: "light", 光: "light",
  wind: "wind", 風: "wind",
};
function toElem(t?: string): Elem {
  return ELEM_ALIAS[(t || "").toLowerCase()] ?? "dark";
}
// [core(明), mid, hot, deep(暗)] のドットパレット
const PALETTE: Record<Elem, string[]> = {
  fire: ["#fff2a0", "#ffb43c", "#ff5a2f", "#c81e0a"],
  ice: ["#ffffff", "#bff0ff", "#66c8f5", "#2b8fd6"],
  thunder: ["#ffffff", "#fff59a", "#ffd21e", "#f0a500"],
  dark: ["#e6c8ff", "#b06bff", "#7a3fd0", "#4a1f8a"],
  light: ["#ffffff", "#fff3b0", "#ffe066", "#f2c94c"],
  wind: ["#eafff0", "#a6f0c0", "#5ad98a", "#2fa866"],
};

interface Enemy { x: number; y: number; hp: number; maxHp: number; r: number; speed: number; }
interface Shot { x: number; y: number; vx: number; vy: number; dmg: number; el: Elem; life: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
interface Bolt { pts: { x: number; y: number }[]; life: number; max: number; color: string; }

interface World {
  player: { x: number; y: number; hp: number; maxHp: number; r: number };
  enemies: Enemy[];
  shots: Shot[];
  particles: Particle[];
  bolts: Bolt[];
  kills: number;
  elapsed: number;
  spawnTimer: number;
  fireAt: Record<string, number>;
  awaitingLevel: boolean;
  shake: number;
  flash: number;      // ラウンド開始フラッシュ(0..1)
  flashEl: Elem;
  finished: boolean;
}

export default function SurvivalMode({
  weapons,
  durationSec,
  paused,
  onLevelUp,
  onFinish,
}: SurvivalModeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<World | null>(null);

  const weaponsRef = useRef(weapons);
  const pausedRef = useRef(paused);
  const durRef = useRef(durationSec);
  const onLevelUpRef = useRef(onLevelUp);
  const onFinishRef = useRef(onFinish);
  const prevWeaponCount = useRef(weapons.length);

  useEffect(() => { weaponsRef.current = weapons; }, [weapons]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { durRef.current = durationSec; }, [durationSec]);
  useEffect(() => { onLevelUpRef.current = onLevelUp; }, [onLevelUp]);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  // 新武器が追加された＝レベルUP詠唱が完了 → 次ラウンド開始（敵/弾リセット・HP全回復・フラッシュ）
  useEffect(() => {
    if (weapons.length > prevWeaponCount.current) {
      const w = worldRef.current;
      if (w) {
        w.elapsed = 0;
        w.enemies = [];
        w.shots = [];
        w.spawnTimer = 0;
        w.awaitingLevel = false;
        w.player.hp = w.player.maxHp; // 突破の褒美に全回復
        w.player.x = W / 2; w.player.y = H / 2;
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
      player: { x: W / 2, y: H / 2, hp: 100, maxHp: 100, r: 12 },
      enemies: [], shots: [], particles: [], bolts: [],
      kills: 0, elapsed: 0, spawnTimer: 0, fireAt: {},
      awaitingLevel: false, shake: 0, flash: 1, flashEl: toElem(weapons[0]?.spell_type),
      finished: false,
    };

    const canvas = canvasRef.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false; // ドット絵をくっきり

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

    // ドット（正方形）を整数座標で描く
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
      const hp = 16 + level * 8 + w.elapsed * 0.5;
      w.enemies.push({ x, y, hp, maxHp: hp, r: 11, speed: 40 + level * 4 + Math.random() * 24 });
    };

    // 属性の火花を n 個ばらまく
    const burst = (w: World, x: number, y: number, el: Elem, n: number, speed: number) => {
      const pal = PALETTE[el];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = speed * (0.35 + Math.random() * 0.65);
        let vy = Math.sin(a) * sp;
        if (el === "fire") vy -= 30 + Math.random() * 40; // 炎は立ち昇る
        w.particles.push({
          x, y, vx: Math.cos(a) * sp, vy,
          life: 0.3 + Math.random() * 0.4, max: 0.7,
          color: pal[1 + Math.floor(Math.random() * 3)], size: 2 + Math.floor(Math.random() * 3),
        });
      }
      if (w.particles.length > 320) w.particles.splice(0, w.particles.length - 320);
    };

    // 稲妻（ジグザグ）を生成
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

    const step = (dt: number, w: World) => {
      const level = weaponsRef.current.length;
      w.elapsed += dt;

      // 敗北
      if (!w.finished && w.player.hp <= 0) { w.finished = true; onFinishRef.current("defeat"); return; }
      // ラウンドクリア（30秒生存）→ レベルUP or 制覇
      if (!w.finished && w.elapsed >= durRef.current) {
        if (!w.awaitingLevel) {
          if (level < MAX_LEVEL) { w.awaitingLevel = true; onLevelUpRef.current(level + 1); }
          else { w.finished = true; onFinishRef.current("victory"); }
        }
        return;
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
      if (len > 0) {
        w.player.x += (dx / len) * PLAYER_SPEED * dt;
        w.player.y += (dy / len) * PLAYER_SPEED * dt;
      }
      w.player.x = Math.max(w.player.r, Math.min(W - w.player.r, w.player.x));
      w.player.y = Math.max(w.player.r, Math.min(H - w.player.r, w.player.y));

      // スポーン（レベル＆時間で加速）
      w.spawnTimer -= dt;
      const spawnInterval = Math.max(0.3, 1.2 - level * 0.1 - w.elapsed * 0.02);
      if (w.spawnTimer <= 0) { spawnEnemy(w, level); w.spawnTimer = spawnInterval; }

      // 敵移動＆接触
      for (const e of w.enemies) {
        const ex = w.player.x - e.x, ey = w.player.y - e.y;
        const d = Math.hypot(ex, ey) || 1;
        e.x += (ex / d) * e.speed * dt;
        e.y += (ey / d) * e.speed * dt;
        if (d < e.r + w.player.r) { w.player.hp -= 22 * dt; w.shake = Math.min(8, w.shake + 16 * dt); }
      }

      // 自動発射（各武器→最寄り敵）
      const FIRE_INTERVAL = 0.7;
      const SHOT_SPEED = 330;
      for (const weapon of weaponsRef.current) {
        w.fireAt[weapon.id] = (w.fireAt[weapon.id] ?? 0) - dt;
        if (w.fireAt[weapon.id] > 0) continue;
        let best: Enemy | null = null, bestD = Infinity;
        for (const e of w.enemies) {
          const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (!best) continue;
        const el = toElem(weapon.spell_type);
        const a = Math.atan2(best.y - w.player.y, best.x - w.player.x);
        w.shots.push({ x: w.player.x, y: w.player.y, vx: Math.cos(a) * SHOT_SPEED, vy: Math.sin(a) * SHOT_SPEED, dmg: weapon.damage, el, life: 2.2 });
        burst(w, w.player.x, w.player.y, el, 4, 80); // マズル
        w.fireAt[weapon.id] = FIRE_INTERVAL;
      }

      // 弾移動＆命中
      for (const s of w.shots) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        for (const e of w.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + 4) {
            e.hp -= s.dmg; s.life = 0;
            const pal = PALETTE[s.el];
            burst(w, s.x, s.y, s.el, 7, 150); // 着弾
            if (s.el === "thunder") makeBolt(w, w.player.x, w.player.y, e.x, e.y, pal[0]);
            if (e.hp <= 0) {
              w.kills += 1;
              burst(w, e.x, e.y, s.el, 22, 220); // 撃破バースト（派手）
              w.shake = Math.min(8, w.shake + 4);
              if (s.el === "ice") for (let k = 0; k < 6; k++) burst(w, e.x, e.y, "ice", 3, 90);
            }
            break;
          }
        }
      }
      w.shots = w.shots.filter((s) => s.life > 0 && s.x > -20 && s.x < W + 20 && s.y > -20 && s.y < H + 20);
      w.enemies = w.enemies.filter((e) => e.hp > 0);

      // パーティクル/稲妻/シェイク/フラッシュ 更新
      for (const pt of w.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.9; pt.vy *= 0.9; pt.life -= dt; }
      w.particles = w.particles.filter((p) => p.life > 0);
      for (const b of w.bolts) b.life -= dt;
      w.bolts = w.bolts.filter((b) => b.life > 0);
      w.shake = Math.max(0, w.shake - 26 * dt);
      w.flash = Math.max(0, w.flash - 2 * dt);
    };

    const draw = (ctx: CanvasRenderingContext2D, w: World) => {
      ctx.fillStyle = "#120c1e";
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      if (w.shake > 0.1) ctx.translate((Math.random() - 0.5) * w.shake, (Math.random() - 0.5) * w.shake);

      // グリッド
      ctx.strokeStyle = "rgba(160,107,255,0.07)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy <= H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      // 敵（ドット）
      for (const e of w.enemies) {
        px(e.x, e.y, e.r * 2, "#8a1810");
        px(e.x, e.y, e.r * 1.5, "#c8341a");
        px(e.x - 3.5, e.y - 2, 2.5, "#1a0605");
        px(e.x + 3.5, e.y - 2, 2.5, "#1a0605");
        if (e.hp < e.maxHp) {
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(e.x - e.r, e.y - e.r - 6, e.r * 2, 3);
          ctx.fillStyle = "#ff8a5c"; ctx.fillRect(e.x - e.r, e.y - e.r - 6, e.r * 2 * (e.hp / e.maxHp), 3);
        }
      }

      // プレイヤー（ドット魔導士）
      const p = w.player;
      px(p.x, p.y + 2, 20, "#4a1f8a");
      px(p.x, p.y, 16, "#a06bff");
      px(p.x, p.y - 12, 14, "#2a1250"); // とんがり帽子
      px(p.x, p.y - 18, 8, "#2a1250");
      px(p.x - 4, p.y - 1, 3, "#fff");
      px(p.x + 4, p.y - 1, 3, "#fff");

      // ===== 加算合成で光り物を派手に =====
      ctx.globalCompositeOperation = "lighter";

      // 稲妻
      for (const b of w.bolts) {
        ctx.globalAlpha = b.life / b.max;
        ctx.strokeStyle = b.color; ctx.lineWidth = 2.5; ctx.shadowColor = b.color; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(b.pts[0].x, b.pts[0].y);
        for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y);
        ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }

      // 弾（属性ごとのドット絵）
      for (const s of w.shots) {
        const pal = PALETTE[s.el];
        ctx.shadowColor = pal[2]; ctx.shadowBlur = 10;
        if (s.el === "fire") {
          // 揺らめく炎の塊
          px(s.x, s.y, 6, pal[2]);
          px(s.x + (Math.random() - 0.5) * 4, s.y - 3 + (Math.random() - 0.5) * 3, 4, pal[1]);
          px(s.x, s.y - 1, 3, pal[0]);
        } else if (s.el === "ice") {
          // 氷の結晶（ダイヤ）
          px(s.x, s.y, 4, pal[3]); px(s.x, s.y - 4, 3, pal[1]); px(s.x, s.y + 4, 3, pal[1]);
          px(s.x - 4, s.y, 3, pal[1]); px(s.x + 4, s.y, 3, pal[1]); px(s.x, s.y, 3, pal[0]);
        } else if (s.el === "thunder") {
          // 火花散る電球
          px(s.x, s.y, 5, pal[2]); px(s.x, s.y, 3, pal[0]);
          px(s.x + (Math.random() - 0.5) * 6, s.y + (Math.random() - 0.5) * 6, 2, pal[1]);
        } else {
          px(s.x, s.y, 5, pal[2]); px(s.x, s.y, 3, pal[0]);
        }
        ctx.shadowBlur = 0;
      }

      // パーティクル（ドット）
      for (const pt of w.particles) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.max);
        px(pt.x, pt.y, pt.size, pt.color);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      ctx.restore(); // ここまでシェイク

      // ラウンド開始フラッシュ
      if (w.flash > 0.01) {
        ctx.globalAlpha = w.flash * 0.5;
        ctx.fillStyle = PALETTE[w.flashEl][1];
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      // HUD（揺らさない）
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(10, 10, 150, 12);
      ctx.fillStyle = "#5ce08a"; ctx.fillRect(10, 10, 150 * Math.max(0, p.hp / p.maxHp), 12);
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.strokeRect(10, 10, 150, 12);
      const left = Math.max(0, Math.ceil(durRef.current - w.elapsed));
      ctx.fillStyle = "#fff"; ctx.font = "bold 20px monospace"; ctx.textAlign = "center";
      ctx.fillText(`${left}`, W / 2, 26);
      ctx.font = "12px monospace"; ctx.textAlign = "right";
      ctx.fillStyle = "#ffd54f"; ctx.fillText(`Lv ${weaponsRef.current.length}`, W - 10, 16);
      ctx.fillStyle = "#eee"; ctx.fillText(`${w.kills} kills`, W - 10, 30);

      if (pausedRef.current) { ctx.fillStyle = "rgba(10,6,20,0.55)"; ctx.fillRect(0, 0, W, H); }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const w = worldRef.current;
      if (!w) return;
      let dt = (now - prev) / 1000; prev = now;
      if (dt > 0.05) dt = 0.05;
      if (!pausedRef.current && !w.finished) step(dt, w);
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
      <canvas ref={canvasRef} className={styles.canvas} style={{ aspectRatio: `${W} / ${H}` }} />
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
