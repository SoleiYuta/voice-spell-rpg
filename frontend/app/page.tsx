"use client";

// ゲーム本体（統合UI）。useGame の状態機械に合わせて、既存のドット風コンポーネントを配線する。
// - BattleScene    … 戦闘画面（敵/HP/ヒット演出。result時に spell_power で発火）
// - SpellEffect    … 属性エフェクト（BattleScene 内部で使用）
// - EvaluationBars … 詠唱評価バー（result時、compact+pixel）
// - GMComment      … Gemini総評の魔導書コメント（pixel + mood/variant）
// - ResultScreen   … 最終リザルト（診断タイプ/総評/ベスト詠唱/統計）
//
// 録音はインライン実装のまま（lib/audio.ts #22 が入ったら差し替え可）。
// #6 の最小限UIを、私(harukichi)の作ったコンポーネントに差し替え。
// 差し替え担当外の可能性があるので、develop 直接ではなく feature ブランチで実装。

import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useGame } from "@/lib/useGame";
import BattleArena from "@/components/BattleArena";
import type { SpellType } from "@/components/SpellEffect";
import EvaluationBars from "@/components/EvaluationBars";
import GMComment from "@/components/GMComment";
import ResultScreen from "@/components/ResultScreen";
import { moodFromMatchRate } from "@/components/PixelGrimoire";

// バックエンドの spell_type 文字列を SpellEffect の型に寄せる（未知は炎にフォールバック）
const SPELL_TYPE_MAP: Record<string, SpellType> = {
  fire: "fire", flame: "fire", 炎: "fire",
  ice: "ice", frost: "ice", 氷: "ice",
  thunder: "thunder", lightning: "thunder", 雷: "thunder",
  dark: "dark", shadow: "dark", 闇: "dark",
};
function mapSpellType(raw: string | undefined): SpellType {
  if (!raw) return "fire";
  return SPELL_TYPE_MAP[raw.toLowerCase()] ?? SPELL_TYPE_MAP[raw] ?? "fire";
}

// match_rate(0..1 or 0..100) から派手さ Lv(1..5) を算出
function intensityFromMatchRate(matchRate: number): number {
  const p = matchRate <= 1 ? matchRate : matchRate / 100;
  return Math.max(1, Math.min(5, Math.ceil(p * 5)));
}

// フロア毎の敵ビジュアル（絵文字プレースホルダ）
function enemyEmojiForFloor(floor: number): string {
  return floor >= 2 ? "🐉" : "👾";
}

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

  // 戦闘画面(BattleScene)を出すフェーズ
  const showBattle =
    state.phase === "ready" ||
    state.phase === "recording" ||
    state.phase === "evaluating" ||
    state.phase === "result";
  const inResult = state.phase === "result" && !!state.last;
  const spellType = mapSpellType(state.spell?.spell_type);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px", textAlign: "center" }}>
      <h1 style={{ color: "var(--accent)", fontFamily: "var(--pixel-font)" }}>AI Grimoire</h1>

      {state.error && <p style={{ color: "tomato" }}>エラー: {state.error}</p>}
      {micError && <p style={{ color: "tomato" }}>{micError}</p>}

      {state.phase === "title" && (
        <>
          <p style={{ opacity: 0.7 }}>声で呪文を詠唱して戦え。AIがお前の声を見抜く。</p>
          <button style={btn} onClick={start}>はじめる</button>
        </>
      )}

      {state.phase === "presenting" && <p>魔導書が呪文を授けている……</p>}

      {showBattle && state.spell && (
        <>
          <p style={{ opacity: 0.7, fontFamily: "var(--pixel-font)" }}>
            フロア {state.floor} / {MAX_FLOORS}
          </p>

          <BattleArena
            enemy_hp={state.enemy_hp}
            max_hp={state.enemy_max_hp}
            enemy_emoji={enemyEmojiForFloor(state.floor)}
            spell_type={spellType}
            intensity={inResult ? intensityFromMatchRate(state.last!.match_rate) : undefined}
            spell_power={inResult ? state.last!.spell_power : undefined}
            charging={state.phase === "recording"}
          />

          <Card>
            <div style={{ fontSize: 12, opacity: 0.6, fontFamily: "var(--pixel-font)" }}>
              {state.spell.spell_type} ・ 難易度 {state.spell.difficulty}
            </div>
            <div style={{ fontSize: 20, margin: "6px 0", fontFamily: "var(--pixel-font)" }}>
              「{state.spell.spell_text}」
            </div>
          </Card>

          {state.phase === "ready" && (
            <button style={btn} onClick={startRecording}>🎤 詠唱する（録音開始）</button>
          )}
          {state.phase === "recording" && (
            <button style={{ ...btn, background: "tomato" }} onClick={stopRecording}>
              ■ 詠唱おわり（送信）
            </button>
          )}
          {state.phase === "evaluating" && <p>魔導書が声を見極めている……</p>}
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

      {state.phase === "gameResult" && state.result && (
        <ResultScreen key={state.result.session_id} result={state.result} onRestart={reset} />
      )}
    </main>
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

function Card({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        margin: "12px 0",
        padding: 14,
        border: "2px solid var(--accent)",
        background: "color-mix(in srgb, var(--accent) 8%, var(--bg))",
        boxShadow: "0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent)",
      }}
    >
      {children}
    </div>
  );
}
