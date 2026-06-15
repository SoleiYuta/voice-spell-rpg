# frontend/ — Agent Instructions (Next.js)

AI Grimoire のWebクライアント。**声で詠唱 → 評価 → 魔法発動 → AIが次の呪文を適応生成**、を実装する。

**着手前に必読：`../wiki/AI-Grimoire/10_Web設計書.md`**（全体設計・画面遷移・API契約・担当割り当て）

---

## スタック / 規約

- **Next.js (App Router) + TypeScript**
- ゲームは操作中心 → `app/page.tsx` と各コンポーネントは基本 `'use client'`
- 状態管理：`useReducer` ベースの自作 hook `lib/useGame.ts`（外部状態ライブラリは入れない）
- フォントは `next/font`、画像は `next/image`
- バックエンドは **`process.env.NEXT_PUBLIC_API_BASE_URL` 経由**で呼ぶ（URL直書き禁止）
- **API型は snake_case のまま使う**（camelCaseに変換しない）。型は `lib/types.ts` に集約

## フォルダ構造

```
app/        layout.tsx, page.tsx（状態で画面を出し分け）, globals.css
components/ TitleScreen, SpellCard, RecordButton, EvaluatingOverlay,
            BattleScene, EvaluationBars, GMComment, ResultScreen
lib/        types.ts, api.ts, audio.ts, useGame.ts
public/     スプライト・画像（後で追加）
```

## 状態遷移（`useGame`）

```
title → presenting → ready → recording → evaluating → result
result → (敵HP>0) ready / (撃破&次フロア) presenting / (終了) gameResult
```

## API（`lib/api.ts` が提供する3関数）

- `generateSpell(profile)` → `SpellData`
- `evaluate(blob, spell_text, session_id, floor_id)` → `EvaluationResult`（multipart, `audio_file`に録音Blob）
- `getResult(session_id)` → `ResultData`

型は `lib/types.ts`。契約の詳細は 10_Web設計書 §5。

## 録音

`getUserMedia` + `MediaRecorder`。既定の `webm/opus` Blob を**そのまま** `evaluate` に渡す（WAV変換はbackend側でやる）。

## 担当（自分の箇所だけ作ればよい）

| ファイル | 担当 |
|---|---|
| `lib/*`（types/api/audio/useGame） | **mutsukichi**(nyanko12) ※**最優先で `types.ts` を確定**＝全員の前提 |
| `TitleScreen` `SpellCard` `RecordButton` `EvaluatingOverlay` | **蒸し焼き**(kazuma660) |
| `BattleScene` `EvaluationBars` `GMComment` `ResultScreen` | **harukichi**(Haruku-Sato) |
| `app/page.tsx`（統合） | **satoryudev** |

## やらないこと

- 移動・物理・タイルマップ等の本格アクション（**声の詠唱ループに全振り**）
- ゲームエンジン(Phaser/Three)・WebGL直叩き（不要。演出はCSS/Canvasで足りる）
- API型の camelCase 化
