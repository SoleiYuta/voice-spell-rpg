// 魔導書の立ち絵（自作ドット絵）。文字マップ→SVG矩形(crispEdges)で描画。
// mood × variant の組み合わせで反応が変わる：
//   idle              … 通常の浮遊・まばたき
//   success / A       … 目をカッと見開く（閉じた本のまま）
//   success / B       … 本を横向きに開いてページパラパラ＋光る言葉
//   normal  / A       … 目を閉じて頷く（閉じた本のまま）
//   normal  / B       … 横向きの本でページパラパラ（光なし）
//   failure / A       … ジト目
//   failure / B       … 呆れて目を瞑る＋ため息エフェクト
// 担当: harukichi (#4)

import styles from "./PixelGrimoire.module.css";

export type GrimoireMood = "idle" | "success" | "normal" | "failure";
export type GrimoireVariant = "A" | "B";

const PALETTE: Record<string, string> = {
  "1": "#241038", // 輪郭・テキスト線（濃い紫）
  "2": "#6a2fb0", // 表紙
  "3": "#9b5cff", // 表紙ハイライト（背）
  "4": "#e9dcb8", // ページ（クリーム）
  "5": "#ffe88a", // 猫目の白目（薄黄）
  "6": "#ffd23c", // 紋章（金）
  "7": "#1a0033", // 縦長スリット瞳孔（暗紫）
};

// 閉じた状態の魔導書（縦置き・12×13）。猫目の縦スリット瞳孔。
// idle / 成功A / 普通A / 失敗A/B で使用。
const CLOSED = [
  "............",
  "..11111111..",   // 角丸トップ
  ".1222222221.",   // 表紙
  ".1266226621.",   // 紋章（金）の装飾
  ".1555225551.",   // 猫目：白目（上）
  ".1575225751.",   // 縦スリット瞳孔 1
  ".1575225751.",   // 縦スリット瞳孔 2
  ".1575225751.",   // 縦スリット瞳孔 3
  ".1555225551.",   // 猫目：白目（下）
  ".1222222221.",   // 表紙
  ".1444444441.",   // ページ端（クリーム）
  "..11111111..",   // 角丸ボトム
];

// 上向きに開いた本（14×11）。ページが V字に上へ広がる。成功B / 普通B で使用。
const OPEN = [
  "..............",
  ".44........44.",
  ".444......444.",
  ".4444....4444.",
  ".44444..44444.",
  ".444444444444.",
  ".411441144114.",
  ".444441144441.",
  ".244441144442.",
  ".222222222222.",
  "..............",
];

// 成功B で立ち上る光る言葉
const WORDS = [
  { c: "✦", left: 12, delay: 0 },
  { c: "✧", left: 36, delay: 0.4 },
  { c: "◇", left: 58, delay: 0.2 },
  { c: "ᚱ", left: 80, delay: 0.7 },
];

// 失敗B のため息（フッ…）
const SIGHS = [
  { left: 58, delay: 0 },
  { left: 70, delay: 0.7 },
  { left: 82, delay: 1.4 },
];

export interface PixelGrimoireProps {
  /** 1ドットあたりのピクセル数（大きさ調整） */
  cell?: number;
  /** 反応（評価結果に応じて） */
  mood?: GrimoireMood;
  /** バリエーション（同じmoodでも見せ方を2つ用意）。"random" で内部ランダム。 */
  variant?: GrimoireVariant | "random";
}

// 一致率(0..1 or 0..100)から反応を決める。
export function moodFromMatchRate(matchRate: number): GrimoireMood {
  const p = matchRate <= 1 ? matchRate : matchRate / 100;
  if (p >= 0.85) return "success";
  if (p >= 0.55) return "normal";
  return "failure";
}

// ランダムにA/Bを選ぶ。production統合で result ごとに1回呼ぶ想定。
export function pickGrimoireVariant(): GrimoireVariant {
  return Math.random() < 0.5 ? "A" : "B";
}

export default function PixelGrimoire({ cell = 4, mood = "idle", variant = "A" }: PixelGrimoireProps) {
  const v: GrimoireVariant = variant === "random" ? pickGrimoireVariant() : variant;

  // 横向きの開いた本になる条件
  const useOpen = (mood === "success" || mood === "normal") && v === "B";
  const showWords = mood === "success" && v === "B";
  const showSigh = mood === "failure" && v === "B";

  const sprite = useOpen ? OPEN : CLOSED;
  const w = sprite[0].length;
  const h = sprite.length;

  // レイヤー分け：本体 / 紋章 / 瞳
  const base: React.ReactNode[] = [];
  const rune: React.ReactNode[] = [];
  const eye: React.ReactNode[] = [];
  sprite.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = PALETTE[ch];
      if (!fill) return;
      const r = <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
      // 眼グループは白目(5)とスリット瞳孔(7)の両方。まばたき等で一緒に動かす。
      if (ch === "7" || ch === "5") eye.push(r);
      else if (ch === "6") rune.push(r);
      else base.push(r);
    });
  });

  const moodCls = styles[mood];
  const variantCls = styles[`${mood}${v}`];

  return (
    <div className={`${styles.wrap} ${moodCls} ${variantCls}`} style={{ width: w * cell, height: h * cell }}>
      {showWords && (
        <div className={styles.fx} aria-hidden>
          {WORDS.map((wd, i) => (
            <span key={i} className={styles.word} style={{ left: `${wd.left}%`, animationDelay: `${wd.delay}s` }}>{wd.c}</span>
          ))}
        </div>
      )}

      {showSigh && (
        <div className={styles.fx} aria-hidden>
          {SIGHS.map((s, i) => (
            <span key={i} className={styles.sigh} style={{ left: `${s.left}%`, animationDelay: `${s.delay}s` }}>～</span>
          ))}
        </div>
      )}

      {/* 浮遊レイヤー（hover）と開閉レイヤー（sprite）を分けて、複合アニメを許す */}
      <div className={styles.hover}>
        <svg
          className={styles.sprite}
          viewBox={`0 0 ${w} ${h}`}
          width={w * cell}
          height={h * cell}
          shapeRendering="crispEdges"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="魔導書"
        >
          <g>{base}</g>

          {/* ページめくり：右ページの端からスパイン側へ走る光のストライプ */}
          {useOpen && (
            <rect className={styles.pageFlip} x={10} y={2} width={1} height={6} fill="#fff6cf" />
          )}

          <g className={styles.rune}>{rune}</g>
          <g className={styles.eye}>{eye}</g>
        </svg>
      </div>
    </div>
  );
}
