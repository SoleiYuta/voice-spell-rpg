"use client";

// ゲーム状態機械（二部構成）。詳細: wiki/AI-Grimoire/10_Web設計書
// 担当: satoryudev（#21）。
//
// ■ 第1部 詠唱パート … 声で詠唱 → /evaluate → 魔法の「強さ」を確定（=武器を鍛造）
// ■ 第2部 ヴァンサバモード … 移動＋自動攻撃で SURVIVE_SEC 秒サバイブ。敵撃破でレベルUP
// ■ レベルUPのたびに詠唱パートへ戻り、より難しい新呪文を詠唱 → 新武器として追加 → 戦線復帰
//
// フロー:
//  title → presenting(呪文生成) → ready → recording → evaluating → forged(強さ提示)
//    → (最初/復帰) survival
//  survival → (レベルUP) presenting …（ループ）… / (30秒生存 or HP0) gameResult
import { useCallback, useReducer } from "react";
import { evaluate, generateSpell, getResult } from "@/lib/api";
import type {
  EvaluationResult,
  FloorLog,
  PlayerProfile,
  ResultData,
  SpellData,
  Volume,
} from "@/lib/types";

export type GamePhase =
  | "title"
  | "presenting"
  | "ready"
  | "recording"
  | "evaluating"
  | "forged"
  | "survival"
  | "finishing"
  | "gameResult";

export const SURVIVE_SEC = 30; // 生存目標（秒）

// 詠唱で鍛造した魔法＝ヴァンサバでの自動発射武器
export interface Weapon {
  id: string;
  level: number;
  spell_text: string;
  spell_type: string;
  damage: number; // 1発ダメージ（spell_power 由来）
  color: string;
}

// spell_type → 色
const TYPE_COLOR: Record<string, string> = {
  fire: "#ff5a3c", flame: "#ff5a3c",
  ice: "#4fc3f7", water: "#4fc3f7", frost: "#4fc3f7",
  thunder: "#ffd54f", lightning: "#ffd54f",
  wind: "#7be495",
  earth: "#c8a24a",
  dark: "#b06bff", shadow: "#b06bff", light: "#fff3b0",
};
export function colorForSpell(t: string): string {
  return TYPE_COLOR[(t || "").toLowerCase()] ?? "#b06bff";
}

// spell_power(おおよそ 0.8〜2.5) → ヴァンサバのダメージ（敵HP≒18想定。強い詠唱ほど一撃）
function damageFromPower(power: number): number {
  return Math.max(6, Math.round(power * 12));
}

export interface GameState {
  phase: GamePhase;
  session_id: string;
  level: number; // 現在の詠唱レベル（1始まり。レベルが上がるほど難呪文）
  spell: SpellData | null;
  last: EvaluationResult | null;
  weapons: Weapon[]; // 鍛造済み武器（=詠唱した魔法）
  history: FloorLog[]; // 診断用ログ
  survivalStarted: boolean; // 一度でも戦線に出たか
  outcome: "victory" | "defeat" | null;
  result: ResultData | null;
  error: string | null;
}

type Action =
  | { type: "RESET" }
  | { type: "START"; session_id: string }
  | { type: "SPELL_LOADED"; spell: SpellData; level: number }
  | { type: "BEGIN_RECORD" }
  | { type: "EVALUATING" }
  | { type: "FORGED"; result: EvaluationResult; weapon: Weapon; floor_log: FloorLog }
  | { type: "ENTER_SURVIVAL" }
  | { type: "LEVEL_UP"; level: number }
  | { type: "FINISH"; outcome: "victory" | "defeat" }
  | { type: "GAME_RESULT"; result: ResultData }
  | { type: "ERROR"; message: string };

const initialState: GameState = {
  phase: "title",
  session_id: "",
  level: 1,
  spell: null,
  last: null,
  weapons: [],
  history: [],
  survivalStarted: false,
  outcome: null,
  result: null,
  error: null,
};

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "RESET":
      return initialState;
    case "START":
      return { ...initialState, phase: "presenting", session_id: action.session_id };
    case "SPELL_LOADED":
      return { ...state, phase: "ready", spell: action.spell, level: action.level, last: null };
    case "BEGIN_RECORD":
      return { ...state, phase: "recording", error: null };
    case "EVALUATING":
      return { ...state, phase: "evaluating" };
    case "FORGED":
      return {
        ...state,
        phase: "forged",
        last: action.result,
        weapons: [...state.weapons, action.weapon],
        history: [...state.history, action.floor_log],
      };
    case "ENTER_SURVIVAL":
      return { ...state, phase: "survival", survivalStarted: true };
    case "LEVEL_UP":
      return { ...state, phase: "presenting", level: action.level };
    case "FINISH":
      return { ...state, phase: "finishing", outcome: action.outcome };
    case "GAME_RESULT":
      return { ...state, phase: "gameResult", result: action.result };
    case "ERROR":
      return { ...state, error: action.message };
    default:
      return state;
  }
}

// 履歴から generate-spell 用の簡易プロファイルを作る（＝適応の素）
function buildProfile(history: FloorLog[]): PlayerProfile {
  if (history.length === 0) return {};
  const avgMatch = history.reduce((s, f) => s + (f.match_rate ?? 0), 0) / history.length;
  const counts: Record<string, number> = { loud: 0, normal: 0, quiet: 0 };
  for (const f of history) counts[f.volume ?? "normal"]++;
  const avgVolume = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as Volume;
  const totalHesitation = history.reduce((s, f) => s + (f.hesitation_count ?? 0), 0);
  return {
    avg_match_rate: Math.round(avgMatch * 100) / 100,
    avg_volume: avgVolume,
    strong_pattern:
      avgVolume === "loud" ? "大声" : avgVolume === "quiet" ? "囁き" : "安定した声",
    weak_pattern: totalHesitation > history.length ? "詠唱が詰まりがち" : "",
  };
}

// ── テキスト入力バックアップ（#23）用のローカル評価 ──
// マイクが使えない審査員向けの保険。STTを介さず、入力テキストと呪文の一致度から
// フロントだけで EvaluationResult を組み立てる（バックエンド再デプロイ不要で確実に動く）。
// 気迫（声量・抑揚）は取れないので intensity は中庸固定。gm_comment は定型。
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

// 0..1 の一致率（backend の fuzz.ratio 相当）
function textMatchRate(spell: string, text: string): number {
  const a = spell.trim(), b = text.trim();
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  return Math.max(0, Math.round((1 - dist / Math.max(a.length, b.length)) * 100) / 100);
}

function textGmComment(matchRate: number): string {
  if (matchRate >= 0.95) return "……文字なら完璧か。だが声で示してこそ魔法だぞ。";
  if (matchRate >= 0.7) return "書き取りは及第点。次は声に出して見せろ。";
  if (matchRate >= 0.4) return "綴りすら怪しいな。呪文をよく見ろ。";
  return "これでは呪文とは呼べん。もう一度だ。";
}

function buildTextEvaluation(spellText: string, text: string): EvaluationResult {
  const match_rate = textMatchRate(spellText, text);
  const completion_rate = Math.min(text.trim().length / Math.max(spellText.trim().length, 1), 1);
  const intensity = 0.6; // 声が取れないので中庸固定
  const accuracy = (0.5 + match_rate) * completion_rate;
  const power_mult = 0.7 + 1.1 * intensity;
  const spell_power = Math.round(accuracy * power_mult * 100) / 100;
  return {
    transcript: text.trim(),
    match_rate,
    volume: "normal",
    speed_wpm: 0,
    completion_rate: Math.round(completion_rate * 100) / 100,
    hesitation_count: 0,
    confidence: 1,
    gm_comment: textGmComment(match_rate),
    spell_power,
  };
}

export function useGame() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // 呪文を生成して ready へ（レベルが上がるほど難しく＝floor_id にレベルを渡す）
  const loadSpell = useCallback(
    async (sessionId: string, level: number, history: FloorLog[]) => {
      try {
        const spell = await generateSpell({
          session_id: sessionId,
          floor_id: `floor-${level}`,
          player_profile: buildProfile(history),
        });
        dispatch({ type: "SPELL_LOADED", spell, level });
      } catch (e) {
        dispatch({ type: "ERROR", message: e instanceof Error ? e.message : String(e) });
      }
    },
    [],
  );

  const start = useCallback(async () => {
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}`;
    dispatch({ type: "START", session_id: sessionId });
    await loadSpell(sessionId, 1, []);
  }, [loadSpell]);

  const beginRecord = useCallback(() => dispatch({ type: "BEGIN_RECORD" }), []);

  // 録音Blobを送って評価 → 武器を鍛造（forged へ）
  const cast = useCallback(
    async (audio: Blob) => {
      if (!state.spell) return;
      dispatch({ type: "EVALUATING" });
      try {
        const result = await evaluate({
          audio,
          spell_text: state.spell.spell_text,
          session_id: state.session_id,
          floor_id: `floor-${state.level}`,
        });
        const floor_log: FloorLog = {
          floor_id: `floor-${state.level}`,
          spell_text: state.spell.spell_text,
          match_rate: result.match_rate,
          volume: result.volume,
          speed_wpm: result.speed_wpm,
          completion_rate: result.completion_rate,
          hesitation_count: result.hesitation_count,
          spell_power: result.spell_power,
        };
        const weapon: Weapon = {
          id: `w-${state.level}-${state.weapons.length}`,
          level: state.level,
          spell_text: state.spell.spell_text,
          spell_type: state.spell.spell_type,
          damage: damageFromPower(result.spell_power),
          color: colorForSpell(state.spell.spell_type),
        };
        dispatch({ type: "FORGED", result, weapon, floor_log });
      } catch (e) {
        dispatch({ type: "ERROR", message: e instanceof Error ? e.message : String(e) });
      }
    },
    [state.spell, state.session_id, state.level, state.weapons.length],
  );

  // テキスト入力バックアップ（#23）：声の代わりに入力テキストで詠唱を確定。
  // STT/バックエンドを介さずローカルで評価を組み立て、通常と同じ FORGED に流す。
  const castText = useCallback(
    (text: string) => {
      if (!state.spell || !text.trim()) return;
      dispatch({ type: "EVALUATING" });
      const result = buildTextEvaluation(state.spell.spell_text, text);
      const floor_log: FloorLog = {
        floor_id: `floor-${state.level}`,
        spell_text: state.spell.spell_text,
        match_rate: result.match_rate,
        volume: result.volume,
        speed_wpm: result.speed_wpm,
        completion_rate: result.completion_rate,
        hesitation_count: result.hesitation_count,
        spell_power: result.spell_power,
      };
      const weapon: Weapon = {
        id: `w-${state.level}-${state.weapons.length}`,
        level: state.level,
        spell_text: state.spell.spell_text,
        spell_type: state.spell.spell_type,
        damage: damageFromPower(result.spell_power),
        color: colorForSpell(state.spell.spell_type),
      };
      dispatch({ type: "FORGED", result, weapon, floor_log });
    },
    [state.spell, state.level, state.weapons.length],
  );

  // forged 画面 →（初回 or 復帰）戦線へ
  const enterSurvival = useCallback(() => dispatch({ type: "ENTER_SURVIVAL" }), []);

  // ヴァンサバ側から：レベルUP → 次の（難しい）呪文の詠唱パートへ
  const levelUp = useCallback(
    (nextLevel: number) => {
      dispatch({ type: "LEVEL_UP", level: nextLevel });
      void loadSpell(state.session_id, nextLevel, state.history);
    },
    [loadSpell, state.session_id, state.history],
  );

  // ヴァンサバ側から：30秒生存 or HP0 → 診断へ
  const finish = useCallback(
    async (outcome: "victory" | "defeat") => {
      dispatch({ type: "FINISH", outcome });
      try {
        const result = await getResult({ session_id: state.session_id, floors: state.history });
        dispatch({ type: "GAME_RESULT", result });
      } catch (e) {
        dispatch({ type: "ERROR", message: e instanceof Error ? e.message : String(e) });
      }
    },
    [state.session_id, state.history],
  );

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { state, start, beginRecord, cast, castText, enterSurvival, levelUp, finish, reset, SURVIVE_SEC };
}
