"use client";

// 【開発用】kazuma660 担当コンポーネントの単体確認ページ。#3 / #17 / #22
// バックエンド不要。ローカル state でフェーズを切り替え、録音は実際に動く（録音結果を再生確認できる）。
// 本番の配線は app/page.tsx（useGame）側。ここは見た目と録音の動作確認専用。
import { useState } from "react";
import TitleScreen from "@/components/TitleScreen";
import SpellCard from "@/components/SpellCard";
import RecordButton from "@/components/RecordButton";
import EvaluatingOverlay from "@/components/EvaluatingOverlay";
import { sfx } from "@/lib/sfx";
import type { SpellData } from "@/lib/types";

// #56 効果音の単体確認。クリックで各SEを個別に鳴らせる。
const SFX_TESTS: { label: string; play: () => void }[] = [
  { label: "詠唱開始", play: () => sfx.playChantStart() },
  { label: "詠唱送信", play: () => sfx.playCast() },
  { label: "命中", play: () => sfx.playHit() },
  { label: "撃破", play: () => sfx.playKill() },
  { label: "レベルUP", play: () => sfx.playLevelUp() },
  { label: "勝利", play: () => sfx.playWin() },
  { label: "敗北", play: () => sfx.playLose() },
];

const MOCK_SPELL: SpellData = {
  spell_text: "紅蓮の炎よ、我が敵を焼き尽くせ",
  difficulty: 3,
  spell_type: "fire",
  expected_length_sec: 4,
};

type Phase = "title" | "ready" | "recording" | "evaluating";

export default function CastDevPage() {
  const [phase, setPhase] = useState<Phase>("title");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (m: string) => setLog((l) => [`${m}`, ...l].slice(0, 6));

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: 20 }}>
      <div style={bar}>
        <strong style={{ fontFamily: "var(--pixel-font)" }}>DEV: cast components</strong>
        <span style={{ opacity: 0.6, fontSize: 12 }}>phase = {phase}</span>
        {(["title", "ready", "recording", "evaluating"] as Phase[]).map((p) => (
          <button key={p} style={chip(phase === p)} onClick={() => setPhase(p)}>
            {p}
          </button>
        ))}
      </div>

      {/* #56 効果音テスト：各SEを個別に鳴らして確認 */}
      <div style={sfxBar}>
        <strong style={{ fontFamily: "var(--pixel-font)", fontSize: 13 }}>🔊 SE test</strong>
        {SFX_TESTS.map((s) => (
          <button key={s.label} style={chip(false)} onClick={() => { s.play(); addLog(`SE: ${s.label}`); }}>
            {s.label}
          </button>
        ))}
        <button style={chip(false)} onClick={() => addLog(`mute → ${sfx.toggleMute()}`)}>
          mute切替
        </button>
      </div>

      {error && <p style={{ color: "tomato" }}>{error}</p>}

      {phase === "title" && (
        <TitleScreen
          onStart={() => {
            addLog("onStart → ready");
            setPhase("ready");
          }}
        />
      )}

      {(phase === "ready" || phase === "recording") && (
        <>
          <SpellCard spell={MOCK_SPELL} />
          <div style={{ textAlign: "center" }}>
            <RecordButton
              recording={phase === "recording"}
              onBegin={() => {
                addLog("onBegin（録音開始）");
                setError(null);
                setPhase("recording");
              }}
              onCast={(blob) => {
                addLog(`onCast: ${blob.type} / ${(blob.size / 1024).toFixed(1)} KB`);
                setAudioUrl(URL.createObjectURL(blob));
                setPhase("evaluating");
                // デモ：2秒後に ready へ戻す（本番は evaluate 完了で result へ）
                setTimeout(() => setPhase("ready"), 2000);
              }}
              onError={(m) => {
                setError(m);
                setPhase("ready");
              }}
            />
          </div>
        </>
      )}

      <EvaluatingOverlay visible={phase === "evaluating"} />

      {audioUrl && (
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <p style={{ fontSize: 12, opacity: 0.6 }}>▼ 直近の録音（再生して確認）</p>
          <audio src={audioUrl} controls />
        </div>
      )}

      {log.length > 0 && (
        <pre style={logBox}>{log.map((l, i) => `> ${l}`).join("\n")}</pre>
      )}
    </main>
  );
}

const bar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  padding: "10px 0",
  borderBottom: "1px solid rgba(160,107,255,0.3)",
  marginBottom: 16,
};
const sfxBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  padding: "10px 0",
  borderBottom: "1px solid rgba(160,107,255,0.3)",
  marginBottom: 16,
};
const chip = (on: boolean): React.CSSProperties => ({
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid var(--accent)",
  background: on ? "var(--accent)" : "transparent",
  color: on ? "#fff" : "var(--fg)",
  cursor: "pointer",
});
const logBox: React.CSSProperties = {
  marginTop: 20,
  padding: 12,
  fontSize: 12,
  background: "rgba(0,0,0,0.3)",
  borderRadius: 8,
  whiteSpace: "pre-wrap",
};
