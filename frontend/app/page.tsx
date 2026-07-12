"use client";

// ゲーム本体（二部構成の統合UI）。useGame の状態機械を配線する。
// ■ 第1部 詠唱パート: TitleScreen / SpellCard(+TTS) / RecordButton(押して詠唱) / EvaluatingOverlay
//   → forged で威力(=武器)を提示し「戦線へ」。
// ■ 第2部 ヴァンサバモード: SurvivalMode（Canvasアクション）。撃破でレベルUP。
// ■ レベルUP時は SurvivalMode を凍結(paused)したまま、上に詠唱UIを重ねて新呪文を詠唱→復帰。
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useGame, colorForSpell, MAX_WEAPONS, type Weapon } from "@/lib/useGame";
import EvaluationBars from "@/components/EvaluationBars";
import GMComment from "@/components/GMComment";
import ResultScreen from "@/components/ResultScreen";
import TitleScreen from "@/components/TitleScreen";
import SpellCard from "@/components/SpellCard";
import SpellChoiceCard from "@/components/SpellChoiceCard";
import RecordButton from "@/components/RecordButton";
import LoadingScreen from "@/components/LoadingScreen";
import SurvivalMode from "@/components/SurvivalMode";
import Tutorial from "@/components/Tutorial";
import { moodFromMatchRate } from "@/components/PixelGrimoire";
import { sfx } from "@/lib/sfx";
import { setMock, isMock } from "@/lib/api";
import { playBgm, setBgmMuted, unlockBgm, type BgmTrack } from "@/lib/bgm";
import { chantStyle } from "@/lib/chantStyle";
import { APP_VERSION } from "@/lib/version";

const CHANT_PHASES = new Set(["presenting", "choosing", "ready", "recording", "evaluating", "forged"]);

// デバッグ用の属性一覧（1つずつ選んで単体でエフェクトを確認できる）
const DEBUG_ELEMS = ["fire", "ice", "thunder", "dark", "light", "wind"] as const;
const ELEM_JA: Record<string, string> = { fire: "炎", ice: "氷", thunder: "雷", dark: "闇", light: "光", wind: "風" };
const DEBUG_CODE = "wwssadadab"; // タイトル画面でこれを打つとデバッグへ

export default function Home() {
  const { state, start, chooseSpell, beginRecord, cast, swapWeapon, discardPending, enterSurvival, levelUp, finish, reset, SURVIVE_SEC } =
    useGame();
  const [micError, setMicError] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);
  const [dbgElem, setDbgElem] = useState<string>("fire"); // "all" or 単体属性
  const [muted, setMuted] = useState(false); // SE ミュート（初期値は localStorage から同期）
  const [mockMode, setMockMode] = useState(false); // 声なしテスト用モック
  const [showTutorial, setShowTutorial] = useState(false); // 操作チュートリアル
  const [bossActive, setBossActive] = useState(false); // ボス戦中か（BGM切替用・#BGM）

  useEffect(() => {
    const m = sfx.isMuted();
    setMuted(m);
    setBgmMuted(m);
    setMockMode(isMock());
    // 自動再生ポリシー対策：初回のユーザー操作でBGMを解禁
    const unlock = () => unlockBgm();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // phase/勝敗/ボスに応じてBGMを自動切替（title→battle→boss→victory/defeat）
  useEffect(() => {
    const p = state.phase;
    let track: BgmTrack;
    if (p === "title") track = "title";
    else if (p === "finishing" || p === "gameResult") track = state.outcome === "victory" ? "victory" : "defeat";
    else if (p === "survival") track = bossActive ? "boss" : "battle";
    else track = state.survivalStarted ? "battle" : "title"; // 詠唱パート（初回=タイトル曲/以降=戦闘曲を継続）
    playBgm(track);
  }, [state.phase, state.outcome, state.survivalStarted, bossActive]);

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
          level={Math.max(1, debugWeapons.length)}
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

  // 詠唱ごとの「AI声分析＝〇〇型の詠唱」（既存の解析値からルール判定・遅延なし）
  const forgedStyle = state.last ? chantStyle(state.last) : null;
  // お題（言い方）の演技マッチ度（0..1 → %）。指定なし/未評価は null。
  const deliveryPct =
    state.last?.delivery_score != null ? Math.round(state.last.delivery_score * 100) : null;

  // 詠唱パートのUI（初回=フルスクリーン / レベルUP時=戦線の上にオーバーレイ、で使い回す）
  const chantUI = (
    <>
      {state.phase === "presenting" && (
        <LoadingScreen message="魔導書が新たな呪文を授けている" />
      )}

      {state.phase === "choosing" && state.choices.length > 0 && (
        <div style={{ textAlign: "center" }}>
          <p style={{ opacity: 0.85, fontFamily: "var(--pixel-font)", fontSize: 13 }}>
            {state.survivalStarted ? `⬆ レベル${state.level}・習得する魔法を選べ` : "最初の魔法を選べ"}
          </p>
          {state.agentPlan && (
            <div style={agentThink}>
              <span style={agentThinkLabel}>🔮 魔導書の思考（AIゲームマスター）</span>
              <span style={agentThinkReason}>{state.agentPlan.reason}</span>
              {state.agentPlan.coaching && (
                <span style={agentThinkCoach}>&ldquo;{state.agentPlan.coaching}&rdquo;</span>
              )}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 440, margin: "12px auto 0" }}>
            {state.choices.map((sp, i) => (
              <SpellChoiceCard key={i} spell={sp} onClick={() => chooseSpell(sp)} />
            ))}
          </div>
        </div>
      )}

      {(state.phase === "ready" || state.phase === "recording") && state.spell && (
        <div style={{ textAlign: "center" }}>
          <p style={{ opacity: 0.8, fontFamily: "var(--pixel-font)", fontSize: 13 }}>
            {state.survivalStarted ? `⬆ レベル${state.level}到達！次の呪文を詠唱` : "最初の呪文を詠唱せよ"}
          </p>
          {state.deliveryStyle && (
            <div style={odaiBadge}>
              <span style={odaiBadgeLabel}>🎯 言い方のお題</span>
              <span style={odaiBadgeName}>{state.deliveryStyle.emoji} {state.deliveryStyle.label}</span>
              <span style={odaiBadgeHint}>お題に近い"言い方"ほど威力UP！</span>
            </div>
          )}
          <SpellCard spell={state.spell} autoSpeak={state.phase === "ready"} />
          <div style={{ marginTop: 8 }}>
            {mockMode ? (
              <button style={btn} onClick={() => { sfx.playCast(); cast(new Blob()); }}>
                🔮 タップで詠唱
              </button>
            ) : (
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
                onError={setMicError}
              />
            )}
          </div>
        </div>
      )}

      {state.phase === "evaluating" && <LoadingScreen message="魔導書が声を見極めている" />}

      {state.phase === "forged" && state.last && (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--accent)", fontFamily: "var(--pixel-font)" }}>⚡ 魔法を鍛造した！</p>
          {forgedStyle && (
            <div style={styleBadge}>
              <span style={styleBadgeLabel}>🔍 AIの声分析</span>
              {deliveryPct !== null && state.deliveryStyle ? (
                <>
                  <span style={styleBadgeSub}>お題「{state.deliveryStyle.emoji} {state.deliveryStyle.label}」</span>
                  <span style={styleBadgeName}>演技マッチ {deliveryPct}%</span>
                  {state.last?.delivery_comment && (
                    <span style={styleBadgeNote}>「{state.last.delivery_comment}」</span>
                  )}
                  <span style={styleBadgeSub}>声の傾向：{forgedStyle.emoji} {forgedStyle.name}</span>
                </>
              ) : (
                <>
                  <span style={styleBadgeName}>{forgedStyle.emoji} {forgedStyle.name}</span>
                  <span style={styleBadgeNote}>{forgedStyle.note}</span>
                </>
              )}
            </div>
          )}
          <div style={{ margin: "10px 0", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <EvaluationBars result={state.last} pixel compact />
            <GMComment
              comment={state.last.gm_comment}
              pixel
              mood={moodFromMatchRate(state.last.match_rate)}
            />
          </div>
          {state.pendingWeapon ? (
            <div style={swapWrap}>
              <div style={swapTitle}>⚠️ 装備は最大{MAX_WEAPONS}つ。入れ替える魔法を選べ</div>
              <div style={swapNew}>
                新: <b style={{ color: state.pendingWeapon.color }}>{state.pendingWeapon.spell_type}</b>{" "}
                「{state.pendingWeapon.spell_text}」
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420, margin: "0 auto" }}>
                {state.weapons.map((wp, i) => (
                  <button
                    key={wp.id}
                    style={{ ...swapItem, borderColor: wp.color }}
                    onClick={() => { swapWeapon(i); enterSurvival(); }}
                  >
                    <span style={{ fontSize: 11, opacity: 0.7 }}>これを外す →</span>{" "}
                    <span style={{ color: wp.color }}>Lv{wp.level} {wp.spell_type}</span>{" "}
                    <span style={{ fontSize: 12, opacity: 0.9 }}>「{wp.spell_text}」</span>
                  </button>
                ))}
                <button style={swapDiscard} onClick={() => { discardPending(); enterSurvival(); }}>
                  新しい魔法を捨てる（今の3つを維持）
                </button>
              </div>
            </div>
          ) : (
            <button style={btn} onClick={enterSurvival}>
              {state.survivalStarted ? "▶ 戦線へ戻る" : "▶ 戦線へ"}
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 16, textAlign: "center" }}>
      <button
        onClick={() => { const m = sfx.toggleMute(); setMuted(m); setBgmMuted(m); }}
        aria-label={muted ? "効果音をオン" : "効果音をオフ"}
        title={muted ? "効果音: OFF" : "効果音: ON"}
        style={muteBtn}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      <span style={versionBadge}>v{APP_VERSION}</span>
      <h1 style={{ color: "var(--accent)", fontFamily: "var(--pixel-font)", fontSize: 22, margin: "4px 0 10px" }}>
        AI GRIMOIRE
      </h1>
      {state.error && <p style={{ color: "tomato" }}>エラー: {state.error}</p>}
      {micError && <p style={{ color: "tomato" }}>{micError}</p>}

      {state.phase === "title" && (
        <>
          <TitleScreen onStart={() => { setBossActive(false); setMock(false); setMockMode(false); start(); }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 4 }}>
            <button style={titleSubBtn} onClick={() => setShowTutorial(true)}>
              🎮 遊びかた
            </button>
            <button style={titleSubBtn} onClick={() => { setBossActive(false); setMock(true); setMockMode(true); start(); }}>
              🔇 声なしで遊ぶ
            </button>
          </div>
        </>
      )}

      {/* 初回詠唱（まだ戦線に出ていない）→ フルスクリーン */}
      {!state.survivalStarted && isChant && chantUI}

      {/* ヴァンサバ本体：戦線に出たら常時マウント。詠唱中は paused で凍結し、上に詠唱UIを重ねる */}
      {showSurvival && (
        <div style={{ position: "relative" }}>
          <SurvivalMode
            weapons={state.weapons}
            level={state.level}
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
            onBossStart={() => setBossActive(true)}
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
          <ResultScreen
            key={state.result.session_id}
            result={state.result}
            onRestart={() => { setBossActive(false); reset(); }}
            bestRecordingUrl={state.recordings[state.result.best_floor.floor_id]}
          />
        </>
      )}

      <Tutorial open={showTutorial} onClose={() => setShowTutorial(false)} />
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

// バージョン表記（右下・常時・控えめ）
const versionBadge: CSSProperties = {
  position: "fixed",
  right: 8,
  bottom: 6,
  fontSize: 10,
  opacity: 0.4,
  fontFamily: "var(--pixel-font)",
  pointerEvents: "none",
  zIndex: 5,
};

// AIの声分析バッジ（詠唱ごとの「〇〇型の詠唱」）
const styleBadge: CSSProperties = {
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  margin: "8px auto 0",
  padding: "8px 18px",
  border: "1px solid var(--accent)",
  borderRadius: 10,
  background: "color-mix(in srgb, var(--accent) 12%, rgba(10,6,20,0.6))",
  boxShadow: "0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent)",
  fontFamily: "var(--pixel-font)",
};
const styleBadgeLabel: CSSProperties = { fontSize: 10, letterSpacing: "0.14em", opacity: 0.7 };
const styleBadgeName: CSSProperties = {
  fontSize: 17,
  color: "var(--accent)",
  textShadow: "0 0 10px color-mix(in srgb, var(--accent) 55%, transparent)",
};
const styleBadgeNote: CSSProperties = { fontSize: 11, opacity: 0.8, maxWidth: 300 };
const styleBadgeSub: CSSProperties = { fontSize: 11, opacity: 0.7 };

// 詠唱前の「言い方のお題」バッジ（ready/recording）
const odaiBadge: CSSProperties = {
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  margin: "8px auto 4px",
  padding: "8px 18px",
  border: "2px dashed var(--accent)",
  borderRadius: 10,
  background: "color-mix(in srgb, var(--accent) 10%, rgba(10,6,20,0.55))",
  fontFamily: "var(--pixel-font)",
};
const odaiBadgeLabel: CSSProperties = { fontSize: 10, letterSpacing: "0.14em", opacity: 0.7 };
const odaiBadgeName: CSSProperties = {
  fontSize: 18,
  color: "var(--accent)",
  textShadow: "0 0 10px color-mix(in srgb, var(--accent) 55%, transparent)",
};
const odaiBadgeHint: CSSProperties = { fontSize: 10, opacity: 0.65 };

// GMエージェントの思考ログ（choosing・#82）
const agentThink: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  maxWidth: 440,
  margin: "10px auto 0",
  padding: "10px 14px",
  border: "1px solid var(--accent)",
  borderRadius: 10,
  background: "color-mix(in srgb, var(--accent) 9%, rgba(10,6,20,0.55))",
  boxShadow: "0 0 0 2px color-mix(in srgb, var(--accent) 16%, transparent)",
  textAlign: "left",
};
const agentThinkLabel: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.1em",
  color: "var(--accent)",
  fontFamily: "var(--pixel-font)",
};
const agentThinkReason: CSSProperties = { fontSize: 12.5, lineHeight: 1.6, opacity: 0.92 };
const agentThinkCoach: CSSProperties = { fontSize: 12, fontStyle: "italic", color: "var(--accent)", opacity: 0.95 };

// 装備入れ替え選択（#79・上限3超過時）
const swapWrap: CSSProperties = { marginTop: 12, display: "flex", flexDirection: "column", gap: 8 };
const swapTitle: CSSProperties = { fontFamily: "var(--pixel-font)", fontSize: 13, color: "#ffd23c" };
const swapNew: CSSProperties = { fontSize: 13, fontFamily: "var(--pixel-font)" };
const swapItem: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "2px solid",
  background: "rgba(10,6,20,0.5)",
  color: "#fff",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "var(--pixel-font)",
  boxShadow: "2px 2px 0 rgba(0,0,0,0.35)",
};
const swapDiscard: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px dashed var(--accent)",
  background: "transparent",
  color: "var(--accent)",
  cursor: "pointer",
  fontFamily: "var(--pixel-font)",
  fontSize: 12,
};

// タイトル下のサブボタン（遊びかた / 声なし）
const titleSubBtn: CSSProperties = {
  fontSize: 12,
  padding: "6px 14px",
  borderRadius: 6,
  cursor: "pointer",
  border: "1px dashed var(--accent)",
  background: "transparent",
  color: "var(--accent)",
  fontFamily: "var(--pixel-font)",
  opacity: 0.85,
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
