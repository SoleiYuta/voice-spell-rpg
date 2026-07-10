// 詠唱の「言い方（お題）」。#delivery / 担当: satoryudev
// key は backend の DELIVERY_STYLES と一致させること（採点はサーバ側がkeyで引く）。
// 表示用（emoji/label）だけをここに持ち、詠唱ごとに1つランダムで出題する。

export interface DeliveryStyle {
  key: string;
  emoji: string;
  label: string;
}

export const DELIVERY_STYLES: DeliveryStyle[] = [
  { key: "chuuni", emoji: "🔥", label: "厨二病全開で" },
  { key: "sexy", emoji: "💋", label: "色っぽく囁くように" },
  { key: "angry", emoji: "😤", label: "怒りを込めて" },
  { key: "sigh", emoji: "😮‍💨", label: "ため息まじり気だるげに" },
  { key: "love", emoji: "🥺", label: "愛を告げるように" },
  { key: "bright", emoji: "📢", label: "高らかに元気よく" },
];

export function pickDeliveryStyle(): DeliveryStyle {
  return DELIVERY_STYLES[Math.floor(Math.random() * DELIVERY_STYLES.length)];
}

export function deliveryStyleByKey(key?: string | null): DeliveryStyle | undefined {
  return DELIVERY_STYLES.find((s) => s.key === key);
}
