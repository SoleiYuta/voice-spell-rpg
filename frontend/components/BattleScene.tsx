"use client";

// 戦闘画面：敵・HPバー・呪文ヒット演出。
// 設計書 §4 では `ready`（敵+HP表示）と `result`（呪文発動の演出）の2状態で登場。
// 演出は SpellEffect（ピクセルアート風）に委譲。派手さは intensity(1..5)＝詠唱精度由来。
// スプライト未用意のため敵は絵文字プレースホルダ。スタイルは CSS Module で隔離。
// 担当: harukichi (#2)

import { useEffect, useRef, useState } from "react";
import styles from "./BattleScene.module.css";
import SpellEffect, { type SpellType } from "./SpellEffect";

export interface BattleSceneProps {
  /** 敵の現在HP（0..max_hp）。state機械の enemy_hp をそのまま渡す。 */
  enemy_hp: number;
  /** 敵の最大HP。HPバーの割合計算に使う。 */
  max_hp: number;
  /** 敵の見た目（絵文字プレースホルダ）。フロアごとに差し替え可能。 */
  enemy_emoji?: string;
  /** 発動する呪文の属性。現状 "fire" のみ。 */
  spell_type?: SpellType;
  /** 1..5。詠唱精度に応じた派手さ。変化した瞬間にヒット演出を発火。 */
  intensity?: number;
  /** ダメージ数字の表示用。EvaluationResult.spell_power をそのまま渡す想定（snake_case 維持）。 */
  spell_power?: number;
}

// シェイク強度（px）をレベル別に
const SHAKE_BY_LEVEL: Record<number, number> = { 1: 0, 2: 3, 3: 6, 4: 9, 5: 14 };

export default function BattleScene({
  enemy_hp,
  max_hp,
  enemy_emoji = "👾",
  spell_type = "fire",
  intensity,
  spell_power,
}: BattleSceneProps) {
  const [hitKey, setHitKey] = useState(0);
  const lastTriggerRef = useRef<string | undefined>(undefined);

  const defeated = enemy_hp <= 0;
  const hpRatio = max_hp > 0 ? Math.max(0, Math.min(1, enemy_hp / max_hp)) : 0;
  const level = intensity ? Math.max(1, Math.min(5, Math.round(intensity))) : 0;

  // intensity / spell_power が新しく渡ってきた瞬間（= result に入った瞬間）に発火。
  useEffect(() => {
    if (intensity === undefined && spell_power === undefined) return;
    const token = `${intensity}/${spell_power}`;
    if (token === lastTriggerRef.current) return;
    lastTriggerRef.current = token;
    setHitKey((k) => k + 1);
  }, [intensity, spell_power]);

  const hitting = hitKey > 0;
  const shakeAmp = level ? SHAKE_BY_LEVEL[level] : 6;

  return (
    <div
      className={`${styles.stage} ${hitting && shakeAmp > 0 ? styles.shake : ""}`}
      key={hitKey}
      style={{ ["--amp" as string]: `${shakeAmp}px` } as React.CSSProperties}
    >
      <div className={styles.hpWrap}>
        <div className={styles.hpLabel}>ENEMY HP</div>
        <div className={styles.hpTrack}>
          <div className={styles.hpFill} style={{ width: `${hpRatio * 100}%` }} />
        </div>
      </div>

      <div
        className={`${styles.enemy} ${
          defeated ? styles.defeated : hitting ? styles.enemyHit : ""
        }`}
      >
        {enemy_emoji}
      </div>

      {/* 呪文エフェクト：発火時のみマウント（key で毎回作り直して再生） */}
      {hitting && level > 0 && (
        <SpellEffect key={`fx-${hitKey}`} type={spell_type} level={level} />
      )}

      {hitting && spell_power !== undefined && spell_power > 0 && (
        <div className={styles.damage} style={{ fontSize: damageFontSize(spell_power) }}>
          {Math.round(spell_power)}
        </div>
      )}
    </div>
  );
}

// spell_power が大きいほどダメージ数字を大きく見せる（演出上の誇張）。
function damageFontSize(power: number): number {
  return Math.min(72, 28 + power * 0.4);
}
