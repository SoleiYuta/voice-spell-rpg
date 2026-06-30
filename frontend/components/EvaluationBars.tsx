"use client";

// 詠唱評価バー。EvaluationResult（snake_case）をそのまま受けて、各評価項目をバー表示。
// result 状態で BattleScene / GMComment と並べて出す想定。担当: harukichi (#4)

import type { EvaluationResult, Volume } from "@/lib/types";
import styles from "./EvaluationBars.module.css";

export interface EvaluationBarsProps {
  result: EvaluationResult;
  /** 戦闘画面の隅などに小さく出す用。主要項目（一致率・完成度・威力）のみ表示。 */
  compact?: boolean;
  /** ドット風（セグメントブロックバー）表示。戦闘エフェクトと統一したい時に。 */
  pixel?: boolean;
}

const SEG_COUNT = 10; // ピクセルバーのブロック数

// 0..1 でも 0..100 でも受けられるよう正規化
function toPct(v: number): number {
  const p = v <= 1 ? v * 100 : v;
  return Math.max(0, Math.min(100, p));
}

const VOLUME_INFO: Record<Volume, { label: string; ratio: number }> = {
  quiet: { label: "小", ratio: 0.34 },
  normal: { label: "普通", ratio: 0.67 },
  loud: { label: "大", ratio: 1.0 },
};

const SPEED_REF = 200; // 速度バーの基準上限（wpm）

interface BarProps {
  label: string;
  ratio: number;
  value: string;
}

function Bar({ label, ratio, value }: BarProps) {
  return (
    <div className={styles.row}>
      <div className={styles.rowHead}>
        <span>{label}</span>
        <span className={styles.rowValue}>{value}</span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
      </div>
    </div>
  );
}

// ドット風：████████░░ のセグメントブロックバー
function SegBar({ label, ratio, value }: BarProps) {
  const on = Math.round(Math.max(0, Math.min(1, ratio)) * SEG_COUNT);
  return (
    <div className={styles.row}>
      <div className={styles.rowHead}>
        <span>{label}</span>
        <span className={styles.rowValue}>{value}</span>
      </div>
      <div className={styles.segTrack}>
        {Array.from({ length: SEG_COUNT }, (_, i) => (
          <span key={i} className={`${styles.seg} ${i < on ? styles.segOn : ""}`} />
        ))}
      </div>
    </div>
  );
}

export default function EvaluationBars({ result, compact = false, pixel = false }: EvaluationBarsProps) {
  const vol = VOLUME_INFO[result.volume] ?? VOLUME_INFO.normal;
  const matchPct = toPct(result.match_rate);
  const completionPct = toPct(result.completion_rate);
  const confidencePct = toPct(result.confidence);
  const B = pixel ? SegBar : Bar;

  return (
    <div className={`${styles.panel} ${compact ? styles.compact : ""} ${pixel ? styles.pixel : ""}`}>
      {!compact && <div className={styles.title}>詠唱評価</div>}

      <B label="発音一致率" ratio={matchPct / 100} value={`${Math.round(matchPct)}%`} />
      <B label="詠唱完成度" ratio={completionPct / 100} value={`${Math.round(completionPct)}%`} />

      {!compact && (
        <>
          <B label="自信" ratio={confidencePct / 100} value={`${Math.round(confidencePct)}%`} />
          <B label="音量" ratio={vol.ratio} value={vol.label} />
          <B label="速度" ratio={result.speed_wpm / SPEED_REF} value={`${Math.round(result.speed_wpm)} wpm`} />
          <B label="詰まり" ratio={result.hesitation_count > 0 ? Math.min(1, result.hesitation_count / 5) : 0} value={`${result.hesitation_count}回`} />
        </>
      )}

      <div className={styles.power}>
        <span className={styles.powerLabel}>詠唱威力</span>
        <span className={styles.powerValue}>{Math.round(result.spell_power)}</span>
      </div>
    </div>
  );
}
