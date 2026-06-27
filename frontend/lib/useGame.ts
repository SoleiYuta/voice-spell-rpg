"use client";

// ゲーム状態機械（useReducer）。詳細: wiki/AI-Grimoire/10_Web設計書 §4
// 担当: satoryudev（#21）。page.tsx はこの hook をマウントして画面を出し分ける。
// 流れ: title → presenting(呪文生成) → ready → recording → evaluating → result
//        → (敵撃破&次フロア) presenting / (敵撃破&最終) gameResult / (敵残り) ready
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
  | "result"
  | "gameResult";

const MAX_FLOORS = 2; // デモは2フロア（適応を見せるのに十分）
const enemyHpForFloor = (floor: number): number => 1.8 + (floor - 1) * 0.6;

export interface GameState {
  phase: GamePhase;
  session_id: string;
  floor: number;
  spell: SpellData | null;
  last: EvaluationResult | null;
  enemy_hp: number;
  enemy_max_hp: number;
  history: FloorLog[];
  result: ResultData | null;
  error: string | null;
}

type Action =
  | { type: "RESET" }
  | { type: "START"; session_id: string }
  | { type: "SPELL_LOADED"; spell: SpellData; floor: number; enemy_hp: number }
  | { type: "BEGIN_RECORD" }
  | { type: "EVALUATING" }
  | { type: "READY" }
  | { type: "EVAL_DONE"; result: EvaluationResult; floor_log: FloorLog; enemy_hp: number }
  | { type: "GAME_RESULT"; result: ResultData }
  | { type: "ERROR"; message: string };

const initialState: GameState = {
  phase: "title",
  session_id: "",
  floor: 1,
  spell: null,
  last: null,
  enemy_hp: 0,
  enemy_max_hp: 0,
  history: [],
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
      return {
        ...state,
        phase: "ready",
        spell: action.spell,
        floor: action.floor,
        enemy_hp: action.enemy_hp,
        enemy_max_hp: action.enemy_hp,
        last: null,
      };
    case "BEGIN_RECORD":
      return { ...state, phase: "recording", error: null };
    case "EVALUATING":
      return { ...state, phase: "evaluating" };
    case "READY":
      return { ...state, phase: "ready", last: null };
    case "EVAL_DONE":
      return {
        ...state,
        phase: "result",
        last: action.result,
        enemy_hp: action.enemy_hp,
        history: [...state.history, action.floor_log],
      };
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

export function useGame() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // 内部：呪文を生成して ready へ（履歴があれば適応プロファイルを渡す）
  const loadSpell = useCallback(
    async (sessionId: string, floor: number, history: FloorLog[]) => {
      try {
        const spell = await generateSpell({
          session_id: sessionId,
          floor_id: `floor-${floor}`,
          player_profile: buildProfile(history),
        });
        dispatch({ type: "SPELL_LOADED", spell, floor, enemy_hp: enemyHpForFloor(floor) });
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

  // 録音Blobを送って評価 → ダメージ＆履歴記録
  const cast = useCallback(
    async (audio: Blob) => {
      if (!state.spell) return;
      dispatch({ type: "EVALUATING" });
      try {
        const result = await evaluate({
          audio,
          spell_text: state.spell.spell_text,
          session_id: state.session_id,
          floor_id: `floor-${state.floor}`,
        });
        const floor_log: FloorLog = {
          floor_id: `floor-${state.floor}`,
          spell_text: state.spell.spell_text,
          match_rate: result.match_rate,
          volume: result.volume,
          speed_wpm: result.speed_wpm,
          completion_rate: result.completion_rate,
          hesitation_count: result.hesitation_count,
          spell_power: result.spell_power,
        };
        const enemy_hp = Math.max(0, Math.round((state.enemy_hp - result.spell_power) * 100) / 100);
        dispatch({ type: "EVAL_DONE", result, floor_log, enemy_hp });
      } catch (e) {
        dispatch({ type: "ERROR", message: e instanceof Error ? e.message : String(e) });
      }
    },
    [state.spell, state.session_id, state.floor, state.enemy_hp],
  );

  // result 画面から次へ
  const next = useCallback(async () => {
    if (state.enemy_hp > 0) {
      dispatch({ type: "READY" }); // 敵が残っている → 同じ呪文でもう一度
      return;
    }
    if (state.floor >= MAX_FLOORS) {
      try {
        const result = await getResult({ session_id: state.session_id, floors: state.history });
        dispatch({ type: "GAME_RESULT", result });
      } catch (e) {
        dispatch({ type: "ERROR", message: e instanceof Error ? e.message : String(e) });
      }
    } else {
      await loadSpell(state.session_id, state.floor + 1, state.history); // 次フロア＝適応呪文
    }
  }, [state.enemy_hp, state.floor, state.session_id, state.history, loadSpell]);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { state, start, beginRecord, cast, next, reset, MAX_FLOORS };
}
