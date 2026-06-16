import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Grimoire",
  description: "声で詠唱し、AIゲームマスターが才能を見抜く音声RPG",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
