"use client";

// リザルト画面（gameResult 状態で表示）。
// 既存の GMComment / PixelGrimoire を再利用しつつ、
// 診断タイプ見出し・ベスト詠唱・統計セクション・リスタートを追加。
// 設計: wiki/AI-Grimoire/11_リザルト診断設計。担当: harukichi (#18)

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { generateImage } from "@/lib/api";
import GMComment from "./GMComment";
import { moodFromMatchRate, pickGrimoireVariant, type GrimoireVariant } from "./PixelGrimoire";
import type { ResultData, Volume } from "@/lib/types";
import styles from "./ResultScreen.module.css";

const SEG_COUNT = 10;
const VOLUME_LABEL: Record<Volume, string> = { quiet: "小", normal: "普通", loud: "大" };

// 平均一致率から詠唱ランクを導出（演出用・実データ由来）
function rankOf(matchPct: number): string {
  if (matchPct >= 95) return "S";
  if (matchPct >= 85) return "A";
  if (matchPct >= 70) return "B";
  return "C";
}

// 数値を 0→target までイージングでカウントアップ（reduce時は即表示）
function useCountUp(target: number, run: boolean, ms = 900): number {
  const [v, setV] = useState(run ? 0 : target);
  useEffect(() => {
    if (!run) { setV(target); return; }
    let raf = 0;
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t;
      const k = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setReduce(m.matches);
    const onChange = () => setReduce(m.matches);
    m.addEventListener?.("change", onChange);
    return () => m.removeEventListener?.("change", onChange);
  }, []);
  return reduce;
}

export interface ResultScreenProps {
  result: ResultData;
  /** 「もう一度遊ぶ」押下。省略時はボタン非表示。 */
  onRestart?: () => void;
  /** 魔導書の A/B バリアント。省略時は内部でランダム選択。 */
  variant?: GrimoireVariant | "random";
  /** ベスト詠唱の録音URL（#80）。あれば再生プレイヤーを表示。 */
  bestRecordingUrl?: string;
}

function toPct(v: number): number {
  const p = v <= 1 ? v * 100 : v;
  return Math.max(0, Math.min(100, p));
}

function SegBar({ ratio }: { ratio: number }) {
  const on = Math.round(Math.max(0, Math.min(1, ratio)) * SEG_COUNT);
  return (
    <div className={styles.segTrack}>
      {Array.from({ length: SEG_COUNT }, (_, i) => (
        <span key={i} className={`${styles.seg} ${i < on ? styles.segOn : ""}`} />
      ))}
    </div>
  );
}

export default function ResultScreen({ result, onRestart, variant = "random", bestRecordingUrl }: ResultScreenProps) {
  const matchPct = toPct(result.stats.avg_match_rate);
  const mood = moodFromMatchRate(result.stats.avg_match_rate);
  const persona = result.vtuber_persona;

  // 演出：ランクスタンプ＋数値カウントアップ（reduce尊重）
  const reduce = usePrefersReducedMotion();
  const rank = rankOf(matchPct);
  const powerVal = useCountUp(Math.round(result.best_floor.spell_power), !reduce);
  const matchVal = useCountUp(Math.round(matchPct), !reduce);
  const [copied, setCopied] = useState(false);
  const copyPrompt = () => {
    if (!persona?.portrait_prompt) return;
    navigator.clipboard
      ?.writeText(persona.portrait_prompt)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })
      .catch(() => {});
  };

  // 立ち絵の実画像生成
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const genImage = async () => {
    if (!persona?.portrait_prompt || imgLoading) return;
    setImgLoading(true); setImgErr(false);
    const url = await generateImage(persona.portrait_prompt);
    if (url) setImgUrl(url); else setImgErr(true);
    setImgLoading(false);
  };

  return (
    <div className={styles.screen}>
      {/* 診断タイプ見出し（ランクスタンプが着弾） */}
      <div className={styles.headline}>
        <span className={styles.rankStamp} data-rank={rank} aria-label={`詠唱ランク ${rank}`}>
          <span className={styles.rankLabel}>RANK</span>
          {rank}
        </span>
        <div className={styles.headlineLabel}>― あなたの詠唱型 ―</div>
        <div className={styles.headlineType}>「{result.type_name}」</div>
      </div>

      {/* 魔導書＋Gemini総評（GMComment 流用） */}
      <GMComment comment={result.ai_verdict} pixel mood={mood} variant={variant} speedMs={30} />

      {/* #55: VTuber声質タイプ＋キャラ提案 */}
      {result.voice_type_name && (
        <div style={vt.wrap}>
          <div style={vt.label}>― あなたの声質タイプ ―</div>
          <div style={vt.typeName}>「{result.voice_type_name}」</div>
          {result.voice_type_desc && <p style={vt.desc}>{result.voice_type_desc}</p>}

          {persona && (
            <div style={vt.card}>
              <span className={styles.sweep} aria-hidden />
              <div style={vt.cardTag}>VTuberキャラ提案</div>
              <div style={vt.charName}>{persona.character_name}</div>
              <div style={vt.attr}>{persona.attribute}</div>
              <div style={vt.catch}>&ldquo;{persona.catchphrase}&rdquo;</div>
              <p style={vt.setting}>{persona.character_setting}</p>
              {persona.portrait_prompt && (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
                    <button style={vt.genBtn} onClick={genImage} disabled={imgLoading}>
                      {imgLoading ? "🎨 生成中…(10秒ほど)" : imgUrl ? "🔄 もう一度生成" : "🎨 立ち絵を生成"}
                    </button>
                    <button style={vt.copyBtn} onClick={copyPrompt}>
                      {copied ? "✓ コピー済み" : "📋 プロンプト"}
                    </button>
                  </div>
                  {imgUrl && <img src={imgUrl} alt="VTuber立ち絵" style={vt.img} />}
                  {imgErr && <p style={vt.imgErr}>画像生成に失敗しました。もう一度お試しください。</p>}
                </>
              )}
            </div>
          )}

          {result.improvement_tip && <p style={vt.tip}>💡 {result.improvement_tip}</p>}
        </div>
      )}

      {/* ベスト詠唱 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>― ベスト詠唱 ―</div>
        <div className={styles.bestSpell}>「{result.best_floor.spell_text}」</div>
        <div className={styles.bestPower}>
          <span className={styles.bestPowerLabel}>威力</span>
          <span className={styles.bestPowerValue}>{powerVal}</span>
        </div>
        {bestRecordingUrl && (
          <div style={{ marginTop: 10, textAlign: "center" }}>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, fontFamily: "var(--pixel-font)" }}>🔊 この詠唱を聴く</div>
            <audio src={bestRecordingUrl} controls style={{ width: "100%", maxWidth: 300, height: 34 }} />
          </div>
        )}
      </div>

      {/* 統計 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>― 統計 ―</div>

        <div className={styles.statRow}>
          <div className={styles.statHead}>
            <span>平均一致率</span>
            <span className={styles.statValue}>{matchVal}%</span>
          </div>
          <SegBar ratio={matchPct / 100} />
        </div>

        <div className={styles.statRow}>
          <div className={styles.statHead}>
            <span>平均音量</span>
            <span className={styles.statValue}>{VOLUME_LABEL[result.stats.avg_volume]}</span>
          </div>
        </div>

        <div className={styles.statRow}>
          <div className={styles.statHead}>
            <span>詰まり合計</span>
            <span className={styles.statValue}>{result.stats.total_hesitation} 回</span>
          </div>
        </div>
      </div>

      {onRestart && (
        <button className={styles.restart} onClick={onRestart}>
          もう一度遊ぶ
        </button>
      )}
    </div>
  );
}

// VTuberキャラ提案カードのスタイル（自己完結・inline）
const vt: Record<string, CSSProperties> = {
  wrap: { margin: "14px 0", textAlign: "center" },
  label: { fontSize: 12, opacity: 0.7, fontFamily: "var(--pixel-font)" },
  typeName: { fontSize: 18, color: "var(--accent)", fontFamily: "var(--pixel-font)", margin: "4px 0 6px" },
  desc: { fontSize: 13, opacity: 0.85, margin: "0 auto 10px", maxWidth: 420, lineHeight: 1.5 },
  card: {
    position: "relative",
    margin: "0 auto",
    maxWidth: 420,
    padding: "16px 14px 14px",
    border: "2px solid var(--accent)",
    borderRadius: 10,
    background: "color-mix(in srgb, var(--accent) 10%, rgba(10,6,20,0.6))",
    boxShadow: "0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent)",
  },
  cardTag: {
    position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
    fontSize: 11, padding: "2px 10px", borderRadius: 999,
    background: "var(--accent)", color: "#fff", fontFamily: "var(--pixel-font)", whiteSpace: "nowrap",
  },
  charName: { fontSize: 22, fontWeight: 700, marginTop: 4, fontFamily: "var(--pixel-font)" },
  attr: { display: "inline-block", fontSize: 12, opacity: 0.85, border: "1px solid var(--accent)", borderRadius: 999, padding: "1px 10px", margin: "6px 0" },
  catch: { fontSize: 15, fontStyle: "italic", color: "var(--accent)", margin: "6px 0" },
  setting: { fontSize: 13, opacity: 0.9, lineHeight: 1.6, margin: "6px 0 12px" },
  copyBtn: {
    fontSize: 12, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
    border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)",
    fontFamily: "var(--pixel-font)",
  },
  genBtn: {
    fontSize: 12, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
    border: "none", background: "var(--accent)", color: "#fff",
    fontFamily: "var(--pixel-font)", boxShadow: "2px 2px 0 rgba(0,0,0,0.4)",
  },
  img: {
    display: "block", width: "100%", maxWidth: 300, margin: "12px auto 0",
    borderRadius: 10, border: "2px solid var(--accent)",
    boxShadow: "0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent)",
  },
  imgErr: { fontSize: 12, color: "tomato", marginTop: 10 },
  tip: { fontSize: 13, opacity: 0.85, margin: "12px auto 0", maxWidth: 420, lineHeight: 1.5 },
};

// もう一度リザルトを見るときは呪文＆診断タイプが変わっている可能性があるので、
// 統合側で `<ResultScreen key={result.session_id} ... />` として再マウントすると
// 魔導書リアクションと GMComment のタイプライターがきれいに再生される。
// production統合の参考実装は /dev/result を参照。
export { pickGrimoireVariant };
