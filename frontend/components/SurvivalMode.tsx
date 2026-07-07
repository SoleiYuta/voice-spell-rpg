"use client";

// 第2部：ヴァンサバモード（Canvas + requestAnimationFrame ・ドット絵演出）。
// 詠唱で鍛造した武器(=魔法)で、湧く敵を自動攻撃しながら durationSec 秒サバイブ。
// ★ ラウンド制：durationSec 秒生存でクリア → onLevelUp（詠唱パートで新呪文→新武器追加）
//    → 次ラウンド（敵強化・HP全回復）。MAX_LEVEL 制覇で victory、HP0 で defeat。
// ★ 属性ごとに攻撃の挙動が違う：
//    炎=火柱 / 氷=落下氷塊(範囲) / 雷=貫通弾+稲妻 / 闇=ブラックホール(吸込+継続) / 光=全方位レーザー / 風=貫通弾
// 操作: ドラッグ/タッチした方向へ移動（PCは矢印/WASDも可）。攻撃は自動。

import { useEffect, useRef } from "react";
import type { Weapon } from "@/lib/useGame";
import styles from "./SurvivalMode.module.css";

export interface SurvivalModeProps {
  weapons: Weapon[];
  durationSec: number;
  paused: boolean;
  onLevelUp: (nextLevel: number) => void;
  onFinish: (outcome: "victory" | "defeat") => void;
  /** デバッグ：無敵・レベルUP/敗北なし（エフェクト観察用）。 */
  debug?: boolean;
}

const W = 360;
const H = 520;
const MAX_LEVEL = 5;

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
// 属性ごとの発射間隔（秒）
const FIRE_INTERVAL: Record<Elem, number> = {
  fire: 0.8, ice: 0.85, thunder: 0.6, dark: 1.5, light: 1.1, wind: 0.55,
};

interface Enemy { x: number; y: number; hp: number; maxHp: number; r: number; speed: number; }
interface Shot { x: number; y: number; vx: number; vy: number; dmg: number; el: Elem; life: number; hit: Set<Enemy>; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
interface Bolt { pts: { x: number; y: number }[]; life: number; max: number; color: string; }
interface Pillar { x: number; life: number; max: number; dmg: number; hit: Set<Enemy>; } // 炎の火柱
interface IceFall { x: number; y: number; vy: number; targetY: number; dmg: number; done: boolean; } // 落下氷塊
interface Hole { x: number; y: number; life: number; max: number; dmg: number; r: number; } // ブラックホール
interface Beam { x: number; y: number; angle: number; life: number; max: number; dmg: number; hit: Set<Enemy>; } // 全方位レーザー

interface World {
  player: { x: number; y: number; hp: number; maxHp: number; r: number };
  enemies: Enemy[];
  shots: Shot[];
  particles: Particle[];
  bolts: Bolt[];
  pillars: Pillar[];
  iceFalls: IceFall[];
  holes: Hole[];
  beams: Beam[];
  kills: number;
  elapsed: number;
  spawnTimer: number;
  fireAt: Record<string, number>;
  awaitingLevel: boolean;
  shake: number;
  flash: number;
  flashEl: Elem;
  finished: boolean;
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

  // 新武器追加＝レベルUP完了 → 次ラウンド開始（リセット・全回復・フラッシュ）
  useEffect(() => {
    if (weapons.length > prevWeaponCount.current) {
      const w = worldRef.current;
      if (w) {
        w.elapsed = 0;
        w.enemies = []; w.shots = []; w.pillars = []; w.iceFalls = []; w.holes = []; w.beams = [];
        w.spawnTimer = 0;
        w.awaitingLevel = false;
        w.player.hp = w.player.maxHp;
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
      enemies: [], shots: [], particles: [], bolts: [], pillars: [], iceFalls: [], holes: [], beams: [],
      kills: 0, elapsed: 0, spawnTimer: 0, fireAt: {},
      awaitingLevel: false, shake: 0, flash: 1, flashEl: toElem(weapons[0]?.spell_type),
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
      const hp = 16 + level * 8 + w.elapsed * 0.5;
      w.enemies.push({ x, y, hp, maxHp: hp, r: 11, speed: 40 + level * 4 + Math.random() * 24 });
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
      if (w.particles.length > 360) w.particles.splice(0, w.particles.length - 360);
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

    // 敵にダメージ（撃破時に kill 加算・バースト・シェイク）。全攻撃で共用。
    const hitEnemy = (w: World, e: Enemy, dmg: number, el: Elem) => {
      if (e.hp <= 0) return;
      e.hp -= dmg;
      burst(w, e.x, e.y, el, 6, 130);
      if (e.hp <= 0) {
        w.kills += 1;
        burst(w, e.x, e.y, el, 20, 210);
        w.shake = Math.min(8, w.shake + 3);
        if (el === "ice") for (let k = 0; k < 5; k++) burst(w, e.x, e.y, "ice", 3, 90);
      }
    };

    const step = (dt: number, w: World) => {
      const level = weaponsRef.current.length;
      w.elapsed += dt;

      if (!debugRef.current && !w.finished && w.player.hp <= 0) { w.finished = true; onFinishRef.current("defeat"); return; }
      if (!debugRef.current && !w.finished && w.elapsed >= durRef.current) {
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
      if (len > 0) { w.player.x += (dx / len) * PLAYER_SPEED * dt; w.player.y += (dy / len) * PLAYER_SPEED * dt; }
      w.player.x = Math.max(w.player.r, Math.min(W - w.player.r, w.player.x));
      w.player.y = Math.max(w.player.r, Math.min(H - w.player.r, w.player.y));

      // スポーン
      w.spawnTimer -= dt;
      const spawnInterval = Math.max(0.3, 1.2 - level * 0.1 - w.elapsed * 0.02);
      if (w.spawnTimer <= 0) { spawnEnemy(w, level); w.spawnTimer = spawnInterval; }

      // 敵移動＆接触
      for (const e of w.enemies) {
        const ex = w.player.x - e.x, ey = w.player.y - e.y;
        const d = Math.hypot(ex, ey) || 1;
        e.x += (ex / d) * e.speed * dt; e.y += (ey / d) * e.speed * dt;
        if (d < e.r + w.player.r) { if (!debugRef.current) w.player.hp -= 22 * dt; w.shake = Math.min(8, w.shake + 16 * dt); }
      }

      // 自動攻撃（属性ごとに挙動が違う）
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

        if (el === "fire") {
          // 火柱：敵の位置に縦の炎
          w.pillars.push({ x: best.x, life: 0.55, max: 0.55, dmg: weapon.damage, hit: new Set<Enemy>() });
        } else if (el === "ice") {
          // 落下氷塊：最寄り最大2体の頭上から落とす
          const targets = [...w.enemies]
            .sort((p, q) => Math.hypot(p.x - w.player.x, p.y - w.player.y) - Math.hypot(q.x - w.player.x, q.y - w.player.y))
            .slice(0, 2);
          for (const t of targets) w.iceFalls.push({ x: t.x, y: -20, vy: 430, targetY: t.y, dmg: weapon.damage, done: false });
        } else if (el === "dark") {
          // ブラックホール：敵位置に発生、吸い込み＋継続ダメージ
          w.holes.push({ x: best.x, y: best.y, life: 1.4, max: 1.4, dmg: weapon.damage, r: 74 });
        } else if (el === "light") {
          // 全方位レーザー：プレイヤーから放射状
          const base = Math.random() * Math.PI;
          const N = 10;
          for (let i = 0; i < N; i++) w.beams.push({ x: w.player.x, y: w.player.y, angle: base + (i / N) * Math.PI * 2, life: 0.18, max: 0.18, dmg: weapon.damage, hit: new Set<Enemy>() });
        } else {
          // thunder / wind：貫通弾（thunder は着弾で稲妻）
          const a = Math.atan2(best.y - w.player.y, best.x - w.player.x);
          w.shots.push({ x: w.player.x, y: w.player.y, vx: Math.cos(a) * SHOT_SPEED, vy: Math.sin(a) * SHOT_SPEED, dmg: weapon.damage, el, life: 2.2, hit: new Set<Enemy>() });
        }
        burst(w, w.player.x, w.player.y, el, 4, 80); // マズル
        w.fireAt[weapon.id] = FIRE_INTERVAL[el] ?? 0.7;
      }

      // 貫通弾の移動＆命中
      for (const s of w.shots) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        for (const e of w.enemies) {
          if (e.hp <= 0 || s.hit.has(e)) continue;
          if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + 4) {
            s.hit.add(e);
            if (s.el === "thunder") makeBolt(w, w.player.x, w.player.y, e.x, e.y, PALETTE.thunder[0]);
            hitEnemy(w, e, s.dmg, s.el);
          }
        }
      }
      w.shots = w.shots.filter((s) => s.life > 0 && s.x > -20 && s.x < W + 20 && s.y > -20 && s.y < H + 20);

      // 火柱：縦の帯にいる敵へダメージ＋立ち昇る炎
      for (const pl of w.pillars) {
        pl.life -= dt;
        for (const e of w.enemies) {
          if (e.hp <= 0 || pl.hit.has(e)) continue;
          if (Math.abs(e.x - pl.x) < 17) { pl.hit.add(e); hitEnemy(w, e, pl.dmg, "fire"); }
        }
        for (let k = 0; k < 3; k++) burst(w, pl.x + (Math.random() - 0.5) * 26, Math.random() * H, "fire", 1, 30);
      }
      w.pillars = w.pillars.filter((p) => p.life > 0);

      // 落下氷塊：着弾で範囲ダメージ
      for (const ic of w.iceFalls) {
        ic.y += ic.vy * dt;
        if (!ic.done && ic.y >= ic.targetY) {
          ic.done = true;
          for (const e of w.enemies) if (Math.hypot(e.x - ic.x, e.y - ic.targetY) < 30) hitEnemy(w, e, ic.dmg, "ice");
          burst(w, ic.x, ic.targetY, "ice", 16, 190);
          w.shake = Math.min(8, w.shake + 2);
        }
      }
      w.iceFalls = w.iceFalls.filter((ic) => !ic.done);

      // ブラックホール：吸い込み＋継続ダメージ
      for (const ho of w.holes) {
        ho.life -= dt;
        for (const e of w.enemies) {
          if (e.hp <= 0) continue;
          const hx = ho.x - e.x, hy = ho.y - e.y;
          const d = Math.hypot(hx, hy) || 1;
          if (d < ho.r) {
            e.x += (hx / d) * 150 * dt; e.y += (hy / d) * 150 * dt; // 吸い込み
            if (d < ho.r * 0.6) {
              e.hp -= ho.dmg * dt * 2.5; // 継続ダメージ
              if (e.hp <= 0) { w.kills += 1; burst(w, e.x, e.y, "dark", 18, 200); w.shake = Math.min(8, w.shake + 3); }
            }
          }
        }
        // 渦の粒
        const a = Math.random() * Math.PI * 2, rr = ho.r * (0.4 + Math.random() * 0.6);
        w.particles.push({ x: ho.x + Math.cos(a) * rr, y: ho.y + Math.sin(a) * rr, vx: -Math.cos(a) * 90, vy: -Math.sin(a) * 90, life: 0.4, max: 0.7, color: PALETTE.dark[1], size: 2 + Math.random() * 2 });
      }
      w.holes = w.holes.filter((h) => h.life > 0);

      // 全方位レーザー：直線上の敵へダメージ（1本1敵1回）
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

      // 死亡敵の除去（全ダメージ源の後で一括）
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
      ctx.strokeStyle = "rgba(160,107,255,0.07)"; ctx.lineWidth = 1;
      for (let gx = 0; gx <= W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy <= H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      // ブラックホール（暗い核＝通常合成で先に）
      for (const ho of w.holes) {
        const a = ho.life / ho.max;
        ctx.globalAlpha = a;
        ctx.fillStyle = "#0a0512"; ctx.beginPath(); ctx.arc(ho.x, ho.y, ho.r * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = PALETTE.dark[1]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ho.x, ho.y, ho.r * 0.5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

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
      px(p.x, p.y - 12, 14, "#2a1250");
      px(p.x, p.y - 18, 8, "#2a1250");
      px(p.x - 4, p.y - 1, 3, "#fff");
      px(p.x + 4, p.y - 1, 3, "#fff");

      // ===== 光り物は加算合成で派手に =====
      ctx.globalCompositeOperation = "lighter";

      // 火柱
      for (const pl of w.pillars) {
        const a = pl.life / pl.max;
        ctx.globalAlpha = 0.45 * a; ctx.fillStyle = PALETTE.fire[2]; ctx.fillRect(Math.round(pl.x - 16), 0, 32, H);
        ctx.globalAlpha = 0.7 * a; ctx.fillStyle = PALETTE.fire[1]; ctx.fillRect(Math.round(pl.x - 8), 0, 16, H);
        ctx.globalAlpha = 1;
      }

      // 全方位レーザー
      for (const bm of w.beams) {
        ctx.globalAlpha = bm.life / bm.max;
        ctx.strokeStyle = PALETTE.light[0]; ctx.lineWidth = 3; ctx.shadowColor = PALETTE.light[1]; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(bm.x + Math.cos(bm.angle) * 480, bm.y + Math.sin(bm.angle) * 480); ctx.stroke();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }

      // 落下氷塊
      for (const ic of w.iceFalls) {
        px(ic.x, ic.y, 12, PALETTE.ice[2]); px(ic.x, ic.y, 8, PALETTE.ice[1]); px(ic.x, ic.y, 4, PALETTE.ice[0]);
      }

      // 稲妻
      for (const b of w.bolts) {
        ctx.globalAlpha = b.life / b.max;
        ctx.strokeStyle = b.color; ctx.lineWidth = 2.5; ctx.shadowColor = b.color; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(b.pts[0].x, b.pts[0].y);
        for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y);
        ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }

      // 貫通弾（thunder/wind）
      for (const s of w.shots) {
        const pal = PALETTE[s.el];
        ctx.shadowColor = pal[2]; ctx.shadowBlur = 10;
        if (s.el === "thunder") {
          px(s.x, s.y, 5, pal[2]); px(s.x, s.y, 3, pal[0]);
          px(s.x + (Math.random() - 0.5) * 6, s.y + (Math.random() - 0.5) * 6, 2, pal[1]);
        } else {
          px(s.x, s.y, 5, pal[2]); px(s.x, s.y, 3, pal[0]);
        }
        ctx.shadowBlur = 0;
      }

      // パーティクル
      for (const pt of w.particles) { ctx.globalAlpha = Math.max(0, pt.life / pt.max); px(pt.x, pt.y, pt.size, pt.color); }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      ctx.restore();

      // ラウンド開始フラッシュ
      if (w.flash > 0.01) { ctx.globalAlpha = w.flash * 0.5; ctx.fillStyle = PALETTE[w.flashEl][1]; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

      // HUD
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(10, 10, 150, 12);
      ctx.fillStyle = "#5ce08a"; ctx.fillRect(10, 10, 150 * Math.max(0, p.hp / p.maxHp), 12);
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.strokeRect(10, 10, 150, 12);
      const leftT = Math.max(0, Math.ceil(durRef.current - w.elapsed));
      ctx.fillStyle = "#fff"; ctx.font = "bold 20px monospace"; ctx.textAlign = "center";
      ctx.fillText(`${leftT}`, W / 2, 26);
      ctx.font = "12px monospace"; ctx.textAlign = "right";
      ctx.fillStyle = "#ffd54f"; ctx.fillText(`Lv ${weaponsRef.current.length}`, W - 10, 16);
      ctx.fillStyle = "#eee"; ctx.fillText(`${w.kills} kills`, W - 10, 30);
      if (debugRef.current) { ctx.textAlign = "left"; ctx.fillStyle = "#5ce08a"; ctx.fillText("DEBUG (無敵)", 10, 44); }

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
