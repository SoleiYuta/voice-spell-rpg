"use client";

// 出題呪文の表示（＋TTS読み上げ）。#3 / 担当: kazuma660
// SpellData を受けて呪文テキスト・属性・難易度を出す純View。
// TTS は「余裕があれば」枠（設計書§10）なのでブラウザ標準 SpeechSynthesis で軽く実装。

import { useCallback, useEffect } from "react";
import type { CSSProperties } from "react";
import type { SpellData } from "@/lib/types";
import styles from "./SpellCard.module.css";

export interface SpellCardProps {
  spell: SpellData;
  /** 表示時に自動で読み上げる（presenting 状態など）。 */
  autoSpeak?: boolean;
}

// 属性ごとの色（クリーム地に映えるよう濃いめ。未知の属性は表紙紫）
const TYPE_COLOR: Record<string, string> = {
  fire: "#c8341a",
  water: "#1a6fc8",
  wind: "#1f9e5a",
  earth: "#9a6a2a",
  thunder: "#c8961e",
};

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

export default function SpellCard({ spell, autoSpeak }: SpellCardProps) {
  const color = TYPE_COLOR[spell.spell_type] ?? "#6a2fb0";

  const handleSpeak = useCallback(() => speak(spell.spell_text), [spell.spell_text]);

  useEffect(() => {
    if (autoSpeak) speak(spell.spell_text);
    return () => window.speechSynthesis?.cancel();
  }, [autoSpeak, spell.spell_text]);

  return (
    <div className={styles.card} style={{ "--type": color } as CSSProperties}>
      <div className={styles.meta}>
        <span className={styles.type}>{spell.spell_type}</span>
        <span className={styles.difficulty}>
          {"★".repeat(Math.max(1, Math.min(5, spell.difficulty)))}
        </span>
      </div>

      <p className={styles.text}>「{spell.spell_text}」</p>

      <div className={styles.footer}>
        <span className={styles.len}>約 {spell.expected_length_sec} 秒</span>
        <button className={styles.speak} onClick={handleSpeak} aria-label="呪文を読み上げる">
          🔊 読み上げ
        </button>
      </div>
    </div>
  );
}
