"use client";

// タイトル / スタート画面。#17 / 担当: kazuma660 → 演出強化(#65)
// ボタンで onStart() を呼ぶだけ（useGame の start に配線する）。純View。
// 背景に漂う火の粉＋魔導書の後ろに回転する魔法陣、ロゴのグローパルス、隠しコマンドのヒント。

import PixelGrimoire from "./PixelGrimoire";
import styles from "./TitleScreen.module.css";

export interface TitleScreenProps {
  onStart: () => void;
  /** 起動処理中などボタンを押させたくない時に。 */
  disabled?: boolean;
}

export default function TitleScreen({ onStart, disabled }: TitleScreenProps) {
  return (
    <div className={styles.root}>
      {/* 背景演出：立ち昇る火の粉 */}
      <div className={styles.embers} aria-hidden>
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 7 + 4) % 100}%`,
              animationDelay: `${(i % 7) * 0.8}s`,
              animationDuration: `${6 + (i % 5)}s`,
            }}
          />
        ))}
      </div>

      <p className={styles.tag}>◆ AI 声詠唱ローグライク ◆</p>

      <div className={styles.grimoire}>
        <span className={styles.circle} aria-hidden />
        <PixelGrimoire cell={9} mood="idle" variant="A" />
      </div>

      <h1 className={styles.title}>AI GRIMOIRE</h1>
      <p className={styles.lead}>
        声で呪文を詠唱して戦え。
        <br />
        魔導書がお前の声を見抜く。
      </p>

      <button className={styles.start} onClick={onStart} disabled={disabled}>
        ▶ はじめる
      </button>

      <p className={styles.hint}>◇ 隠しコマンド、あるかも… ◇</p>
    </div>
  );
}
