// プレイヤーキャラ（魔法使い）の自作ドット絵。文字マップ→SVG矩形(crispEdges)で描画。
// とんがり帽子＋ローブ＋杖。right向き基準（杖が右手＝右側）。担当: harukichi

import styles from "./PixelWizard.module.css";

const PALETTE: Record<string, string> = {
  "1": "#241038", // 輪郭（濃い紫）
  "2": "#6a2fb0", // 帽子・ローブ（紫）
  "3": "#9b5cff", // ローブ明部
  "4": "#f0c89a", // 顔（肌）
  "5": "#3a2416", // 杖（木）
  "6": "#ffd23c", // 帽子の星／杖先の宝珠（金）
  "7": "#7fe0ff", // 宝珠グロー（シアン）
};

// 12×14 の魔法使い（右手＝右側に杖）
const WIZARD = [
  "......6.....",   // 帽子先の星
  ".....121....",
  "....12221...",
  "...1222221..",   // とんがり帽子
  "..122222221.",
  ".1222222221.",
  "...1444421..",   // 顔
  "...1444421..",
  "..12333321.7",   // ローブ肩＋杖先グロー
  ".123333321 6",   // 杖先の宝珠(金)
  ".123333321.5",   // 杖(木)
  ".12333332..5",
  "..1322231..5",   // 裾
  "..1.....1..5",   // 足元＋杖
];

export type WizardFacing = "left" | "right";

export interface PixelWizardProps {
  /** 1ドットあたりのピクセル数 */
  cell?: number;
  /** 向き（right基準を left で反転） */
  facing?: WizardFacing;
  /** 詠唱チャージ演出 */
  charging?: boolean;
}

export default function PixelWizard({ cell = 4, facing = "right", charging = false }: PixelWizardProps) {
  const w = WIZARD[0].length;
  const h = WIZARD.length;
  const rects: React.ReactNode[] = [];
  WIZARD.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const fill = PALETTE[ch];
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
    });
  });

  const cls = [styles.sprite, styles.idle, charging ? styles.charging : "", facing === "left" ? styles.left : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      className={cls}
      viewBox={`0 0 ${w} ${h}`}
      width={w * cell}
      height={h * cell}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="魔法使い"
    >
      {rects}
    </svg>
  );
}
