"use client";

// ゲーム本体（二部構成の統合UI）。useGame の状態機械を配線する。
// ■ 第1部 詠唱パート: TitleScreen / SpellCard(+TTS) / RecordButton(押して詠唱) / EvaluatingOverlay
//   → forged で威力(=武器)を提示し「戦線へ」。
// ■ 第2部 ヴァンサバモード: SurvivalMode（Canvasアクション）。撃破でレベルUP。
// ■ レベルUP時は SurvivalMode を凍結(paused)したまま、上に詠唱UIを重ねて新呪文を詠唱→復帰。
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
import SurvivalMode from "@/components/SurvivalMode";
import { moodFromMatchRate } from "@/components/PixelGrimoire";

const CHANT_PHASES = new Set(["presenting", "ready", "recording", "evaluating", "forged"]);

export default function Home() {
  const { state, start, beginRecord, cast, enterSurvival, levelUp, finish, reset, SURVIVE_SEC } =
    useGame();
  const [micError, setMicError] = useState<string | null>(null);

  const isChant = CHANT_PHASES.has(state.phase);
  const showSurvival = state.survivalStarted && state.phase !== "gameResult";

  // 詠唱パートのUI（初回=フルスクリーン / レベルUP時=戦線の上にオーバーレイ、で使い回す）
  const chantUI = (
    <>
      {state.phase === "presenting" && (
        <EvaluatingOverlay visible message="魔導書が新たな呪文を授けている……" />
      )}

      {(state.phase === "ready" || state.phase === "recording") && state.spell && (
        <div style={{ textAlign: "center" }}>
          <p style={{ opacity: 0.8, fontFamily: "var(--pixel-font)", fontSize: 13 }}>
            {state.survivalStarted ? `レベル${state.level}・新呪文を詠唱！` : "最初の呪文を詠唱せよ"}
          </p>
          <SpellCard spell={state.spell} autoSpeak={state.phase === "ready"} />
          <div style={{ marginTop: 8 }}>
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
        </div>
      )}

      {state.phase === "evaluating" && <EvaluatingOverlay visible />}

      {state.phase === "forged" && state.last && (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--accent)", fontFamily: "var(--pixel-font)" }}>⚡ 魔法を鍛造した！</p>
          <div style={{ margin: "10px 0", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <EvaluationBars result={state.last} pixel compact />
            <GMComment
              comment={state.last.gm_comment}
              pixel
              mood={moodFromMatchRate(state.last.match_rate)}
            />
          </div>
          <button style={btn} onClick={enterSurvival}>
            {state.survivalStarted ? "▶ 戦線へ戻る" : "▶ 戦線へ"}
          </button>
        </div>
      )}
    </>
  );

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 16, textAlign: "center" }}>
      <h1 style={{ color: "var(--accent)", fontFamily: "var(--pixel-font)", fontSize: 22, margin: "4px 0 10px" }}>
        AI GRIMOIRE
      </h1>
      {state.error && <p style={{ color: "tomato" }}>エラー: {state.error}</p>}
      {micError && <p style={{ color: "tomato" }}>{micError}</p>}

      {state.phase === "title" && <TitleScreen onStart={start} />}

      {/* 初回詠唱（まだ戦線に出ていない）→ フルスクリーン */}
      {!state.survivalStarted && isChant && chantUI}

      {/* ヴァンサバ本体：戦線に出たら常時マウント。詠唱中は paused で凍結し、上に詠唱UIを重ねる */}
      {showSurvival && (
        <div style={{ position: "relative" }}>
          <SurvivalMode
            weapons={state.weapons}
            durationSec={SURVIVE_SEC}
            paused={state.phase !== "survival"}
            onLevelUp={levelUp}
            onFinish={finish}
          />
          {isChant && (
            <div style={overlay}>
              <div style={overlayInner}>{chantUI}</div>
            </div>
          )}
        </div>
      )}

      {state.phase === "gameResult" && state.result && (
        <>
          <p
            style={{
              fontFamily: "var(--pixel-font)",
              color: state.outcome === "victory" ? "#5ce08a" : "tomato",
            }}
          >
            {state.outcome === "victory" ? `🏆 ${SURVIVE_SEC}秒 生存成功！` : "💀 力尽きた……"}
          </p>
          <ResultScreen key={state.result.session_id} result={state.result} onRestart={reset} />
        </>
      )}
    </main>
  );
}

const btn: CSSProperties = {
  marginTop: 12,
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

// 戦線を凍結したまま詠唱UIを重ねるオーバーレイ
const overlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
  background: "rgba(10,6,20,0.72)",
  borderRadius: 8,
  overflowY: "auto",
};

const overlayInner: CSSProperties = {
  width: "100%",
  maxWidth: 440,
};
