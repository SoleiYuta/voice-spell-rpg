"use client";

// 操作チュートリアル（モーダル）。#71 / 担当: satoryudev
// タイトル画面の「🎮 遊びかた」から開く。純View（open/onClose のみ）。

import { useEffect } from "react";
import styles from "./Tutorial.module.css";

const STEPS = [
  { n: 1, em: "🎙️", t: "声で詠唱", d: "表示された呪文を声に出す。正確さ・声量・気迫で魔法の威力が決まる。" },
  { n: 2, em: "🕹️", t: "移動する", d: "ドラッグ（スマホ）／ WASD（PC）でキャラを動かす。" },
  { n: 3, em: "⚔️", t: "攻撃は自動", d: "装備した魔法が近くの敵へ自動で発射。属性で挙動が変わる。" },
  { n: 4, em: "⏱️", t: "30秒サバイブ", d: "生き延びるとレベルUP。新しい呪文を3択で授かる。" },
  { n: 5, em: "👑", t: "最終ボス", d: "レベルが上がりきると強敵が出現。攻撃をかわして倒せ。" },
];

export default function Tutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="遊びかた">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>◇ 遊びかた ◇</h2>
        <div className={styles.steps}>
          {STEPS.map((s) => (
            <div key={s.n} className={styles.step}>
              <span className={styles.n}>{s.n}</span>
              <span className={styles.em} aria-hidden>{s.em}</span>
              <span className={styles.st}>
                <b>{s.t}</b>
                <span>{s.d}</span>
              </span>
            </div>
          ))}
        </div>
        <div className={styles.demo} aria-hidden>
          <span className={styles.mage} />
          <span className={styles.finger} />
        </div>
        <p className={styles.demoCap}>↑ ドラッグでキャラを動かす</p>
        <button type="button" className={styles.close} onClick={onClose}>
          とじる
        </button>
      </div>
    </div>
  );
}
