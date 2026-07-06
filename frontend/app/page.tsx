"use client";

// ゲーム本体（統合UI）。kazuma660 の詠唱UI（#3 #17 #22）をメインに、useGame へ配線する。
// - TitleScreen      … タイトル（onStart → start）
// - SpellCard        … 出題呪文の表示（+TTS読み上げ）
// - RecordButton     … 押して詠唱→離して送信（lib/audio.ts / onBegin→beginRecord, onCast→cast）
// - EvaluatingOverlay… 生成中/評価中の全画面ローディング
// 評価バー(EvaluationBars)・総評(GMComment)・リザルト(ResultScreen) は既存(harukichi)を流用。
// 敵HPは kazuma のドット調に合わせた最小バー(EnemyBar)で表示（BattleField は不採用）。

import { useState } from "react";
import type { CSSProperties } from "react";
import { useGame } from "@/lib/useGame";
import EvaluationBars from "@/components/EvaluationBars";
import GMComment from "@/components/GMComment";
import ResultScreen from "@/components/ResultScreen";
import TitleScreen from "@/components/TitleScreen";
import SpellCard from "@/components/SpellCard";
import RecordButton from "@/components/RecordButton";
import EvaluatingOverlay from "@/components/EvaluatingOverlay";
import { moodFromMatchRate } from "@/components/PixelGrimoire";

export default function Home() {
  const { state, start, beginRecord, cast, next, reset, MAX_FLOORS } = useGame();
  const [micError, setMicError] = useState<string | null>(null);

  const nextLabel =
    state.enemy_hp > 0
      ? "もう一度詠唱"
      : state.floor >= MAX_FLOORS
        ? "結果を見る"
        : "次のフロアへ";

  // バトル画面（呪文カード＋敵HP）を出すフェーズ
  const inBattle =
    state.phase === "ready" ||
    state.phase === "recording" ||
    state.phase === "evaluating" ||
    state.phase === "result";
  const inResult = state.phase === "result" && !!state.last;

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px", textAlign: "center" }}>
      {state.error && <p style={{ color: "tomato" }}>エラー: {state.error}</p>}
      {micError && <p style={{ color: "tomato" }}>{micError}</p>}

      {state.phase === "title" && <TitleScreen onStart={start} />}

      {/* 呪文生成中（presenting）は全画面オーバーレイ */}
      <EvaluatingOverlay
        visible={state.phase === "presenting"}
        message="魔導書が呪文を授けている……"
      />

      {inBattle && state.spell && (
        <>
          <p style={{ opacity: 0.7, fontFamily: "var(--pixel-font)", fontSize: 13 }}>
            フロア {state.floor} / {MAX_FLOORS}
          </p>

          <EnemyBar hp={state.enemy_hp} max={state.enemy_max_hp} />

          <SpellCard spell={state.spell} autoSpeak={state.phase === "ready"} />

          {(state.phase === "ready" || state.phase === "recording") && (
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <RecordButton
                recording={state.phase === "recording"}
                onBegin={() => {
                  setMicError(null);
                  beginRecord();
                }}
                onCast={cast}
                onError={setMicError}
              />
            </div>
          )}
        </>
      )}

      {inResult && (
        <>
          <div style={{ margin: "14px 0", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <EvaluationBars result={state.last!} pixel compact />
            <GMComment
              comment={state.last!.gm_comment}
              pixel
              mood={moodFromMatchRate(state.last!.match_rate)}
            />
          </div>
          {state.enemy_hp <= 0 && (
            <p style={{ color: "var(--accent)", fontFamily: "var(--pixel-font)" }}>✨ 敵を撃破した！</p>
          )}
          <button style={btn} onClick={next}>{nextLabel}</button>
        </>
      )}

      {/* 評価中（evaluating）は上に全画面オーバーレイ */}
      <EvaluatingOverlay visible={state.phase === "evaluating"} />

      {state.phase === "gameResult" && state.result && (
        <ResultScreen key={state.result.session_id} result={state.result} onRestart={reset} />
      )}
    </main>
  );
}

// 敵HPバー（kazuma のドット調に合わせた最小表示。角ばった枠＋ピクセルフォント）
function EnemyBar({ hp, max }: { hp: number; max: number }) {
  const pct = max > 0 ? Math.max(0, (hp / max) * 100) : 0;
  const defeated = hp <= 0;
  return (
    <div style={{ margin: "10px auto", maxWidth: 420 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--pixel-font)",
          fontSize: 12,
          opacity: 0.85,
          marginBottom: 4,
        }}
      >
        <span>{defeated ? "敵 撃破！" : "敵 HP"}</span>
        <span>{Math.max(0, Math.ceil(pct))}%</span>
      </div>
      <div style={{ height: 14, background: "rgba(0,0,0,0.35)", border: "2px solid var(--accent)", overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: defeated ? "#c8341a" : "var(--accent)",
            transition: "width .45s ease-out",
          }}
        />
      </div>
    </div>
  );
}

const btn: CSSProperties = {
  marginTop: 14,
  padding: "10px 24px",
  fontSize: 15,
  color: "#fff",
  background: "var(--accent)",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: "var(--pixel-font)",
  boxShadow: "3px 3px 0 rgba(0,0,0,0.4)",
};
