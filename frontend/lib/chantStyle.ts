// 詠唱スタイル判定（#追加・satoryudev）。
// 既存の音声解析値（声量・一致率・速度・詰まり）だけからルールで「詠唱スタイル」を導出する。
// 追加APIもGemini呼び出しも無し＝遅延ゼロ・落ちない。
// 目的: 「AIが裏で声を分析している」体験を、詠唱ごとに一言で可視化する。
import type { EvaluationResult } from "@/lib/types";

export interface ChantStyle {
  key: string;
  emoji: string;
  name: string; // 「〇〇の詠唱」
  note: string; // AIが読み取った一言（判定の根拠を物語調で）
}

// 判定は「珍しい／際立つ」ものから先に評価する（volume は loud/normal/quiet）。
export function chantStyle(r: EvaluationResult): ChantStyle {
  const { volume, speed_wpm, hesitation_count } = r;
  const match = r.match_rate <= 1 ? r.match_rate : r.match_rate / 100;

  if (hesitation_count >= 2)
    return { key: "cautious", emoji: "🪨", name: "慎重派の詠唱", note: "息を継ぎながら、確かめるように紡いだ声" };
  if (speed_wpm >= 195)
    return { key: "swift", emoji: "⚡", name: "疾風の早口詠唱", note: "一気に駆け抜ける、澱みなき速さ" };
  if (volume === "loud" && match >= 0.9)
    return { key: "royal", emoji: "👑", name: "堂々たる正統派", note: "大音声で一言一句を捉えた、王道の詠唱" };
  if (volume === "loud")
    return { key: "passion", emoji: "🔥", name: "情熱型の詠唱", note: "腹の底から放たれた、熱を帯びた声" };
  if (volume === "quiet")
    return { key: "whisper", emoji: "🌙", name: "静謐の囁き詠唱", note: "囁くほど静かに、しかし芯のある声" };
  if (speed_wpm <= 120)
    return { key: "solemn", emoji: "🕯️", name: "荘厳な詠唱", note: "一語ずつ噛みしめる、重厚な調べ" };
  if (match >= 0.95)
    return { key: "precise", emoji: "🎯", name: "精密詠唱", note: "寸分違わず言葉を射抜く、正確無比" };
  return { key: "balanced", emoji: "✨", name: "均整のとれた詠唱", note: "声量も速さも整った、バランス型" };
}
