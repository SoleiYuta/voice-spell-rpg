"use client";

import { useState } from "react";
import { generateSpell } from "@/lib/api";
import type { SpellData } from "@/lib/types";

// 雛形のスモークテスト用ページ。
// 本番APIから呪文を1つ生成して「フロント→Cloud Run→Gemini」の接続を確認するだけ。
// ここを各コンポーネント（TitleScreen / SpellCard / RecordButton / BattleScene / ...）に
// 差し替えて本物のゲームループを組む。担当は frontend/AGENTS.md と wiki/AI-Grimoire/10_Web設計書 を参照。
export default function Home() {
  const [spell, setSpell] = useState<SpellData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function summon() {
    setLoading(true);
    setError(null);
    try {
      setSpell(await generateSpell({ floor_id: "floor-1" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24, textAlign: "center" }}>
      <h1 style={{ color: "var(--accent)" }}>AI Grimoire</h1>
      <p style={{ opacity: 0.7, fontSize: 14 }}>
        雛形（スモークテスト）。本番APIから呪文を生成して接続確認するだけのページです。
        <br />
        各自このページを担当コンポーネントに差し替えてください（→ frontend/AGENTS.md）。
      </p>

      <button
        onClick={summon}
        disabled={loading}
        style={{
          marginTop: 16,
          padding: "12px 24px",
          fontSize: 16,
          color: "#fff",
          background: "var(--accent)",
          border: "none",
          borderRadius: 8,
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "詠唱を生成中…" : "呪文を授かる（/generate-spell）"}
      </button>

      {error && <p style={{ color: "tomato", marginTop: 16 }}>エラー: {error}</p>}

      {spell && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            border: "1px solid var(--accent)",
            borderRadius: 12,
          }}
        >
          <p style={{ fontSize: 22, margin: "0 0 8px" }}>「{spell.spell_text}」</p>
          <small style={{ opacity: 0.7 }}>
            属性: {spell.spell_type} ／ 難易度: {spell.difficulty} ／ 想定 {spell.expected_length_sec}s
          </small>
        </div>
      )}
    </main>
  );
}
