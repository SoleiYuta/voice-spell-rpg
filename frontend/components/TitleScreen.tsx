"use client";

// タイトル / スタート画面。#17 / 担当: kazuma660
// ボタンで onStart() を呼ぶだけ（useGame の start に配線する）。純View。
// 絵作りは PixelGrimoire / BattleScene に統一（ドット魔導書・濃紫/クリーム/金）。

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
      <p className={styles.tag}>◆ AI 声詠唱ローグライク ◆</p>

      <div className={styles.grimoire}>
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
    </div>
  );
}
