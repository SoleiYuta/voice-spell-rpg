"use client";

// リザルト画面（gameResult 状態で表示）。
// 既存の GMComment / PixelGrimoire を再利用しつつ、
// 診断タイプ見出し・ベスト詠唱・統計セクション・リスタートを追加。
// 設計: wiki/AI-Grimoire/11_リザルト診断設計。担当: harukichi (#18)

import GMComment from "./GMComment";
import { moodFromMatchRate, pickGrimoireVariant, type GrimoireVariant } from "./PixelGrimoire";
import type { ResultData, Volume } from "@/lib/types";
import styles from "./ResultScreen.module.css";

const SEG_COUNT = 10;
const VOLUME_LABEL: Record<Volume, string> = { quiet: "小", normal: "普通", loud: "大" };

export interface ResultScreenProps {
  result: ResultData;
  /** 「もう一度遊ぶ」押下。省略時はボタン非表示。 */
  onRestart?: () => void;
  /** 魔導書の A/B バリアント。省略時は内部でランダム選択。 */
  variant?: GrimoireVariant | "random";
}

function toPct(v: number): number {
  const p = v <= 1 ? v * 100 : v;
  return Math.max(0, Math.min(100, p));
}

function SegBar({ ratio }: { ratio: number }) {
  const on = Math.round(Math.max(0, Math.min(1, ratio)) * SEG_COUNT);
  return (
    <div className={styles.segTrack}>
      {Array.from({ length: SEG_COUNT }, (_, i) => (
        <span key={i} className={`${styles.seg} ${i < on ? styles.segOn : ""}`} />
      ))}
    </div>
  );
}

export default function ResultScreen({ result, onRestart, variant = "random" }: ResultScreenProps) {
  const matchPct = toPct(result.stats.avg_match_rate);
  const mood = moodFromMatchRate(result.stats.avg_match_rate);

  return (
    <div className={styles.screen}>
      {/* 診断タイプ見出し */}
      <div className={styles.headline}>
        <div className={styles.headlineLabel}>― あなたの詠唱型 ―</div>
        <div className={styles.headlineType}>「{result.type_name}」</div>
      </div>

      {/* 魔導書＋Gemini総評（GMComment 流用） */}
      <GMComment comment={result.ai_verdict} pixel mood={mood} variant={variant} speedMs={30} />

      {/* ベスト詠唱 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>― ベスト詠唱 ―</div>
        <div className={styles.bestSpell}>「{result.best_floor.spell_text}」</div>
        <div className={styles.bestPower}>
          <span className={styles.bestPowerLabel}>威力</span>
          <span className={styles.bestPowerValue}>{Math.round(result.best_floor.spell_power)}</span>
        </div>
      </div>

      {/* 統計 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>― 統計 ―</div>

        <div className={styles.statRow}>
          <div className={styles.statHead}>
            <span>平均一致率</span>
            <span className={styles.statValue}>{Math.round(matchPct)}%</span>
          </div>
          <SegBar ratio={matchPct / 100} />
        </div>

        <div className={styles.statRow}>
          <div className={styles.statHead}>
            <span>平均音量</span>
            <span className={styles.statValue}>{VOLUME_LABEL[result.stats.avg_volume]}</span>
          </div>
        </div>

        <div className={styles.statRow}>
          <div className={styles.statHead}>
            <span>詰まり合計</span>
            <span className={styles.statValue}>{result.stats.total_hesitation} 回</span>
          </div>
        </div>
      </div>

      {onRestart && (
        <button className={styles.restart} onClick={onRestart}>
          もう一度遊ぶ
        </button>
      )}
    </div>
  );
}

// もう一度リザルトを見るときは呪文＆診断タイプが変わっている可能性があるので、
// 統合側で `<ResultScreen key={result.session_id} ... />` として再マウントすると
// 魔導書リアクションと GMComment のタイプライターがきれいに再生される。
// production統合の参考実装は /dev/result を参照。
export { pickGrimoireVariant };
