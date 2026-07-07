// 効果音（Web Audio API で簡易合成）。#56 / 担当: kazuma660
// 音源ファイル不要＝ライセンス事故なし。sfx.playCast() 等を呼ぶだけ。
// - 初回のユーザー操作(タップ/クリック/キー)で AudioContext を resume（スマホ対応）
// - ミュートは localStorage に永続。sfx.toggleMute() / sfx.isMuted()
// - 高頻度SE（命中/撃破）は throttle 済みなので何度呼んでも鳴りすぎない

const MUTE_KEY = "aigrimoire_sfx_muted";
const MASTER_GAIN = 0.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let gestureBound = false;
const lastAt: Record<string, number> = {};

// 初期ミュート状態を復元（SSR安全）
if (typeof window !== "undefined") {
  muted = window.localStorage?.getItem(MUTE_KEY) === "1";
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

// 初回のユーザー操作で AudioContext を起こす（モバイルの自動再生制限対策）
function bindGesture() {
  if (gestureBound || typeof window === "undefined") return;
  gestureBound = true;
  const evs = ["pointerdown", "touchstart", "keydown"] as const;
  const handler = () => {
    ensureCtx();
    evs.forEach((e) => window.removeEventListener(e, handler, true));
  };
  evs.forEach((e) => window.addEventListener(e, handler, true));
}
if (typeof window !== "undefined") bindGesture();

// 呼びすぎ防止（命中/撃破など）
function throttled(key: string, ms: number): boolean {
  const t = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (lastAt[key] && t - lastAt[key] < ms) return false;
  lastAt[key] = t;
  return true;
}

interface Tone {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  freqTo?: number; // 指定するとその周波数へスイープ
  delay?: number;
  attack?: number; // 立ち上がり秒（大きいほど「ふわっ」と膨らむ）
}

function tone(o: Tone) {
  const c = ensureCtx();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "square";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo), t0 + o.dur);
  const peak = o.gain ?? 0.4;
  const atk = Math.min(o.attack ?? 0.008, o.dur * 0.9);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.03);
}

function noise(dur: number, gain = 0.3, highpass = 700) {
  const c = ensureCtx();
  if (!c || !master || muted) return;
  const t0 = c.currentTime;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  const filt = c.createBiquadFilter();
  filt.type = "highpass";
  filt.frequency.value = highpass;
  src.connect(filt);
  filt.connect(g);
  g.connect(master);
  src.start(t0);
}

export const sfx = {
  // 詠唱：録音開始（溜め音・上昇ハム）
  playChantStart() {
    tone({ freq: 180, freqTo: 360, dur: 0.22, type: "sine", gain: 0.22 });
  },
  // 詠唱：送信（呪文発射）。「ファぁーん」＝ふわっと膨らむ魔法の解放感。
  // メジャーコードを緩やかに膨らませて伸ばし（微デチューンでシマー）＋上昇＋後半にきらめき。
  playCast() {
    // ベース：C5-E5-G5 を slow attack で膨らませて伸ばす。1.006倍を重ねてシマー（きらめく揺らぎ）
    const chord = [523, 659, 784];
    chord.forEach((f) => {
      tone({ freq: f, dur: 0.6, type: "triangle", gain: 0.15, attack: 0.13 });
      tone({ freq: f * 1.006, dur: 0.6, type: "triangle", gain: 0.09, attack: 0.13 });
    });
    // ファ→ァと開く上昇の一筆
    tone({ freq: 660, freqTo: 1320, dur: 0.42, type: "sine", gain: 0.16, attack: 0.05 });
    // 後半にきらめき（高音の粒）
    [1568, 2093].forEach((f, i) => tone({ freq: f, dur: 0.16, type: "sine", gain: 0.13, delay: 0.24 + i * 0.1 }));
  },
  // 命中（軽い高音チック・throttleで鳴りすぎ防止）
  playHit() {
    if (!throttled("hit", 55)) return;
    tone({ freq: 880, freqTo: 620, dur: 0.05, type: "square", gain: 0.12 });
  },
  // 撃破（弾ける低音ポップ＋ノイズ）
  playKill() {
    if (!throttled("kill", 55)) return;
    tone({ freq: 300, freqTo: 90, dur: 0.12, type: "square", gain: 0.3 });
    noise(0.08, 0.14, 500);
  },
  // レベルUP（上昇アルペジオ）
  playLevelUp() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone({ freq: f, dur: 0.16, type: "triangle", gain: 0.3, delay: i * 0.08 }));
  },
  // 勝利（ファンファーレ：タタタ・ター＋最後に高音メジャーコードを伸ばす）
  // レベルUP（単純な上昇アルペジオ）とは音色・リズム・和音で明確に差別化。
  playWin() {
    // ブラス風の連打→伸ばし（square）
    const fan: [number, number, number][] = [
      [784, 0, 0.11], [784, 0.13, 0.11], [784, 0.26, 0.11], [1047, 0.4, 0.55],
    ];
    fan.forEach(([f, d, dur]) => tone({ freq: f, dur, type: "square", gain: 0.32, delay: d }));
    // 最後に高音メジャーコード（C6-E6-G6）を重ねて勝利感を出す
    [1047, 1319, 1568].forEach((f) => tone({ freq: f, dur: 0.6, type: "triangle", gain: 0.18, delay: 0.4 }));
  },
  // 敗北（下降・力尽きる）
  playLose() {
    tone({ freq: 400, freqTo: 110, dur: 0.6, type: "sawtooth", gain: 0.3 });
    tone({ freq: 160, freqTo: 70, dur: 0.7, type: "sine", gain: 0.22, delay: 0.05 });
  },

  // ── ミュート制御 ──
  isMuted(): boolean {
    return muted;
  },
  setMuted(m: boolean) {
    muted = m;
    if (typeof window !== "undefined") window.localStorage?.setItem(MUTE_KEY, m ? "1" : "0");
    if (master) master.gain.value = m ? 0 : MASTER_GAIN;
  },
  toggleMute(): boolean {
    this.setMuted(!muted);
    return muted;
  },
  /** 明示的に AudioContext を起こしたい時（任意）。 */
  resume() {
    ensureCtx();
  },
};
