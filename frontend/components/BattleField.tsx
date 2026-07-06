"use client";

// プレイアブルなバトルフィールド（ヴァンサバ風）。
// - プレイヤーを WASD / 矢印 / テンキー で移動。向き=最後に動いた方向（既定は上）
// - 敵は継続湧き（リスポーン）でプレイヤーへ前進
// - 親から cast シグナル(intensity/nonce)が来ると、キャラの向き方向へ AoE を発射
//   AoEは /dev/field と同じ3段階：発生(無ダメ)→完成の一撃(中心ほど大)→付随効果(威力4+)
//     🔥燃える床  ❄️移動停止  ⚡まれに即死  🌑目的地ロスト(迷走)
// リアルタイム常時進行。担当: harukichi

import { useCallback, useEffect, useRef, useState } from "react";
import SpellEffect, { type SpellType } from "./SpellEffect";
import PixelWizard from "./PixelWizard";
import styles from "./BattleField.module.css";

const W = 600;
const H = 360;
const PLAYER_SPEED = 130; // px/s
const ENEMY_SPEED = 40; // px/s
const PLAYER_RADIUS = 22; // プレイヤーの当たり判定半径（スプライト実寸に合わせる）
const ENEMY_RADIUS = 11; // 敵の当たり判定半径
const CONTACT = PLAYER_RADIUS + ENEMY_RADIUS; // これ以上は潜り込ませない
const MAX_ENEMIES = 22;
const SPAWN_MS = 700; // この間隔で1体湧く（上限まで）
const SECONDARY_MIN_LEVEL = 4;
const PEAK_RATIO = 0.5;
const FLOOR_TICK_MS = 1000 / 3;

const FX_COLOR: Record<SpellType, string> = {
  fire: "#ff7a33", ice: "#5fcaff", thunder: "#c9a3ff", dark: "#a23bff",
};

interface Enemy {
  id: number; x: number; y: number; hp: number;
  frozenUntil: number; confusedUntil: number; wanderAngle: number;
}
interface Cast {
  id: number; x: number; y: number; type: SpellType; level: number;
  maxRadius: number; durMs: number; burstDamage: number; floorMs: number;
  startedAt: number; bursted: boolean;
}
interface Floor {
  id: number; x: number; y: number; radius: number; color: string; until: number; lastTick: number;
}

function castParams(type: SpellType, level: number) {
  const durMs = type === "thunder" ? 260 : 650 + level * 110;
  return {
    maxRadius: 42 + level * 22,
    durMs,
    burstDamage: type === "thunder" ? 1.4 + level * 0.5 : 0.7 + level * 0.5, // 敵hp=1基準
    floorMs: 1500 + level * 350,
  };
}

export interface BattleFieldProps {
  spell_type?: SpellType;
  /** 1..5。派手さ。 */
  level?: number;
  /** これが変わるたびに1回発射（親: 評価が来たら +1） */
  castNonce?: number;
  /** 詠唱中フラグ（キャラ発光） */
  charging?: boolean;
}

const THUNDER_INSTAKILL = 0.35;

export default function BattleField({ spell_type = "fire", level = 3, castNonce = 0, charging = false }: BattleFieldProps) {
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [player, setPlayer] = useState({ x: W / 2, y: H / 2 });
  const [facing, setFacing] = useState(-Math.PI / 2); // 既定=上
  const [ring, setRing] = useState<{ x: number; y: number; r: number; color: string } | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [blast, setBlast] = useState<{ id: number; x: number; y: number; r: number; color: string } | null>(null);
  const [fx, setFx] = useState<{ id: number; x: number; y: number; type: SpellType; level: number } | null>(null);

  // refs（rAFから最新を読む）
  const keysRef = useRef<Set<string>>(new Set());
  const playerRef = useRef(player);
  const facingRef = useRef(facing);
  const enemiesRef = useRef(enemies);
  const castRef = useRef<Cast | null>(null);
  const floorsRef = useRef<Floor[]>([]);
  const idRef = useRef(0);
  const lastTsRef = useRef(0);
  const spawnAccRef = useRef(0);
  const spellTypeRef = useRef(spell_type);
  const levelRef = useRef(level);
  const eDownRef = useRef(false);
  const nextId = () => (idRef.current += 1);
  playerRef.current = player;
  facingRef.current = facing;
  enemiesRef.current = enemies;
  spellTypeRef.current = spell_type;
  levelRef.current = level;

  // 発射（castNonce変化とEキーの両方から呼ぶ）。キャラの向き方向へAoE。
  const fireCast = useCallback(() => {
    const p = playerRef.current;
    const f = facingRef.current;
    const t = spellTypeRef.current;
    const lv = levelRef.current;
    const reach = 60 + lv * 16;
    const cx = clamp(p.x + Math.cos(f) * reach, 10, W - 10);
    const cy = clamp(p.y + Math.sin(f) * reach, 10, H - 10);
    const pr = castParams(t, lv);
    castRef.current = { id: nextId(), x: cx, y: cy, type: t, level: lv, ...pr, startedAt: 0, bursted: false };
    setFx({ id: castRef.current.id, x: cx, y: cy, type: t, level: lv });
    setBlast({ id: castRef.current.id, x: cx, y: cy, r: 120 + lv * 26, color: FX_COLOR[t] });
  }, []);

  // キー入力（移動＋Eで発射）
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "KeyE") {
        if (!eDownRef.current) { eDownRef.current = true; fireCast(); }
        e.preventDefault();
        return;
      }
      if (MOVE_CODES.has(e.code)) {
        keysRef.current.add(e.code);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "KeyE") eDownRef.current = false;
      keysRef.current.delete(e.code);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [fireCast]);

  // 発射トリガ（castNonce 変化）
  useEffect(() => {
    if (castNonce <= 0) return;
    fireCast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [castNonce]);

  // メインループ
  useEffect(() => {
    let raf = 0;
    const loop = (ts: number) => {
      const dt = lastTsRef.current ? Math.min((ts - lastTsRef.current) / 1000, 0.05) : 0;
      lastTsRef.current = ts;

      // 1) プレイヤー移動
      const dir = dirFromKeys(keysRef.current);
      if (dir.x !== 0 || dir.y !== 0) {
        const len = Math.hypot(dir.x, dir.y) || 1;
        const nx = clamp(playerRef.current.x + (dir.x / len) * PLAYER_SPEED * dt, 12, W - 12);
        const ny = clamp(playerRef.current.y + (dir.y / len) * PLAYER_SPEED * dt, 12, H - 12);
        setPlayer({ x: nx, y: ny });
        setFacing(Math.atan2(dir.y, dir.x));
      }

      // 2) 敵の湧き（上限まで）
      spawnAccRef.current += dt * 1000;
      if (spawnAccRef.current >= SPAWN_MS && enemiesRef.current.length < MAX_ENEMIES) {
        spawnAccRef.current = 0;
        setEnemies((prev) => [...prev, spawnEnemy(nextId())]);
      }

      // 3) 敵の前進（frozen=停止, confused=迷走）
      {
        const p = playerRef.current;
        setEnemies((prev) => {
          let changed = false;
          const out = prev.map((en) => {
            if (ts < en.frozenUntil) return en;
            let nx = en.x, ny = en.y;
            if (ts < en.confusedUntil) {
              nx += Math.cos(en.wanderAngle) * ENEMY_SPEED * dt;
              ny += Math.sin(en.wanderAngle) * ENEMY_SPEED * dt;
            } else {
              const dx = p.x - en.x, dy = p.y - en.y;
              const d = Math.hypot(dx, dy) || 1;
              if (d > CONTACT) {
                // 接触境界まで詰める（行き過ぎて潜り込まないようにクランプ）
                const step = Math.min(ENEMY_SPEED * dt, d - CONTACT);
                nx += (dx / d) * step;
                ny += (dy / d) * step;
              } else if (d < CONTACT) {
                // 既にめり込んでいたら押し出す
                nx = p.x - (dx / d) * CONTACT;
                ny = p.y - (dy / d) * CONTACT;
              }
            }
            nx = clamp(nx, 6, W - 6); ny = clamp(ny, 6, H - 6);
            if (nx !== en.x || ny !== en.y) { changed = true; return { ...en, x: nx, y: ny }; }
            return en;
          });
          return changed ? out : prev;
        });
      }

      // 4) キャスト：リング更新・完成の一撃＋付随効果
      const c = castRef.current;
      if (c) {
        if (c.startedAt === 0) c.startedAt = ts;
        const prog = (ts - c.startedAt) / c.durMs;
        const env = Math.sin(Math.PI * Math.min(prog, 1));
        setRing({ x: c.x, y: c.y, r: c.maxRadius * env, color: FX_COLOR[c.type] });

        if (!c.bursted && prog >= PEAK_RATIO) {
          c.bursted = true;
          const { x: cx, y: cy, maxRadius: rad, burstDamage: dmg, type: ctype, level: clv } = c;
          // 一撃（中心ほど大）
          setEnemies((prev) =>
            prev
              .map((en) => {
                const d = Math.hypot(en.x - cx, en.y - cy);
                if (d > rad) return en;
                const falloff = Math.pow(1 - d / Math.max(rad, 1), 1.6);
                return { ...en, hp: en.hp - dmg * falloff };
              })
              .filter((en) => en.hp > 0),
          );
          // 付随効果（威力4+）
          if (clv >= SECONDARY_MIN_LEVEL) {
            if (ctype === "fire") {
              const f: Floor = { id: nextId(), x: cx, y: cy, radius: rad, color: FX_COLOR.fire, until: ts + c.floorMs, lastTick: ts };
              floorsRef.current = [...floorsRef.current, f];
              setFloors(floorsRef.current);
            } else if (ctype === "ice") {
              setEnemies((prev) => prev.map((en) => (Math.hypot(en.x - cx, en.y - cy) <= rad ? { ...en, frozenUntil: ts + 1600 } : en)));
            } else if (ctype === "dark") {
              setEnemies((prev) => prev.map((en) => (Math.hypot(en.x - cx, en.y - cy) <= rad ? { ...en, confusedUntil: ts + 2400, wanderAngle: en.id } : en)));
            } else if (ctype === "thunder") {
              setEnemies((prev) => prev.filter((en) => !(Math.hypot(en.x - cx, en.y - cy) <= rad && Math.random() < THUNDER_INSTAKILL)));
            }
          }
        }
        if (prog >= 1) { castRef.current = null; setRing(null); setFx(null); }
      }

      // 5) 燃える床（スリップ・中心寄り2ダメ相当）
      if (floorsRef.current.length) {
        let changed = false;
        const ticked: Floor[] = [];
        floorsRef.current = floorsRef.current.filter((f) => {
          if (ts >= f.until) { changed = true; return false; }
          if (ts - f.lastTick >= FLOOR_TICK_MS) { f.lastTick = ts; ticked.push(f); }
          return true;
        });
        if (ticked.length) {
          setEnemies((prev) =>
            prev
              .map((en) => {
                let dmg = 0;
                for (const f of ticked) {
                  const d = Math.hypot(en.x - f.x, en.y - f.y);
                  if (d <= f.radius) dmg += d <= f.radius * 0.45 ? 0.5 : 0.25;
                }
                return dmg ? { ...en, hp: en.hp - dmg } : en;
              })
              .filter((en) => en.hp > 0),
          );
        }
        if (changed) setFloors([...floorsRef.current]);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const facingDeg = (facing * 180) / Math.PI;

  return (
    <div className={styles.field} tabIndex={0}>
      <div className={styles.hud}>敵 {enemies.length}</div>
      <div className={styles.hint}>WASD / 矢印 / テンキー移動 ・ E で発射</div>

      {/* 燃える床 */}
      {floors.map((f) => (
        <div key={f.id} className={styles.floor} style={{ left: pctX(f.x), top: pctY(f.y), width: f.radius * 2, height: f.radius * 2, ["--fx-color" as string]: f.color } as React.CSSProperties} />
      ))}

      {/* AoEリング */}
      {ring && <div className={styles.ring} style={{ left: pctX(ring.x), top: pctY(ring.y), width: ring.r * 2, height: ring.r * 2, ["--fx-color" as string]: ring.color } as React.CSSProperties} />}

      {/* 発射閃光 */}
      {blast && (
        <div key={`b-${blast.id}`} className={styles.blast} style={{ left: pctX(blast.x), top: pctY(blast.y), width: blast.r, height: blast.r, ["--fx-color" as string]: blast.color } as React.CSSProperties} onAnimationEnd={() => setBlast(null)} />
      )}

      {/* 敵 */}
      {enemies.map((en) => {
        const now = typeof performance !== "undefined" ? performance.now() : 0;
        const frozen = en.frozenUntil > now;
        const confused = en.confusedUntil > now;
        return (
          <div key={en.id} className={`${styles.enemy} ${frozen ? styles.frozen : confused ? styles.confused : ""}`} style={{ left: pctX(en.x), top: pctY(en.y) }}>
            {(frozen || confused) && <span className={styles.enemyStatus}>{frozen ? "❄️" : "💫"}</span>}
            👾
          </div>
        );
      })}

      {/* 照準ライン（向き可視化） */}
      <div className={styles.aim} style={{ left: pctX(player.x), top: pctY(player.y), width: 46, transform: `rotate(${facingDeg}deg)` }} />

      {/* 属性エフェクト（発射先） */}
      {fx && (
        <div key={`fx-${fx.id}`} style={{ position: "absolute", left: pctX(fx.x), top: pctY(fx.y), width: 0, height: 0, zIndex: 3 }}>
          {/* SpellEffect は自前の器を overflow:hidden で切るので、最大威力でも収まる大きめの箱を与える */}
          <div style={{ position: "absolute", left: -180, top: -180, width: 360, height: 360 }}>
            <SpellEffect type={fx.type} level={fx.level} />
          </div>
        </div>
      )}

      {/* プレイヤー */}
      <div className={styles.player} style={{ left: pctX(player.x), top: pctY(player.y) }}>
        <PixelWizard cell={4} facing={Math.cos(facing) < 0 ? "left" : "right"} charging={charging} />
      </div>
    </div>
  );
}

// ── helpers ──
const MOVE_CODES = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Numpad8", "Numpad2", "Numpad4", "Numpad6", "Numpad7", "Numpad9", "Numpad1", "Numpad3",
]);
function dirFromKeys(keys: Set<string>): { x: number; y: number } {
  let x = 0, y = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp") || keys.has("Numpad8")) y -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown") || keys.has("Numpad2")) y += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft") || keys.has("Numpad4")) x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight") || keys.has("Numpad6")) x += 1;
  if (keys.has("Numpad7")) { x -= 1; y -= 1; }
  if (keys.has("Numpad9")) { x += 1; y -= 1; }
  if (keys.has("Numpad1")) { x -= 1; y += 1; }
  if (keys.has("Numpad3")) { x += 1; y += 1; }
  return { x, y };
}
function spawnEnemy(id: number): Enemy {
  // 画面外周のどこかから湧く
  const edge = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  if (edge === 0) { x = Math.random() * W; y = -8; }
  else if (edge === 1) { x = Math.random() * W; y = H + 8; }
  else if (edge === 2) { x = -8; y = Math.random() * H; }
  else { x = W + 8; y = Math.random() * H; }
  return { id, x, y, hp: 1, frozenUntil: 0, confusedUntil: 0, wanderAngle: Math.random() * Math.PI * 2 };
}
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
function pctX(x: number): string { return `${(x / W) * 100}%`; }
function pctY(y: number): string { return `${(y / H) * 100}%`; }
