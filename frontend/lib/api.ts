// バックエンド(FastAPI on Cloud Run)を叩く薄いラッパ。
// ベースURLは env から（URL直書き禁止）。土台担当: mutsukichi(nyanko12)。
import type {
  AgentPlan,
  EvaluationResult,
  FloorLog,
  PlayerProfile,
  ResultData,
  SpellData,
} from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

// ===== モックモード（声/API無しでテスト・審査員がマイク不可のときの保険にも）=====
// URL に ?mock=1、または localStorage vsrpg_mock="1" で有効。
export function isMock(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).has("mock")) return true;
    return window.localStorage.getItem("vsrpg_mock") === "1";
  } catch {
    return false;
  }
}
export function setMock(on: boolean): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem("vsrpg_mock", on ? "1" : "0"); } catch { /* noop */ }
}

// 永続プレイヤーID（セッションを跨いで“魔導書が覚える”ための匿名ID・#83）。
// localStorage に一度だけ生成して保持する。
export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem("vsrpg_pid");
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `p-${Date.now()}`;
      window.localStorage.setItem("vsrpg_pid", id);
    }
    return id;
  } catch {
    return "";
  }
}

const MOCK_ELEMS = ["fire", "ice", "thunder", "dark", "light", "wind"];
const MOCK_SPELL_TEXT: Record<string, string> = {
  fire: "紅蓮の焔よ、我が敵を焼き尽くせ",
  ice: "凍てつく刃よ、静寂を穿て",
  thunder: "雷鳴轟け、天の裁きを下せ",
  dark: "深淵より来たれ、闇の渦",
  light: "聖なる光よ、道を照らせ",
  wind: "疾風よ、渦巻き薙ぎ払え",
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function mockFloorNum(floor_id?: string): number {
  const d = (floor_id ?? "").replace(/\D/g, "");
  return d ? parseInt(d, 10) : 1;
}

// AIが次の呪文を自律生成（基準1の核）。実装済み・本番動作確認済み。
export async function generateSpell(args: {
  session_id?: string;
  floor_id?: string;
  player_profile?: PlayerProfile;
}): Promise<SpellData> {
  if (isMock()) {
    await wait(400);
    const n = mockFloorNum(args.floor_id);
    const el = MOCK_ELEMS[(n - 1) % MOCK_ELEMS.length];
    return { spell_text: MOCK_SPELL_TEXT[el], difficulty: Math.min(5, n), spell_type: el, expected_length_sec: 3 };
  }
  const res = await fetch(`${BASE}/generate-spell`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`generate-spell failed: ${res.status}`);
  return res.json();
}

// 3択用：属性の異なる呪文を3つ生成（#74 アーチャー伝説風）。
export async function generateSpellChoices(args: {
  session_id?: string;
  floor_id?: string;
  player_profile?: PlayerProfile;
}): Promise<{ spells: SpellData[]; agent: AgentPlan | null }> {
  if (isMock()) {
    await wait(500);
    const n = mockFloorNum(args.floor_id);
    const picks = [MOCK_ELEMS[(n - 1) % 6], MOCK_ELEMS[n % 6], MOCK_ELEMS[(n + 1) % 6]];
    const spells = picks.map((el) => ({ spell_text: MOCK_SPELL_TEXT[el], difficulty: Math.min(5, n), spell_type: el, expected_length_sec: 3 }));
    // フロア2以降は「GMエージェントの思考」も返す（本番と同じ形）
    const agent: AgentPlan | null = n >= 2
      ? { difficulty: Math.min(5, n), element_focus: picks[0], delivery_style: "chuuni", reason: `一致率は安定しているが詰まりが課題。得意の${picks[0]}で自信を保ちつつ、難易度${Math.min(5, n)}で挑戦させる。`, coaching: "気迫を込めて、一息で唱えきろう！" }
      : null;
    return { spells, agent };
  }
  const res = await fetch(`${BASE}/generate-spell-choices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...args, player_id: getPlayerId() }),
  });
  if (!res.ok) throw new Error(`generate-spell-choices failed: ${res.status}`);
  const data = await res.json();
  return { spells: ((data && data.spells) || []).slice(0, 3), agent: (data && data.agent) || null };
}

// 録音(webm Blob)を送って詠唱を評価。録音は lib/audio.ts（#22）で取得する。
export async function evaluate(args: {
  audio: Blob;
  spell_text: string;
  session_id?: string;
  floor_id?: string;
  delivery_style?: string; // 言い方のお題（key）。あればサーバが演技マッチを採点。
}): Promise<EvaluationResult> {
  if (isMock()) {
    await wait(450);
    const match = Math.round((0.85 + Math.random() * 0.13) * 100) / 100;
    const power = Math.round((1.7 + Math.random() * 0.9) * 100) / 100; // 1.7〜2.6（強めで遊びやすい）
    const dstyle = args.delivery_style || null;
    return {
      transcript: args.spell_text,
      match_rate: match,
      volume: "loud",
      speed_wpm: 150 + Math.round(Math.random() * 60),
      completion_rate: 1.0,
      hesitation_count: Math.random() < 0.3 ? 1 : 0,
      confidence: 0.95,
      gm_comment: "見事な詠唱だ。その調子で押し切れ！",
      spell_power: power,
      delivery_style: dstyle,
      delivery_score: dstyle ? Math.round((0.6 + Math.random() * 0.35) * 100) / 100 : null,
      delivery_comment: dstyle ? "お題に近いぞ、その調子！" : null,
      delivery_source: dstyle ? "ai" : null,
    };
  }
  const form = new FormData();
  form.append("audio_file", args.audio, "recording.webm");
  form.append("spell_text", args.spell_text);
  form.append("session_id", args.session_id ?? "");
  form.append("floor_id", args.floor_id ?? "");
  form.append("delivery_style", args.delivery_style ?? "");
  const res = await fetch(`${BASE}/evaluate`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`evaluate failed: ${res.status}`);
  return res.json();
}

// セッション総評（診断）。Firestore不使用のため、フロントが保持する詠唱履歴を渡す。
export async function getResult(args: {
  session_id?: string;
  outcome?: string; // "victory" | "defeat"（#84 難易度自己補正シグナル）
  floors: FloorLog[];
}): Promise<ResultData> {
  if (isMock()) {
    await wait(500);
    const best = [...args.floors].sort((a, b) => (b.spell_power ?? 0) - (a.spell_power ?? 0))[0];
    return {
      session_id: args.session_id ?? "mock",
      type_key: "loud_clean",
      type_name: "正統派の大魔導士",
      best_floor: { floor_id: best?.floor_id ?? "", spell_text: best?.spell_text ?? "紅蓮の焔よ", spell_power: best?.spell_power ?? 2.0 },
      ai_verdict: "見事な詠唱の旅だった。よく戦い抜いたな。",
      stats: { avg_volume: "loud", total_hesitation: 0, avg_match_rate: 0.9, avg_speed_wpm: 170 },
      voice_type_name: "響き渡る熱血エール系",
      voice_type_desc: "声量豊かで芯のある、聴く人を惹き込む声。",
      vtuber_persona: {
        character_name: "響木エール",
        attribute: "熱血応援系",
        catchphrase: "声出していこうぜ！限界超えちゃおっ！",
        character_setting: "全力投球でみんなを元気づける、熱血応援系VTuber。",
        portrait_prompt: "anime vtuber character, energetic cheerful girl, bright orange hair, sporty cheer outfit, glowing aura, vibrant colors, dynamic pose",
      },
      improvement_tip: "抑揚をつけると、感情がもっと伝わる。",
    };
  }
  const res = await fetch(`${BASE}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...args, player_id: getPlayerId() }),
  });
  if (!res.ok) throw new Error(`result failed: ${res.status}`);
  return res.json();
}

// VTuber立ち絵の実画像生成（portrait_prompt → data URL）。失敗時 null。
// ※声なし(mock)でも実画像は出したいので mock ゲートはしない。
export async function generateImage(prompt: string): Promise<string | null> {
  if (!prompt) return null;
  try {
    const res = await fetch(`${BASE}/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data && data.image) || null;
  } catch {
    return null;
  }
}
