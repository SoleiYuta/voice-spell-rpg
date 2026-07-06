"use client";

// 第2部：ヴァンサバモード（Canvas + requestAnimationFrame の自作アクション）。
// 詠唱パートで鍛造した武器(=魔法)で、湧く敵を自動攻撃しながら durationSec 秒サバイブする。
// 敵撃破が一定数に達すると onLevelUp を呼び、親(useGame)が詠唱パート→新武器追加→復帰させる。
// 操作: 画面をドラッグ/タッチした方向へ移動（PCは矢印/WASDも可）。攻撃は自動。
//
// props.paused=true の間はワールドを凍結（レベルUP詠唱中は上に詠唱UIが被さる想定）。
// weapons が増える＝新武器追加。durationSec 生存で onFinish("victory")、HP0 で onFinish("defeat")。

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

// 論理解像度（実表示はCSSで横幅に合わせて拡縮）
const W = 360;
const H = 520;

interface Enemy { x: number; y: number; hp: number; maxHp: number; r: number; speed: number; }
interface Shot { x: number; y: number; vx: number; vy: number; dmg: number; color: string; life: number; }

interface World {
  player: { x: number; y: number; hp: number; maxHp: number; r: number };
  enemies: Enemy[];
  shots: Shot[];
  kills: number;
  elapsed: number;      // 生存経過(秒)
  spawnTimer: number;
  fireAt: Record<string, number>; // 武器ごとの次発射までの残り時間
  nextLevelKills: number;         // 次のレベルUPに必要な累計kill
  awaitingLevel: boolean;         // レベルUP要求中（詠唱待ち）
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

  // 最新のprops/コールバックを ref で参照（rAFループが常に最新を読む）
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

  // 武器が増えた＝レベルUP詠唱が完了 → 待機解除＆次しきい値を設定
  useEffect(() => {
    if (weapons.length > prevWeaponCount.current) {
      const w = worldRef.current;
      if (w) {
        w.awaitingLevel = false;
        w.nextLevelKills = w.kills + 6 + weapons.length * 2; // 段々必要killを増やす
      }
      prevWeaponCount.current = weapons.length;
    }
  }, [weapons.length]);

  // 入力（ドラッグ移動 + キーボード）
  const pointer = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const keys = useRef<Set<string>>(new Set());

  useEffect(() => {
    // ワールド初期化
    worldRef.current = {
      player: { x: W / 2, y: H / 2, hp: 100, maxHp: 100, r: 12 },
      enemies: [],
      shots: [],
      kills: 0,
      elapsed: 0,
      spawnTimer: 0,
      fireAt: {},
      nextLevelKills: 6,
      awaitingLevel: false,
      finished: false,
    };

    const canvas = canvasRef.current!;
    const dpr = Math.min(2, (window.devicePixelRatio || 1));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // client座標 → 論理座標
    const toLocal = (cx: number, cy: number) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ((cx - rect.left) / rect.width) * W, y: ((cy - rect.top) / rect.height) * H };
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      const p = toLocal(e.clientX, e.clientY);
      pointer.current = { active: true, x: p.x, y: p.y };
    };
    const onMove = (e: PointerEvent) => {
      if (!pointer.current.active) return;
      const p = toLocal(e.clientX, e.clientY);
      pointer.current.x = p.x; pointer.current.y = p.y;
    };
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

    const PLAYER_SPEED = 135; // px/s
    let raf = 0;
    let prev = performance.now();

    const spawnEnemy = (w: World) => {
      const edge = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      if (edge === 0) { x = Math.random() * W; y = -14; }
      else if (edge === 1) { x = W + 14; y = Math.random() * H; }
      else if (edge === 2) { x = Math.random() * W; y = H + 14; }
      else { x = -14; y = Math.random() * H; }
      const hp = 16 + w.elapsed * 0.6; // 時間経過で少しタフに
      w.enemies.push({ x, y, hp, maxHp: hp, r: 11, speed: 42 + Math.random() * 22 });
    };

    const step = (dt: number, w: World) => {
      w.elapsed += dt;

      // --- 勝敗判定 ---
      if (!w.finished && w.elapsed >= durRef.current) {
        w.finished = true; onFinishRef.current("victory"); return;
      }
      if (!w.finished && w.player.hp <= 0) {
        w.finished = true; onFinishRef.current("defeat"); return;
      }

      // --- プレイヤー移動 ---
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

      // --- 敵スポーン（時間で加速） ---
      w.spawnTimer -= dt;
      const spawnInterval = Math.max(0.35, 1.25 - w.elapsed * 0.025);
      if (w.spawnTimer <= 0) { spawnEnemy(w); w.spawnTimer = spawnInterval; }

      // --- 敵移動＆接触ダメージ ---
      for (const e of w.enemies) {
        const ex = w.player.x - e.x, ey = w.player.y - e.y;
        const d = Math.hypot(ex, ey) || 1;
        e.x += (ex / d) * e.speed * dt;
        e.y += (ey / d) * e.speed * dt;
        if (d < e.r + w.player.r) w.player.hp -= 22 * dt; // 接触中はHP減少
      }

      // --- 武器の自動発射（最寄りの敵へ） ---
      const FIRE_INTERVAL = 0.7;
      const SHOT_SPEED = 320;
      for (const weapon of weaponsRef.current) {
        w.fireAt[weapon.id] = (w.fireAt[weapon.id] ?? 0) - dt;
        if (w.fireAt[weapon.id] > 0) continue;
        // 最寄りの敵
        let best: Enemy | null = null, bestD = Infinity;
        for (const e of w.enemies) {
          const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (!best) continue;
        const a = Math.atan2(best.y - w.player.y, best.x - w.player.x);
        w.shots.push({
          x: w.player.x, y: w.player.y,
          vx: Math.cos(a) * SHOT_SPEED, vy: Math.sin(a) * SHOT_SPEED,
          dmg: weapon.damage, color: weapon.color, life: 2.2,
        });
        w.fireAt[weapon.id] = FIRE_INTERVAL;
      }

      // --- 弾移動＆命中 ---
      for (const s of w.shots) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        for (const e of w.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + 4) {
            e.hp -= s.dmg; s.life = 0;
            if (e.hp <= 0) w.kills += 1;
            break;
          }
        }
      }
      w.shots = w.shots.filter((s) => s.life > 0 && s.x > -20 && s.x < W + 20 && s.y > -20 && s.y < H + 20);
      w.enemies = w.enemies.filter((e) => e.hp > 0);

      // --- レベルUP判定 ---
      const MAX_WEAPONS = 5;
      if (!w.awaitingLevel && weaponsRef.current.length < MAX_WEAPONS && w.kills >= w.nextLevelKills) {
        w.awaitingLevel = true;
        onLevelUpRef.current(weaponsRef.current.length + 1);
      }
    };

    const draw = (ctx: CanvasRenderingContext2D, w: World) => {
      // 背景
      ctx.fillStyle = "#140f1f";
      ctx.fillRect(0, 0, W, H);
      // グリッド
      ctx.strokeStyle = "rgba(160,107,255,0.08)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy <= H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      // 弾
      for (const s of w.shots) {
        ctx.fillStyle = s.color;
        ctx.shadowColor = s.color; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;

      // 敵
      for (const e of w.enemies) {
        ctx.fillStyle = "#c8341a";
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.beginPath(); ctx.arc(e.x - 3.5, e.y - 2, 1.6, 0, Math.PI * 2);
        ctx.arc(e.x + 3.5, e.y - 2, 1.6, 0, Math.PI * 2); ctx.fill();
        // HPバー
        if (e.hp < e.maxHp) {
          ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(e.x - e.r, e.y - e.r - 6, e.r * 2, 3);
          ctx.fillStyle = "#ff8a5c"; ctx.fillRect(e.x - e.r, e.y - e.r - 6, e.r * 2 * (e.hp / e.maxHp), 3);
        }
      }

      // プレイヤー（魔導士）
      const p = w.player;
      ctx.fillStyle = "#a06bff";
      ctx.shadowColor = "#a06bff"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(p.x - 4, p.y - 2, 2, 0, Math.PI * 2);
      ctx.arc(p.x + 4, p.y - 2, 2, 0, Math.PI * 2); ctx.fill();

      // HUD: HPバー
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(10, 10, 150, 12);
      ctx.fillStyle = "#5ce08a"; ctx.fillRect(10, 10, 150 * Math.max(0, p.hp / p.maxHp), 12);
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.strokeRect(10, 10, 150, 12);
      // HUD: タイマー
      const left = Math.max(0, Math.ceil(durRef.current - w.elapsed));
      ctx.fillStyle = "#fff"; ctx.font = "bold 20px monospace"; ctx.textAlign = "center";
      ctx.fillText(`${left}`, W / 2, 26);
      // HUD: レベル / kill
      ctx.font = "12px monospace"; ctx.textAlign = "right";
      ctx.fillStyle = "#ffd54f"; ctx.fillText(`Lv ${weaponsRef.current.length}`, W - 10, 16);
      ctx.fillStyle = "#eee"; ctx.fillText(`${w.kills} kills`, W - 10, 30);

      // 一時停止（詠唱中）
      if (pausedRef.current) {
        ctx.fillStyle = "rgba(10,6,20,0.55)"; ctx.fillRect(0, 0, W, H);
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const w = worldRef.current;
      if (!w) return;
      let dt = (now - prev) / 1000; prev = now;
      if (dt > 0.05) dt = 0.05; // タブ復帰などの大ジャンプを抑制
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
  }, []); // マウント時に1回だけ構築（props は ref 経由で反映）

  return (
    <div className={styles.wrap}>
      <canvas ref={canvasRef} className={styles.canvas} style={{ aspectRatio: `${W} / ${H}` }} />
      <div className={styles.hint}>ドラッグで移動 / 矢印・WASD可 ・ 攻撃は自動</div>
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
