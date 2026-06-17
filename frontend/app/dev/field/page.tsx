"use client";

// 実験フィールド（/dev/field）。敵を配置し、魔法の発生位置を指定して撃てる調整環境。
// 敵は「目的地（プレイヤー）」へ前進し、キャラ1人分の当たり判定で止まる。前進中も魔法は投げられる。
//
// ダメージは3段階：
//   1. 発生（膨らむ間）……範囲は広がるがダメージ無し
//   2. 完成（膨らみきった瞬間）……強い一撃（中心ほど大）
//   3. 消滅（萎むと同時／威力4以上のみ・属性別の付随効果）
//        🔥 燃える床（スリップ）  ❄️ 移動停止  ⚡ 稲妻形の判定でまれに即死  🌑 目的地ロスト（迷走）
// 本番ループには含めない。effect/当たり判定の調整に使い回す。担当: harukichi (#2 / #4)

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SpellEffect, { coreSpriteSize, type SpellType } from "@/components/SpellEffect";
import styles from "./field.module.css";

interface Enemy {
  id: number;
  x: number;
  y: number;
  homeX: number; // 初期位置（ループ時の戻り先）
  homeY: number;
  hp: number;
  maxHp: number;
  emoji: string;
  frozenUntil: number; // performance.now ベース。0=なし
  confusedUntil: number;
  wanderAngle: number;
}

interface SimCast {
  id: number;
  x: number;
  y: number;
  type: SpellType;
  level: number;
  maxRadius: number;
  durMs: number;
  peakMs: number; // 起動から判定発生までの時間
  burstDamage: number;
  floorDurationMs: number;
  startedAt: number;
  bursted: boolean;
}

interface Floor {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  until: number;
  lastTick: number;
}

interface BurstFx {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
}

const SPELLS: { type: SpellType; label: string; effect: string }[] = [
  { type: "fire", label: "🔥 炎", effect: "燃える床" },
  { type: "ice", label: "❄️ 氷", effect: "移動停止" },
  { type: "thunder", label: "⚡ 雷", effect: "まれに即死" },
  { type: "dark", label: "🌑 闇", effect: "目的地ロスト" },
];

const ENEMY_KINDS = ["👾", "🐉", "💀", "🧟", "🪼"];

const RING_COLOR: Record<SpellType, string> = {
  fire: "#ff7a33",
  ice: "#5fcaff",
  thunder: "#c9a3ff",
  dark: "#a23bff",
};

const ENEMY_HP = 100;
const PEAK_RATIO = 0.5;
const FLOOR_TICK_MS = 1000 / 3; // 毎秒約3回
const FLOOR_TICK_DAMAGE = 1;
const SECONDARY_MIN_LEVEL = 4; // 付随効果が出る威力

const ENEMY_SPEED = 42; // px/秒
const PLAYER_RADIUS = 22; // 目的地のキャラ当たり判定
const RETURN_DIST = 48; // ループ時：これより近づいたら初期位置へ戻る
const FIELD_H = 460;
const FREEZE_MS = 1600;
const CONFUSE_MS = 2400;
const THUNDER_INSTAKILL_CHANCE = 0.26; // 稲妻に触れた各敵が即死する確率（まれに）

// 稲妻スプライトの中心線（正規化：中心からの幅/高さの割合）。当たり判定はこの折れ線まわり。
const BOLT_PATH: [number, number][] = [
  [0.143, -0.45],
  [0.0, -0.35],
  [-0.071, -0.25],
  [-0.071, -0.15],
  [0.071, -0.05],
  [0.071, 0.05],
  [0.0, 0.15],
  [-0.143, 0.25],
  [-0.214, 0.35],
  [-0.357, 0.45],
];

// 稲妻の折れ線をワールド座標へ（スプライト実寸に合わせる）
function boltPolyline(cx: number, cy: number, level: number): [number, number][] {
  const { w, h } = coreSpriteSize("thunder", level);
  return BOLT_PATH.map(([nx, ny]) => [cx + nx * w, cy + ny * h]);
}

// 稲妻の当たり半径（細め。威力が上がるほど相対的に鋭く＝細く）
function boltHitWidth(level: number): number {
  return (coreSpriteSize("thunder", level).w / 7) * (1.0 - level * 0.08);
}

// 点と折れ線の最短距離
function distToPolyline(px: number, py: number, pts: [number, number][]): number {
  let min = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < min) min = d;
  }
  return min;
}

function castParams(type: SpellType, level: number) {
  // 雷は鋭い即着弾：起動→判定が約0.1s、威力高め
  const durMs = type === "thunder" ? 260 : 650 + level * 110;
  return {
    maxRadius: 50 + level * 32,
    durMs,
    peakMs: type === "thunder" ? 100 : durMs * PEAK_RATIO,
    burstDamage: type === "thunder" ? 52 + level * 24 : 25 + level * 15,
    floorDurationMs: 1500 + level * 350,
  };
}

type Mode = "enemy" | "spawn" | "goal";

export default function FieldDevPage() {
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [ring, setRing] = useState<{ x: number; y: number; r: number; color: string; opacity: number } | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [bursts, setBursts] = useState<BurstFx[]>([]);
  const [activeCast, setActiveCast] = useState<{ id: number; x: number; y: number; type: SpellType; level: number; maxRadius: number } | null>(null);
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
  const [goal, setGoal] = useState({ x: 300, y: 220 });
  const [moving, setMoving] = useState(false);
  const [loopField, setLoopField] = useState(false);

  const [type, setType] = useState<SpellType>("fire");
  const [level, setLevel] = useState(4);
  const [emoji, setEmoji] = useState(ENEMY_KINDS[0]);
  const [mode, setMode] = useState<Mode>("enemy");

  const fieldRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const nextId = () => (idRef.current += 1);

  // sim refs（rAF から最新値を読む）
  const castRef = useRef<SimCast | null>(null);
  const floorsRef = useRef<Floor[]>([]);
  const goalRef = useRef(goal);
  const movingRef = useRef(moving);
  const loopFieldRef = useRef(loopField);
  const enemiesRef = useRef<Enemy[]>([]);
  const lastRef = useRef(0);
  useEffect(() => void (goalRef.current = goal), [goal]);
  useEffect(() => void (movingRef.current = moving), [moving]);
  useEffect(() => void (loopFieldRef.current = loopField), [loopField]);
  useEffect(() => void (enemiesRef.current = enemies), [enemies]);

  // ── 常駐シミュレーションループ ──
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      const dt = lastRef.current ? Math.min((now - lastRef.current) / 1000, 0.05) : 0;
      lastRef.current = now;

      // 1) 敵の前進（目的地へ。frozen=停止 / confused=迷走）
      if (movingRef.current) {
        const w = fieldRef.current?.clientWidth ?? 480;
        const g = goalRef.current;
        setEnemies((prev) => {
          let changed = false;
          const out = prev.map((en) => {
            if (en.hp <= 0 || now < en.frozenUntil) return en;
            let nx = en.x;
            let ny = en.y;
            if (now < en.confusedUntil) {
              nx += Math.cos(en.wanderAngle) * ENEMY_SPEED * dt;
              ny += Math.sin(en.wanderAngle) * ENEMY_SPEED * dt;
            } else {
              const dx = g.x - en.x;
              const dy = g.y - en.y;
              const d = Math.hypot(dx, dy);
              if (d > PLAYER_RADIUS) {
                nx += (dx / d) * ENEMY_SPEED * dt;
                ny += (dy / d) * ENEMY_SPEED * dt;
              }
            }
            nx = Math.max(0, Math.min(w, nx));
            ny = Math.max(0, Math.min(FIELD_H, ny));
            // ループ：目的地に近づいたら初期位置へ戻る（連続テスト用。HPは維持）
            if (loopFieldRef.current && Math.hypot(g.x - nx, g.y - ny) <= RETURN_DIST) {
              changed = true;
              return { ...en, x: en.homeX, y: en.homeY, frozenUntil: 0, confusedUntil: 0 };
            }
            if (nx !== en.x || ny !== en.y) {
              changed = true;
              return { ...en, x: nx, y: ny };
            }
            return en;
          });
          return changed ? out : prev;
        });
      }

      // 2) キャスト：リング更新・完成時の一撃＋付随効果
      const c = castRef.current;
      if (c) {
        if (c.startedAt === 0) c.startedAt = now;
        const p = (now - c.startedAt) / c.durMs;
        const env = Math.sin(Math.PI * Math.min(p, 1));
        // 雷は当たり判定が稲妻形なので円リングは出さない
        if (c.type !== "thunder") {
          setRing({ x: c.x, y: c.y, r: c.maxRadius * env, color: RING_COLOR[c.type], opacity: 0.08 + 0.22 * env });
        }

        if (!c.bursted && now - c.startedAt >= c.peakMs) {
          c.bursted = true;
          const cx = c.x, cy = c.y, rad = c.maxRadius, dmg = c.burstDamage, ctype = c.type, clv = c.level;

          // 当たり判定：雷は稲妻の折れ線、それ以外は円
          const isThunder = ctype === "thunder";
          const boltPts = isThunder ? boltPolyline(cx, cy, clv) : null;
          const hitMax = isThunder ? boltHitWidth(clv) : rad;
          const hitDist = (ex: number, ey: number) => (boltPts ? distToPolyline(ex, ey, boltPts) : Math.hypot(ex - cx, ey - cy));

          // 完成の一撃（中心ほど高ダメージ）
          setEnemies((prev) =>
            prev.map((en) => {
              if (en.hp <= 0) return en;
              const d = hitDist(en.x, en.y);
              if (d > hitMax) return en;
              const falloff = Math.pow(1 - d / Math.max(hitMax, 1), 1.6);
              return { ...en, hp: Math.max(0, en.hp - dmg * falloff) };
            }),
          );
          setBursts((prev) => [...prev, { id: nextId(), x: cx, y: cy, radius: rad, color: RING_COLOR[ctype] }]);

          // 付随効果（威力4以上・属性別）
          if (clv >= SECONDARY_MIN_LEVEL) {
            if (ctype === "fire") {
              const floor: Floor = { id: nextId(), x: cx, y: cy, radius: rad, color: RING_COLOR.fire, until: now + c.floorDurationMs, lastTick: now };
              floorsRef.current = [...floorsRef.current, floor];
              setFloors(floorsRef.current);
            } else if (ctype === "ice") {
              setEnemies((prev) => prev.map((en) => (en.hp > 0 && Math.hypot(en.x - cx, en.y - cy) <= rad ? { ...en, frozenUntil: now + FREEZE_MS } : en)));
            } else if (ctype === "dark") {
              setEnemies((prev) => prev.map((en) => (en.hp > 0 && Math.hypot(en.x - cx, en.y - cy) <= rad ? { ...en, confusedUntil: now + CONFUSE_MS, wanderAngle: en.id * 1.3 + p * 6.28 } : en)));
            } else if (ctype === "thunder") {
              // 稲妻に触れた敵をまれに即死（部位消し飛び）
              const victims = enemiesRef.current.filter((e) => e.hp > 0 && hitDist(e.x, e.y) <= hitMax && Math.random() < THUNDER_INSTAKILL_CHANCE);
              if (victims.length) {
                const ids = new Set(victims.map((v) => v.id));
                setEnemies((prev) => prev.map((e) => (ids.has(e.id) ? { ...e, hp: 0 } : e)));
                setBursts((prev) => [...prev, ...victims.map((v) => ({ id: nextId(), x: v.x, y: v.y, radius: 24, color: RING_COLOR.thunder }))]);
              }
            }
          }
        }

        if (p >= 1) {
          castRef.current = null;
          setRing(null);
          setActiveCast(null);
        }
      }

      // 3) 燃える床（スリップ・中心寄りは2ダメ）
      if (floorsRef.current.length) {
        let changed = false;
        const ticked: Floor[] = [];
        floorsRef.current = floorsRef.current.filter((f) => {
          if (now >= f.until) {
            changed = true;
            return false;
          }
          if (now - f.lastTick >= FLOOR_TICK_MS) {
            f.lastTick = now;
            ticked.push(f);
          }
          return true;
        });
        if (ticked.length) {
          setEnemies((prev) =>
            prev.map((en) => {
              if (en.hp <= 0) return en;
              let dmg = 0;
              for (const f of ticked) {
                const dist = Math.hypot(en.x - f.x, en.y - f.y);
                if (dist > f.radius) continue;
                dmg += dist <= f.radius * 0.45 ? FLOOR_TICK_DAMAGE * 2 : FLOOR_TICK_DAMAGE;
              }
              return dmg ? { ...en, hp: Math.max(0, en.hp - dmg) } : en;
            }),
          );
        }
        if (changed) setFloors([...floorsRef.current]);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function fireAt(x: number, y: number) {
    const pr = castParams(type, level);
    const id = nextId();
    castRef.current = { id, x, y, type, level, maxRadius: pr.maxRadius, durMs: pr.durMs, peakMs: pr.peakMs, burstDamage: pr.burstDamage, floorDurationMs: pr.floorDurationMs, startedAt: 0, bursted: false };
    setActiveCast({ id, x, y, type, level, maxRadius: pr.maxRadius });
    if (type === "thunder") setRing(null); // 稲妻判定なので円リングは消す
  }

  function handleFieldClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (mode === "enemy") {
      setEnemies((prev) => [...prev, { id: nextId(), x, y, homeX: x, homeY: y, hp: ENEMY_HP, maxHp: ENEMY_HP, emoji, frozenUntil: 0, confusedUntil: 0, wanderAngle: 0 }]);
    } else if (mode === "goal") {
      setGoal({ x, y });
    } else {
      setMarker({ x, y });
      fireAt(x, y);
    }
  }

  function clearAll() {
    floorsRef.current = [];
    setFloors([]);
    setBursts([]);
    setEnemies([]);
  }

  const nowMs = typeof performance !== "undefined" ? performance.now() : 0;

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 20px" }}>
      <h1 style={{ color: "var(--accent)", textAlign: "center", margin: "0 0 4px" }}>実験フィールド</h1>
      <p style={{ opacity: 0.7, fontSize: 13, textAlign: "center", marginTop: 0 }}>
        敵は目的地（🧙）へ前進。完成の一撃＋威力4以上で属性別の付随効果。前進中も魔法は投げられる（/dev/field）。
        <br />
        <Link href="/dev/battle" style={{ color: "var(--accent)" }}>→ 単体エフェクトビューア (/dev/battle)</Link>
      </p>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>
        {/* 左：モード・前進・属性 */}
        <aside style={{ width: 188, flexShrink: 0 }}>
          <Panel title="モード（クリック動作）">
            <button onClick={() => setMode("enemy")} style={chip(mode === "enemy")}>🧱 敵を置く</button>
            <button onClick={() => setMode("spawn")} style={chip(mode === "spawn")}>🎯 発生位置（撃つ）</button>
            <button onClick={() => setMode("goal")} style={chip(mode === "goal")}>🧙 目的地を置く</button>
          </Panel>

          <Panel title="前進">
            <button onClick={() => setMoving((m) => !m)} style={chip(moving)}>
              {moving ? "⏸ 停止" : "▶ 前進開始"}
            </button>
            <button onClick={() => setLoopField((v) => !v)} style={chip(loopField)}>
              🔁 ループ{loopField ? " ON" : " OFF"}
            </button>
          </Panel>

          <Panel title="属性（付随効果）">
            {SPELLS.map((s) => (
              <button key={s.type} onClick={() => setType(s.type)} style={chip(type === s.type)}>
                {s.label}
                <span style={{ fontSize: 10, opacity: 0.7, display: "block" }}>{s.effect}</span>
              </button>
            ))}
          </Panel>

        </aside>

        {/* 中央：フィールド */}
        <div style={{ flex: "1 1 440px", minWidth: 300, maxWidth: 560 }}>
          <div ref={fieldRef} className={styles.field} onClick={handleFieldClick}>
            {/* 燃える床 */}
            {floors.map((f) => (
              <div key={f.id} className={styles.floor} style={{ left: f.x, top: f.y, width: f.radius * 2, height: f.radius * 2, ["--ring-color" as string]: f.color } as React.CSSProperties} />
            ))}

            {/* AoEリング */}
            {ring && (
              <div className={styles.ring} style={{ left: ring.x, top: ring.y, width: ring.r * 2, height: ring.r * 2, opacity: ring.opacity, ["--ring-color" as string]: ring.color } as React.CSSProperties} />
            )}

            {/* 完成の一撃フラッシュ */}
            {bursts.map((b) => (
              <div key={b.id} className={styles.burst} style={{ left: b.x, top: b.y, width: b.radius * 2, height: b.radius * 2, ["--ring-color" as string]: b.color } as React.CSSProperties} onAnimationEnd={() => setBursts((prev) => prev.filter((x) => x.id !== b.id))} />
            ))}

            {/* 目的地（プレイヤー＋当たり判定） */}
            <div style={{ position: "absolute", left: goal.x, top: goal.y, width: PLAYER_RADIUS * 2, height: PLAYER_RADIUS * 2, transform: "translate(-50%,-50%)", borderRadius: "50%", border: "2px dashed color-mix(in srgb, var(--accent) 60%, transparent)", pointerEvents: "none" }} />
            <div className={styles.goal} style={{ left: goal.x, top: goal.y }}>🧙</div>

            {/* 敵 */}
            {enemies.map((en) => {
              const frozen = en.frozenUntil > nowMs;
              const confused = en.confusedUntil > nowMs;
              const cls = en.hp <= 0 ? styles.defeated : frozen ? styles.frozen : confused ? styles.confused : "";
              return (
                <div key={en.id} className={`${styles.enemy} ${cls}`} style={{ left: en.x, top: en.y }}>
                  {en.hp > 0 && (frozen || confused) && <div className={styles.status}>{frozen ? "❄️" : "💫"}</div>}
                  <div className={styles.enemyEmoji}>{en.hp <= 0 ? "💥" : en.emoji}</div>
                  {en.hp > 0 && (
                    <div className={styles.hpTrack}>
                      <div className={styles.hpFill} style={{ width: `${(en.hp / en.maxHp) * 100}%` }} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* 発生位置マーカー */}
            {marker && <div className={styles.marker} style={{ left: marker.x, top: marker.y }} />}

            {/* 呪文エフェクト */}
            {activeCast && (
              <div className={styles.fxAnchor} style={{ left: activeCast.x, top: activeCast.y }} key={activeCast.id}>
                <div style={{ position: "absolute", left: -activeCast.maxRadius, top: -activeCast.maxRadius, width: activeCast.maxRadius * 2, height: activeCast.maxRadius * 2 }}>
                  <SpellEffect type={activeCast.type} level={activeCast.level} />
                </div>
              </div>
            )}
          </div>

          <p style={{ opacity: 0.6, fontSize: 12, marginTop: 8 }}>
            敵 {enemies.length} 体 / 撃破 {enemies.filter((e) => e.hp <= 0).length} 体 ・ 中心ほど高ダメージ。付随効果は威力{SECONDARY_MIN_LEVEL}以上。
          </p>
        </div>

        {/* 右：威力・置く敵・操作 */}
        <aside style={{ width: 188, flexShrink: 0 }}>
          <Panel title="威力（範囲・付随効果）">
            {[1, 2, 3, 4, 5].map((lv) => (
              <button key={lv} onClick={() => setLevel(lv)} style={chip(level === lv)}>
                威力{lv}
                {lv >= SECONDARY_MIN_LEVEL && <span style={{ fontSize: 10, opacity: 0.7 }}> +効果</span>}
              </button>
            ))}
          </Panel>

          <Panel title="置く敵">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ENEMY_KINDS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} style={{ ...chip(emoji === e), fontSize: 20, padding: "6px 10px" }}>{e}</button>
              ))}
            </div>
          </Panel>

          <Panel title="操作">
            <button onClick={() => setEnemies((p) => p.map((e) => ({ ...e, hp: e.maxHp, frozenUntil: 0, confusedUntil: 0 })))} style={ghost}>HP・状態回復</button>
            <button onClick={clearAll} style={ghost}>敵を全消去</button>
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: "0.06em", marginBottom: 5 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 14,
  color: "#fff",
  background: "var(--accent)",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

const ghost: React.CSSProperties = { ...btn, background: "transparent", border: "1px solid var(--accent)" };

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "9px 12px",
    fontSize: 14,
    borderRadius: 8,
    textAlign: "center",
    cursor: "pointer",
    color: "var(--fg)",
    background: active ? "color-mix(in srgb, var(--accent) 70%, transparent)" : "rgba(255,255,255,0.06)",
    border: active ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.15)",
  };
}
