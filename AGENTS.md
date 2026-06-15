# voice-spell-rpg: Agent Instructions

codename: AI Grimoire (仮)

声で呪文を詠唱し、**AIゲームマスター（Gemini）がプレイヤーの声を評価して戦闘をリアルタイムに変化させる**音声ゲーム。
**フロントは Unity → Web (Next.js) にピボット済み**。バックエンド（FastAPI on Cloud Run）は流用する。

---

## リポジトリ構成

```
voice-spell-rpg/
├── frontend/   Next.jsフロント（ゲーム本体）← AI実装の主戦場
├── backend/    FastAPI（STT/librosa/Gemini/TTS, Cloud Run）
├── wiki/       設計・仕様ドキュメント
└── unity/      旧クライアント（非推奨・削除予定。参照も実装もしない）
```

各ディレクトリの `AGENTS.md`（`frontend/`, `backend/`）も必ず読むこと。

## 実装前に必ず読む

- `wiki/AI-Grimoire/10_Web設計書` ← **着手の起点**（フォルダ構造・画面遷移・API契約・担当割り当て）
- `wiki/AI-Grimoire/09_役割分担_WBS_ガント` ← 誰が何を担当するか
- `wiki/AI-Grimoire/tech/API設計` ← エンドポイント仕様

## 全体ルール（厳守）

- **APIのフィールドは snake_case 厳守**（TypeScriptの型もPythonも。camelCaseに変換しない）
- **秘密情報（APIキー/URL）をコードに直書きしない**。環境変数 / Secret で管理
- `unity/` は触らない（非推奨・削除予定）。DOTS/ECS等のUnity話も無関係
- 提出物：公開GitHub・**動作するデプロイURL**・Proto Pedia（〆切 **2026-07-10**）

## Git運用

- **デフォルトブランチ = `develop`**。作業は feature branch を切り、PRは `develop` 宛て
- 完成版を `develop` → `main` へPRで反映
- `main` へ直push / force push しない。`hot.md` / `index.md` を壊さない
- AI生成のコミットは内容確認後にコミット

## 技術スタック（確定）

| レイヤー | 技術 |
|---|---|
| フロント | Next.js (App Router) + TypeScript |
| バックエンド | FastAPI + Python (Cloud Run) |
| AI | Gemini 2.5 Flash（**Vertex AI** 経由） |
| 音声認識 | Speech-to-Text (ja-JP) |
| 音声合成 | Text-to-Speech |
| DB | Firestore |
| CI/CD | GitHub Actions |
