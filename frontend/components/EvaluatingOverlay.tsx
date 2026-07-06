"use client";

// 評価中ローディング（魔法陣＋魔導書）。#17 / 担当: kazuma660
// phase === "evaluating" の間だけ全画面オーバーレイで出す。純View（表示制御は呼び側）。
// 中央に PixelGrimoire（声を見極める＝idle）、周囲に点描ドットのルーン環。

import PixelGrimoire from "./PixelGrimoire";
import styles from "./EvaluatingOverlay.module.css";

export interface EvaluatingOverlayProps {
  /** 表示するか（useGame の phase === "evaluating"）。 */
  visible: boolean;
  message?: string;
}

export default function EvaluatingOverlay({
  visible,
  message = "魔導書が声を見極めている……",
}: EvaluatingOverlayProps) {
  if (!visible) return null;
  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <div className={styles.circle}>
        <div className={`${styles.ring} ${styles.ringOuter}`} />
        <div className={`${styles.ring} ${styles.ringInner}`} />
        <div className={styles.grimoire}>
          <PixelGrimoire cell={6} mood="idle" variant="A" />
        </div>
      </div>
      <p className={styles.message}>{message}</p>
    </div>
  );
}
