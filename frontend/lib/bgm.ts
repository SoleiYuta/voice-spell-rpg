"use client";

// BGMマネージャ（#BGM）。phaseに応じて5トラックをループ再生し、簡易クロスフェードで切替。
// - タイトル: title / バトル: battle / ボス: boss / クリア: victory / 死亡: defeat
// - 自動再生ポリシー対策：初回ユーザー操作まで鳴らせないので unlockBgm() で追い再生する。
// - ミュートは効果音ボタンと連動（setBgmMuted）。

export type BgmTrack = "title" | "battle" | "boss" | "victory" | "defeat";

const SRC: Record<BgmTrack, string> = {
  title: "/bgm/title.mp3",
  battle: "/bgm/battle.mp3",
  boss: "/bgm/boss.mp3",
  victory: "/bgm/victory.mp3",
  defeat: "/bgm/defeat.mp3",
};

const VOL = 0.4; // BGM音量（SFXより控えめ）

const els: Partial<Record<BgmTrack, HTMLAudioElement>> = {};
let current: BgmTrack | null = null;
let muted = false;
let unlocked = false;
const timers: Partial<Record<BgmTrack, ReturnType<typeof setInterval>>> = {};

function getEl(t: BgmTrack): HTMLAudioElement {
  let a = els[t];
  if (!a) {
    a = new Audio(SRC[t]);
    a.loop = true;
    a.preload = "auto";
    a.volume = 0;
    els[t] = a;
  }
  return a;
}

function fade(t: BgmTrack, to: number, ms = 600) {
  const a = getEl(t);
  if (timers[t]) clearInterval(timers[t]);
  const from = a.volume;
  const steps = 15;
  let i = 0;
  timers[t] = setInterval(() => {
    i++;
    a.volume = Math.max(0, Math.min(1, from + (to - from) * (i / steps)));
    if (i >= steps) {
      clearInterval(timers[t]);
      if (to <= 0) a.pause();
    }
  }, ms / steps);
}

function start(t: BgmTrack) {
  const a = getEl(t);
  a.volume = 0;
  a.play().then(() => fade(t, VOL)).catch(() => { /* autoplayブロック時は unlock 待ち */ });
}

export function playBgm(t: BgmTrack): void {
  if (typeof window === "undefined" || current === t) return;
  const prev = current;
  current = t;
  if (prev) fade(prev, 0);
  if (!muted) start(t);
}

export function stopBgm(): void {
  if (current) fade(current, 0);
  current = null;
}

export function setBgmMuted(m: boolean): void {
  muted = m;
  if (muted) {
    Object.values(els).forEach((a) => a && a.pause());
  } else if (current) {
    start(current);
  }
}

// 初回ユーザー操作で自動再生を解禁し、現在のトラックを鳴らし直す。
export function unlockBgm(): void {
  if (unlocked) return;
  unlocked = true;
  if (current && !muted) start(current);
}
