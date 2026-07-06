"use client";

// 群れアリーナ（ヴァンサバ風）の戦闘画面。useGame は不変のまま、
// enemy_hp / enemy_max_hp の比率を「群れの残り数」に翻訳して描画する。
//   - 敵の群れが四方から湧いてプレイヤー(中央)へ前進
//   - result で spell_power/intensity が渡ると、プレイヤーの向き（＝群れ重心方向）へ
//     AoEを放って、比率ぶんの敵をなぎ倒す
// 演出は SpellEffect（属性エフェクト）を発射位置に重ねて再利用。担当: harukichi

import { useEffect, useMemo, useRef, useState } from "react";
import SpellEffect, { type SpellType } from "./SpellEffect";
import PixelWizard from "./PixelWizard";
import styles from "./BattleArena.module.css";

const ARENA_W = 560;
const ARENA_H = 300;
const PLAYER = { x: ARENA_W / 2, y: ARENA_H - 40 };
const SWARM_MAX = 14; // 満タン(enemy_max_hp)時に表示する最大の群れ数
const ENEMY_SPEED = 10; // px/秒（じわじわ前進）

const FX_COLOR: Record<SpellType, string> = {
  fire: "#ff7a33",
  ice: "#5fcaff",
  thunder: "#c9a3ff",
  dark: "#a23bff",
};

interface Mob {
  id: number;
  x: number;
  y: number;
  alive: boolean;
}

export interface BattleArenaProps {
  enemy_hp: number;
  max_hp: number;
  enemy_emoji?: string;
  spell_type?: SpellType;
  /** 1..5。result時に渡すとAoEエフェクトの派手さになる。 */
  intensity?: number;
  /** ヒット演出のトリガ兼ダメージ表示。EvaluationResult.spell_power をそのまま。 */
  spell_power?: number;
  /** 詠唱中フラグ（プレイヤーが力をためる演出） */
  charging?: boolean;
}

// enemy_hp/max_hp の比率 → 生存させる群れ数
function aliveCountFromHp(hp: number, max: number): number {
  if (max <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, hp / max));
  return Math.max(0, Math.round(ratio * SWARM_MAX));
}

export default function BattleArena({
  enemy_hp,
  max_hp,
  enemy_emoji = "👾",
  spell_type = "fire",
  intensity,
  spell_power,
  charging = false,
}: BattleArenaProps) {
  // 群れの初期配置（アリーナ上部〜側面からランダムに湧く）。満タン分作っておく。
  const [mobs, setMobs] = useState<Mob[]>(() =>
    Array.from({ length: SWARM_MAX }, (_, i) => spawnMob(i)),
  );
  const [fxKey, setFxKey] = useState(0);
  const [beam, setBeam] = useState<{ angle: number; len: number; color: string } | null>(null);
  const lastTriggerRef = useRef<string | undefined>(undefined);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);

  const level = intensity ? Math.max(1, Math.min(5, Math.round(intensity))) : 3;
  const targetAlive = aliveCountFromHp(enemy_hp, max_hp);

  // 前進アニメ（プレイヤーへ寄る）
  useEffect(() => {
    const tick = (ts: number) => {
      const dt = lastTsRef.current ? Math.min((ts - lastTsRef.current) / 1000, 0.05) : 0;
      lastTsRef.current = ts;
      setMobs((prev) => {
        let changed = false;
        const out = prev.map((m) => {
          if (!m.alive) return m;
          const dx = PLAYER.x - m.x;
          const dy = PLAYER.y - m.y;
          const d = Math.hypot(dx, dy);
          if (d <= 34) return m; // プレイヤー手前で止まる
          changed = true;
          return { ...m, x: m.x + (dx / d) * ENEMY_SPEED * dt, y: m.y + (dy / d) * ENEMY_SPEED * dt };
        });
        return changed ? out : prev;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // 生存数を targetAlive に合わせる（HPが削れたら差分を「なぎ倒す」）
  useEffect(() => {
    setMobs((prev) => {
      const aliveList = prev.filter((m) => m.alive);
      if (aliveList.length <= targetAlive) return prev;
      // 減らす数だけ、プレイヤーに近い順（前線）から倒す
      const toKill = aliveList.length - targetAlive;
      const sorted = [...aliveList].sort(
        (a, b) => dist(a, PLAYER) - dist(b, PLAYER),
      );
      const killIds = new Set(sorted.slice(0, toKill).map((m) => m.id));
      return prev.map((m) => (killIds.has(m.id) ? { ...m, alive: false } : m));
    });
  }, [targetAlive]);

  // result 突入（intensity/spell_power の変化）でAoE＋ビーム発射
  useEffect(() => {
    if (intensity === undefined && spell_power === undefined) return;
    const token = `${intensity}/${spell_power}`;
    if (token === lastTriggerRef.current) return;
    lastTriggerRef.current = token;
    setFxKey((k) => k + 1);
    // プレイヤーの向き＝群れの重心方向
    const c = centroidOfAlive(mobsRef.current);
    const angle = Math.atan2(c.y - PLAYER.y, c.x - PLAYER.x);
    setBeam({ angle: (angle * 180) / Math.PI, len: 260, color: FX_COLOR[spell_type] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intensity, spell_power]);

  // centroid 参照用に最新 mobs を保持
  const mobsRef = useRef(mobs);
  mobsRef.current = mobs;

  // AoE発射位置＝プレイヤーの向いた先（群れ重心方向へ少し進んだ地点）
  const fxPos = useMemo(() => {
    const c = centroidOfAlive(mobs);
    const angle = Math.atan2(c.y - PLAYER.y, c.x - PLAYER.x);
    const reach = 90 + level * 14;
    return { x: PLAYER.x + Math.cos(angle) * reach, y: PLAYER.y + Math.sin(angle) * reach };
    // fxKey が変わった時だけ位置を確定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxKey]);

  const firing = fxKey > 0;
  const aliveNow = mobs.filter((m) => m.alive).length;

  return (
    <div className={styles.arena} style={{ height: ARENA_H }}>
      <div className={styles.hud}>群れ 残り {aliveNow}</div>

      {/* 敵の群れ */}
      {mobs.map((m) => (
        <div
          key={m.id}
          className={`${styles.enemy} ${m.alive ? "" : styles.enemyDying}`}
          style={{ left: `${(m.x / ARENA_W) * 100}%`, top: `${(m.y / ARENA_H) * 100}%` }}
        >
          {enemy_emoji}
        </div>
      ))}

      {/* 発射ビーム（キャラの向き方向へ一閃） */}
      {firing && beam && (
        <div
          key={`beam-${fxKey}`}
          className={styles.beam}
          style={
            {
              left: `${(PLAYER.x / ARENA_W) * 100}%`,
              top: `${(PLAYER.y / ARENA_H) * 100}%`,
              width: beam.len,
              transform: `rotate(${beam.angle}deg)`,
              ["--fx-color" as string]: beam.color,
            } as React.CSSProperties
          }
        />
      )}

      {/* 属性エフェクト（発射先に重ねる） */}
      {firing && (
        <div
          key={`fx-${fxKey}`}
          style={{
            position: "absolute",
            left: `${(fxPos.x / ARENA_W) * 100}%`,
            top: `${(fxPos.y / ARENA_H) * 100}%`,
            width: 0,
            height: 0,
            zIndex: 2,
          }}
        >
          <div style={{ position: "absolute", left: -90, top: -90, width: 180, height: 180 }}>
            <SpellEffect type={spell_type} level={level} />
          </div>
        </div>
      )}

      {/* プレイヤー（向き：群れ重心の左右で決定） */}
      <div
        className={styles.player}
        style={{
          left: `${(PLAYER.x / ARENA_W) * 100}%`,
          top: `${(PLAYER.y / ARENA_H) * 100}%`,
        }}
      >
        <PixelWizard
          cell={4}
          facing={centroidOfAlive(mobs).x < PLAYER.x ? "left" : "right"}
          charging={charging}
        />
      </div>
    </div>
  );
}

// ── helpers ──
function spawnMob(i: number): Mob {
  // 上部・左右からリング状に湧かせる（プレイヤーの周囲を囲む）
  const angle = (i / SWARM_MAX) * Math.PI * 2;
  const rx = ARENA_W * 0.42;
  const ry = ARENA_H * 0.4;
  const x = ARENA_W / 2 + Math.cos(angle) * rx * (0.7 + (i % 3) * 0.12);
  const y = ARENA_H * 0.42 + Math.sin(angle) * ry * (0.6 + (i % 2) * 0.2);
  return { id: i, x: clamp(x, 20, ARENA_W - 20), y: clamp(y, 16, ARENA_H - 70), alive: true };
}
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function centroidOfAlive(mobs: Mob[]): { x: number; y: number } {
  const alive = mobs.filter((m) => m.alive);
  if (alive.length === 0) return { x: ARENA_W / 2, y: ARENA_H * 0.3 };
  const sx = alive.reduce((s, m) => s + m.x, 0) / alive.length;
  const sy = alive.reduce((s, m) => s + m.y, 0) / alive.length;
  return { x: sx, y: sy };
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
