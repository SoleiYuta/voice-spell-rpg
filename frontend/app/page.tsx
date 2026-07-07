"use client";

// ゲーム本体（二部構成の統合UI）。useGame の状態機械を配線する。
// ■ 第1部 詠唱パート: TitleScreen / SpellCard(+TTS) / RecordButton(押して詠唱) / EvaluatingOverlay
//   → forged で威力(=武器)を提示し「戦線へ」。
// ■ 第2部 ヴァンサバモード: SurvivalMode（Canvasアクション）。撃破でレベルUP。
// ■ レベルUP時は SurvivalMode を凍結(paused)したまま、上に詠唱UIを重ねて新呪文を詠唱→復帰。
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useGame, colorForSpell, type Weapon } from "@/lib/useGame";
import EvaluationBars from "@/components/EvaluationBars";
import GMComment from "@/components/GMComment";
import ResultScreen from "@/components/ResultScreen";
import TitleScreen from "@/components/TitleScreen";
import SpellCard from "@/components/SpellCard";
import RecordButton from "@/components/RecordButton";
import LoadingScreen from "@/components/LoadingScreen";
import SurvivalMode from "@/components/SurvivalMode";
import { moodFromMatchRate } from "@/components/PixelGrimoire";
import { sfx } from "@/lib/sfx";

const CHANT_PHASES = new Set(["presenting", "ready", "recording", "evaluating", "forged"]);

// デバッグ用の属性一覧（1つずつ選んで単体でエフェクトを確認できる）
const DEBUG_ELEMS = ["fire", "ice", "thunder", "dark", "light", "wind"] as const;
const ELEM_JA: Record<string, string> = { fire: "炎", ice: "氷", thunder: "雷", dark: "闇", light: "光", wind: "風" };
const DEBUG_CODE = "wwssadadab"; // タイトル画面でこれを打つとデバッグへ

export default function Home() {
  const { state, start, beginRecord, cast, castText, enterSurvival, levelUp, finish, reset, SURVIVE_SEC } =
    useGame();
  const [micError, setMicError] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);
  const [dbgElem, setDbgElem] = useState<string>("fire"); // "all" or 単体属性
  const [muted, setMuted] = useState(false); // SE ミュート（初期値は localStorage から同期）
  const [textMode, setTextMode] = useState(false); // #23 テキスト入力バックアップ
  const [spellInput, setSpellInput] = useState("");

  useEffect(() => {
    setMuted(sfx.isMuted());
  }, []);

  // デバッグ装備：単体属性 or 全部（切替で属性ごとに単独で見られる）
  const debugWeapons = useMemo<Weapon[]>(() => {
    if (dbgElem === "all") {
      return DEBUG_ELEMS.map((t, i) => ({
        id: `dbg-${t}`, level: i + 1, spell_text: ELEM_JA[t], spell_type: t, damage: 25, color: colorForSpell(t),
      }));
    }
    // 単体は id 固定（切替しても発射間隔が乱れず、ラウンドリセットも起きない）
    return [{ id: "dbg-single", level: 1, spell_text: ELEM_JA[dbgElem], spell_type: dbgElem, damage: 25, color: colorForSpell(dbgElem) }];
  }, [dbgElem]);

  // タイトル画面で秘密のコマンドを打つとデバッグモードへ
  useEffect(() => {
    if (state.phase !== "title" || debug) return;
    let buf = "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-DEBUG_CODE.length);
      if (buf === DEBUG_CODE) setDebug(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.phase, debug]);

  // デバッグモード：無敵・エンドレス・全属性でエフェクト確認
  if (debug) {
    return (
      <main style={{ maxWidth: 560, margin: "0 auto", padding: 16, textAlign: "center" }}>
        <h1 style={{ color: "var(--accent)", fontFamily: "var(--pixel-font)", fontSize: 20, margin: "4px 0 6px" }}>
          🔧 DEBUG MODE
        </h1>
        <p style={{ fontSize: 12, opacity: 0.7 }}>無敵・エンドレス。属性を選んで単体でエフェクト確認。</p>

        {/* 属性セレクタ：1つ選ぶとその属性だけ発射＝エフェクトを単独で見られる */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", margin: "10px 0" }}>
          {DEBUG_ELEMS.map((t) => {
            const on = dbgElem === t;
            const c = colorForSpell(t);
            return (
              <button
                key={t}
                onClick={() => setDbgElem(t)}
                style={{
                  fontSize: 13, padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                  border: `2px solid ${c}`, color: on ? "#000" : c,
                  background: on ? c : "transparent", fontFamily: "var(--pixel-font)",
                }}
              >
                {ELEM_JA[t]}
              </button>
            );
          })}
          <button
            onClick={() => setDbgElem("all")}
            style={{
              fontSize: 13, padding: "5px 12px", borderRadius: 6, cursor: "pointer",
              border: "2px solid #fff", color: dbgElem === "all" ? "#000" : "#fff",
              background: dbgElem === "all" ? "#fff" : "transparent", fontFamily: "var(--pixel-font)",
            }}
          >
            全部
          </button>
        </div>

        <SurvivalMode
          weapons={debugWeapons}
          durationSec={99999}
          paused={false}
          onLevelUp={() => {}}
          onFinish={() => {}}
          debug
        />
        <button style={btn} onClick={() => setDebug(false)}>← タイトルへ戻る</button>
      </main>
    );
  }

  const isChant = CHANT_PHASES.has(state.phase);
  const showSurvival =
    state.survivalStarted && state.phase !== "gameResult" && state.phase !== "finishing";

  // 詠唱パートのUI（初回=フルスクリーン / レベルUP時=戦線の上にオーバーレイ、で使い回す）
  const chantUI = (
    <>
      {state.phase === "presenting" && (
        <LoadingScreen message="魔導書が新たな呪文を授けている" />
      )}

      {(state.phase === "ready" || state.phase === "recording") && state.spell && (
        <div style={{ textAlign: "center" }}>
          <p style={{ opacity: 0.8, fontFamily: "var(--pixel-font)", fontSize: 13 }}>
            {state.survivalStarted ? `⬆ レベル${state.level}到達！次の呪文を詠唱` : "最初の呪文を詠唱せよ"}
          </p>
          <SpellCard spell={state.spell} autoSpeak={state.phase === "ready"} />
          <div style={{ marginTop: 8 }}>
            <RecordButton
              recording={state.phase === "recording"}
              onBegin={() => {
                setMicError(null);
                sfx.playChantStart();
                beginRecord();
              }}
              onCast={(blob) => {
                sfx.playCast();
                cast(blob);
              }}
              onError={(m) => {
                setMicError(m);
                setTextMode(true); // マイク不可なら自動でテキスト入力へ誘導
              }}
            />
          </div>

          {/* #23 テキスト入力バックアップ：マイクが使えない審査員向けの保険 */}
          <div style={{ marginTop: 10 }}>
            {!textMode ? (
              <button style={textLink} onClick={() => setTextMode(true)}>
                ⌨️ 声が使えない場合はこちら（テキストで詠唱）
              </button>
            ) : (
              <form
                style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!spellInput.trim()) return;
                  sfx.playCast();
                  castText(spellInput);
                  setSpellInput("");
                }}
              >
                <input
                  style={textInput}
                  value={spellInput}
                  onChange={(e) => setSpellInput(e.target.value)}
                  placeholder="呪文を入力して詠唱"
                  aria-label="呪文をテキストで入力"
                  autoFocus
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" style={btn} disabled={!spellInput.trim()}>
                    ▶ テキストで詠唱
                  </button>
                  <button type="button" style={textLink} onClick={() => setTextMode(false)}>
                    🎤 マイクに戻す
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {state.phase === "evaluating" && <LoadingScreen message="魔導書が声を見極めている" />}

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
      <button
        onClick={() => setMuted(sfx.toggleMute())}
        aria-label={muted ? "効果音をオン" : "効果音をオフ"}
        title={muted ? "効果音: OFF" : "効果音: ON"}
        style={muteBtn}
      >
        {muted ? "🔇" : "🔊"}
      </button>
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
            onLevelUp={(lv) => {
              sfx.playLevelUp();
              levelUp(lv);
            }}
            onFinish={(outcome) => {
              if (outcome === "victory") sfx.playWin();
              else sfx.playLose();
              finish(outcome);
            }}
          />
          {isChant && (
            <div style={overlay}>
              <div style={overlayInner}>{chantUI}</div>
            </div>
          )}
        </div>
      )}

      {/* 勝敗確定 → 結果(診断/VTuberキャラ提案)生成中のロード画面 */}
      {state.phase === "finishing" && (
        <LoadingScreen
          tone={state.outcome === "victory" ? "victory" : "defeat"}
          badge={state.outcome === "victory" ? "🏆" : "💀"}
          message={
            state.outcome === "victory"
              ? "魔導書があなたの声を読み解いている"
              : "魔導書が最期の詠唱を刻んでいる"
          }
        />
      )}

      {state.phase === "gameResult" && state.result && (
        <>
          <p
            style={{
              fontFamily: "var(--pixel-font)",
              color: state.outcome === "victory" ? "#5ce08a" : "tomato",
            }}
          >
            {state.outcome === "victory" ? "🏆 全レベル制覇！" : `💀 レベル${state.level}で力尽きた……`}
          </p>
          <ResultScreen key={state.result.session_id} result={state.result} onRestart={reset} />
        </>
      )}
    </main>
  );
}

const muteBtn: CSSProperties = {
  position: "fixed",
  top: 10,
  right: 10,
  zIndex: 60,
  width: 40,
  height: 40,
  fontSize: 18,
  lineHeight: "40px",
  padding: 0,
  textAlign: "center",
  color: "#e9dcb8",
  background: "rgba(36,16,56,0.85)",
  border: "2px solid var(--accent)",
  borderRadius: 8,
  cursor: "pointer",
};

const textLink: CSSProperties = {
  fontFamily: "var(--pixel-font)",
  fontSize: 12,
  color: "var(--accent)",
  background: "transparent",
  border: "none",
  textDecoration: "underline",
  cursor: "pointer",
  padding: 4,
};

const textInput: CSSProperties = {
  fontFamily: "var(--pixel-font)",
  fontSize: 16,
  padding: "10px 12px",
  width: "min(320px, 80vw)",
  color: "#241038",
  background: "#e9dcb8",
  border: "3px solid #241038",
  borderRadius: 2,
  textAlign: "center",
};

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
