"use client";

// 全画面ローディング/ロード画面。AI(Gemini/STT)への送信待ちや、勝敗後の結果生成待ちに出す。
// - presenting（呪文生成中）/ evaluating（声評価中）/ finishing（結果生成中）で使い回す。
// 魔法陣（多重リング）＋周回ルーン＋ドット魔導書＋不定進捗バー＋アニメする三点リーダ。
import PixelGrimoire from "./PixelGrimoire";
import styles from "./LoadingScreen.module.css";

export interface LoadingScreenProps {
  message?: string;
  /** 🏆 / 💀 などの見出しバッジ（結果生成中に勝敗を出す用）。 */
  badge?: string;
  /** 配色。magic=紫 / victory=金緑 / defeat=赤。 */
  tone?: "magic" | "victory" | "defeat";
}

export default function LoadingScreen({ message = "魔導書が力を集めている", badge, tone = "magic" }: LoadingScreenProps) {
  return (
    <div className={`${styles.overlay} ${styles[tone]}`} role="status" aria-live="polite">
      <div className={styles.stage}>
        {badge && <div className={styles.badge}>{badge}</div>}

        <div className={styles.circle}>
          <span className={`${styles.ring} ${styles.r1}`} />
          <span className={`${styles.ring} ${styles.r2}`} />
          <span className={`${styles.ring} ${styles.r3}`} />
          <span className={styles.orbit}><i /></span>
          <span className={`${styles.orbit} ${styles.orbitB}`}><i /></span>
          <div className={styles.core}>
            <PixelGrimoire cell={6} mood="idle" variant="A" />
          </div>
        </div>

        <p className={styles.message}>
          {message}
          <span className={styles.dots}><i>.</i><i>.</i><i>.</i></span>
        </p>

        <div className={styles.bar}><span /></div>
      </div>
    </div>
  );
}
