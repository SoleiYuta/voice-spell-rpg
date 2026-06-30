"use client";

// 最低限のプレイUI（#6）。useGameを配線して「出題→詠唱→評価→ダメージ→診断」を1周通す。
// 録音はこのページにインラインで実装（lib/audio.ts #22 とは独立。本実装が来たら差し替え可）。
// 見た目は最小限。各コンポーネント(TitleScreen/SpellCard/BattleScene等)は後で差し替える。
import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useGame } from "@/lib/useGame";

export default function Home() {
  const { state, start, beginRecord, cast, next, reset, MAX_FLOORS } = useGame();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [micError, setMicError] = useState<string | null>(null);

  async function startRecording() {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        cast(new Blob(chunksRef.current, { type: "audio/webm" }));
      };
      recorder.start();
      recorderRef.current = recorder;
      beginRecord();
    } catch {
      setMicError("マイクを使えませんでした（ブラウザの許可が必要です）");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  const nextLabel =
    state.enemy_hp > 0
      ? "もう一度詠唱"
      : state.floor >= MAX_FLOORS
        ? "結果を見る"
        : "次のフロアへ";

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 24, textAlign: "center" }}>
      <h1 style={{ color: "var(--accent)" }}>AI Grimoire</h1>

      {state.error && <p style={{ color: "tomato" }}>エラー: {state.error}</p>}
      {micError && <p style={{ color: "tomato" }}>{micError}</p>}

      {state.phase === "title" && (
        <>
          <p style={{ opacity: 0.7 }}>声で呪文を詠唱して戦え。AIがお前の声を見抜く。</p>
          <button style={btn} onClick={start}>はじめる</button>
        </>
      )}

      {state.phase === "presenting" && <p>魔導書が呪文を授けている……</p>}

      {(state.phase === "ready" || state.phase === "recording") && state.spell && (
        <>
          <p style={{ opacity: 0.7 }}>フロア {state.floor} / {MAX_FLOORS}</p>
          <EnemyBar hp={state.enemy_hp} max={state.enemy_max_hp} />
          <Card>
            <div style={{ fontSize: 13, opacity: 0.6 }}>
              {state.spell.spell_type} ・ 難易度 {state.spell.difficulty}
            </div>
            <div style={{ fontSize: 22, margin: "8px 0" }}>「{state.spell.spell_text}」</div>
          </Card>
          {state.phase === "ready" ? (
            <button style={btn} onClick={startRecording}>🎤 詠唱する（録音開始）</button>
          ) : (
            <button style={{ ...btn, background: "tomato" }} onClick={stopRecording}>
              ■ 詠唱おわり（送信）
            </button>
          )}
        </>
      )}

      {state.phase === "evaluating" && <p>魔導書が声を見極めている……</p>}

      {state.phase === "result" && state.last && (
        <>
          <EnemyBar hp={state.enemy_hp} max={state.enemy_max_hp} />
          <Card>
            <div style={{ fontSize: 13, opacity: 0.6 }}>認識: 「{state.last.transcript}」</div>
            <Bar label="一致率" v={state.last.match_rate} />
            <div style={{ fontSize: 13, opacity: 0.8, margin: "6px 0" }}>
              声量 {state.last.volume} ・ {state.last.speed_wpm} wpm ・ 詰まり {state.last.hesitation_count}
            </div>
            <div style={{ fontSize: 18, color: "var(--accent)" }}>威力 {state.last.spell_power}</div>
            <p style={{ fontStyle: "italic", marginTop: 10 }}>“{state.last.gm_comment}”</p>
          </Card>
          {state.enemy_hp <= 0 && <p>✨ 敵を撃破した！</p>}
          <button style={btn} onClick={next}>{nextLabel}</button>
        </>
      )}

      {state.phase === "gameResult" && state.result && (
        <>
          <h2 style={{ color: "var(--accent)" }}>あなたは「{state.result.type_name}」</h2>
          <Card>
            <p style={{ fontSize: 17 }}>{state.result.ai_verdict}</p>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 10 }}>
              ベスト詠唱: 「{state.result.best_floor.spell_text}」(威力 {state.result.best_floor.spell_power})
            </div>
          </Card>
          <button style={btn} onClick={reset}>もう一度遊ぶ</button>
        </>
      )}
    </main>
  );
}

const btn: CSSProperties = {
  marginTop: 16,
  padding: "12px 28px",
  fontSize: 16,
  color: "#fff",
  background: "var(--accent)",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

function Card({ children }: { children: ReactNode }) {
  return (
    <div style={{ margin: "16px 0", padding: 18, border: "1px solid var(--accent)", borderRadius: 12 }}>
      {children}
    </div>
  );
}

function EnemyBar({ hp, max }: { hp: number; max: number }) {
  const pct = max > 0 ? Math.max(0, (hp / max) * 100) : 0;
  return (
    <div style={{ margin: "8px 0" }}>
      <div style={{ fontSize: 12, opacity: 0.7, textAlign: "left" }}>敵 HP</div>
      <div style={{ height: 12, background: "#333", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "tomato", transition: "width .4s" }} />
      </div>
    </div>
  );
}

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div style={{ margin: "4px 0", textAlign: "left" }}>
      <span style={{ fontSize: 12, opacity: 0.7 }}>
        {label} {Math.round(v * 100)}%
      </span>
      <div style={{ height: 8, background: "#333", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, v * 100)}%`, height: "100%", background: "var(--accent)" }} />
      </div>
    </div>
  );
}
