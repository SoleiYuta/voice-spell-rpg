// API契約の型。**フィールドは snake_case 厳守**（バックエンドと一致・変換しない）。
// 詳細: wiki/AI-Grimoire/10_Web設計書.md §5 / 11_リザルト診断設計.md
// 土台担当: mutsukichi(nyanko12)。必要に応じて拡張する。

export type Volume = "loud" | "normal" | "quiet";

// POST /evaluate のレスポンス
export interface EvaluationResult {
  transcript: string;
  match_rate: number;
  volume: Volume;
  speed_wpm: number;
  completion_rate: number;
  hesitation_count: number;
  confidence: number;
  gm_comment: string;
  spell_power: number;
  // 言い方（お題）採点（任意）：Gemini音声判定 or ルール保険。#delivery
  delivery_style?: string | null;
  delivery_score?: number | null; // 0..1（お題への近さ）
  delivery_comment?: string | null;
  delivery_source?: string | null; // "ai" | "rule"
}

// POST /generate-spell のレスポンス
export interface SpellData {
  spell_text: string;
  difficulty: number;
  spell_type: string;
  expected_length_sec: number;
}

// generate-spell に渡すプレイヤー傾向
export interface PlayerProfile {
  avg_match_rate?: number;
  avg_volume?: Volume;
  avg_speed?: string;
  weak_pattern?: string;
  strong_pattern?: string;
}

// GET /result/{session_id} のレスポンス（診断・[[11_リザルト診断設計]]）
export interface VtuberPersona {
  character_name: string;
  attribute: string;
  catchphrase: string;
  character_setting: string;
  portrait_prompt: string;
}

export interface ResultData {
  session_id: string;
  type_key: string;
  type_name: string;
  best_floor: { floor_id: string; spell_text: string; spell_power: number };
  ai_verdict: string;
  stats: { avg_volume: Volume; total_hesitation: number; avg_match_rate: number; avg_speed_wpm?: number };
  // #55: VTuber声質タイプ＋キャラ提案（backend /result が返す・任意）
  voice_type_name?: string;
  voice_type_desc?: string;
  vtuber_persona?: VtuberPersona;
  improvement_tip?: string;
}

// /result に渡す1フロア分のログ（useGame の履歴から組み立てる）
export interface FloorLog {
  floor_id?: string;
  spell_text?: string;
  match_rate?: number;
  volume?: Volume;
  speed_wpm?: number;
  completion_rate?: number;
  hesitation_count?: number;
  spell_power?: number;
}
