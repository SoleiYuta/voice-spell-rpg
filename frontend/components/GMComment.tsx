"use client";

// AI魔導書（ゲームマスター）の煽りコメント。gm_comment(Gemini出力)を魔導書風の吹き出しで表示。
// タイプライター演出付き。result 状態で EvaluationBars と並べて出す想定。担当: harukichi (#4)

import { useEffect, useState } from "react";
import PixelGrimoire, { type GrimoireMood, type GrimoireVariant } from "./PixelGrimoire";
import styles from "./GMComment.module.css";

export interface GMCommentProps {
  comment: string;
  /** 1文字あたりの表示間隔(ms)。0でタイプライター無効。 */
  speedMs?: number;
  /** ドット風（角ばった枠・等幅）表示。 */
  pixel?: boolean;
  /** 魔導書の反応（評価結果に応じて）。ドット風表示時のみ反映。 */
  mood?: GrimoireMood;
  /** バリエーション。本番では未指定="random"で内部ランダム選択（key変更で再ランダム）。 */
  variant?: GrimoireVariant | "random";
}

export default function GMComment({ comment, speedMs = 38, pixel = false, mood = "idle", variant = "random" }: GMCommentProps) {
  const [shown, setShown] = useState(speedMs > 0 ? "" : comment);

  useEffect(() => {
    if (speedMs <= 0) {
      setShown(comment);
      return;
    }
    setShown("");
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setShown(comment.slice(0, i));
      if (i >= comment.length) clearInterval(timer);
    }, speedMs);
    return () => clearInterval(timer);
  }, [comment, speedMs]);

  const typing = speedMs > 0 && shown.length < comment.length;

  return (
    <div className={styles.wrap}>
      {pixel ? <div className={styles.book}><PixelGrimoire cell={4} mood={mood} variant={variant} /></div> : <div className={styles.book}>📖</div>}
      <div className={`${styles.bubble} ${pixel ? styles.pixel : ""}`}>
        {shown}
        {typing && <span className={styles.caret}>▌</span>}
      </div>
    </div>
  );
}
