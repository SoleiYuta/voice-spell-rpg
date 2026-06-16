// バックエンド(FastAPI on Cloud Run)を叩く薄いラッパ。
// ベースURLは env から（URL直書き禁止）。土台担当: mutsukichi(nyanko12)。
import type {
  EvaluationResult,
  FloorLog,
  PlayerProfile,
  ResultData,
  SpellData,
} from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

// AIが次の呪文を自律生成（基準1の核）。実装済み・本番動作確認済み。
export async function generateSpell(args: {
  session_id?: string;
  floor_id?: string;
  player_profile?: PlayerProfile;
}): Promise<SpellData> {
  const res = await fetch(`${BASE}/generate-spell`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`generate-spell failed: ${res.status}`);
  return res.json();
}

// 録音(webm Blob)を送って詠唱を評価。録音は lib/audio.ts（#22）で取得する。
export async function evaluate(args: {
  audio: Blob;
  spell_text: string;
  session_id?: string;
  floor_id?: string;
}): Promise<EvaluationResult> {
  const form = new FormData();
  form.append("audio_file", args.audio, "recording.webm");
  form.append("spell_text", args.spell_text);
  form.append("session_id", args.session_id ?? "");
  form.append("floor_id", args.floor_id ?? "");
  const res = await fetch(`${BASE}/evaluate`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`evaluate failed: ${res.status}`);
  return res.json();
}

// セッション総評（診断）。Firestore不使用のため、フロントが保持する詠唱履歴を渡す。
export async function getResult(args: {
  session_id?: string;
  floors: FloorLog[];
}): Promise<ResultData> {
  const res = await fetch(`${BASE}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`result failed: ${res.status}`);
  return res.json();
}
