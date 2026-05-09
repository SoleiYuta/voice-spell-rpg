---
type: meta
title: "PROJECT README"
updated: 2026-05-10
tags: [meta, onboarding, project]
---

# Project AI Grimoire (codename)

音声で呪文を唱えて戦う2Dダンジョン探索ゲーム。
AIゲームマスターがプレイヤーの声を評価し、戦闘・ストーリーをリアルタイムで変化させる。

> **"AI Grimoire" は内部コードネームです。正式タイトルは MVP 完成後に決定します。**

---

## このリポジトリの構成

```
project-root/
├── README.md              claude-obsidianプラグイン説明 (変更しない)
├── AGENTS.md              AI (Claude Code / Codex) 向けプロジェクト指示
├── wiki/                  Obsidian Wiki (設計・仕様・調査ドキュメント)
│   ├── TEAM_START_HERE.md ← チームメンバーはここから
│   ├── hot.md             現在フェーズ・今日やること
│   ├── index.md           全ノート一覧
│   └── AI-Grimoire/       プロジェクト設計ノート
├── unity/                 Unity プロジェクト (未作成・MVP後に追加)
├── backend/               FastAPI バックエンド (未作成・フェーズ2以降)
└── .gitignore
```

---

## 最初に読む順番

```
1. wiki/TEAM_START_HERE.md  全体概要・環境構築
2. wiki/hot.md              今日やること・現在フェーズ
3. wiki/AI-Grimoire/縦切り実装ロードマップ   全体工程
4. wiki/AI-Grimoire/Unity責務分割           担当スクリプト
5. wiki/AI-Grimoire/SpellResultデータ構造   フィールド仕様
6. wiki/AI-Grimoire/MockApiClient運用       開発環境立ち上げ
```

---

## Obsidian での開き方

```bash
git clone <repo-url>
# Obsidian → "Open folder as vault" → clone先フォルダを選択
```

推奨プラグイン: Dataview / Templater / Git

---

## MVP 目標

```
音声録音 → WAV送信 → Speech-to-Text → Gemini評価 → Unity UI表示
```

現在フェーズ: **フェーズ0 (Mock完結)** 実装中

| フェーズ | 内容 | 状態 |
|---|---|---|
| 0 | Mock完結 (録音なし・固定レスポンス) | 着手中 |
| 1 | 録音 → WAV変換 | 未着手 |
| 2 | WAV → FastAPI ローカル | 未着手 |
| 3 | Speech-to-Text 接続 | 未着手 |
| 4 | librosa 音響評価 | 未着手 |
| 5 | Gemini gm_comment | 未着手 |
| 6 | Cloud Run デプロイ | 未着手 |

---

## 技術スタック (確定)

| レイヤー | 技術 |
|---|---|
| クライアント | Unity + C# |
| バックエンド | FastAPI + Python (Cloud Run) |
| AI モデル | Gemini 2.5 Flash |
| 音声認識 | Speech-to-Text v2 (ja-JP) |
| DB | Firestore |
| CI/CD | GitHub Actions |

詳細: `wiki/AI-Grimoire/tech/採用技術まとめ`

---

## Git 運用

| 対象 | 扱い |
|---|---|
| `wiki/` | push 推奨 |
| `AGENTS.md` | push 推奨 |
| `.gitignore` | push 推奨 |
| `unity/Packages/` `unity/ProjectSettings/` | push 推奨 |
| `unity/Library/` `unity/Temp/` `unity/Logs/` | push 非推奨 (.gitignore済み) |
| `.obsidian/workspace.json` `.obsidian/graph.json` | push 非推奨 (個人設定) |
| `wiki/100_AI_WORKSPACE/tmp/` `scratch/` | push 非推奨 (AI一時ファイル) |

---

## AI 一時情報について

`wiki/100_AI_WORKSPACE/` はAIの一時作業領域。
- `tmp/` `scratch/` は Git から除外
- `summaries/` `investigations/` は正式ノートへの昇格候補
- 正式ノートは `wiki/AI-Grimoire/` に昇格してから Git push

詳細: `wiki/100_AI_WORKSPACE/運用ルール.md`

---

## 現在フェーズについて

現在は **「土台・設計・MVP導線」フェーズ** です。
大規模実装前であり、Unity コードも FastAPI コードも未着手です。
wikiの設計ドキュメントが完成した状態で実装を開始します。

---

## Claude Code 利用ルール

- 実装前に `wiki/AI-Grimoire/Unity責務分割` と `SpellResultデータ構造` を渡す
- DOTS/ECS は提案されても断る
- Docker を Unity Editor に使わない
- `useMock = true` のままコミットする (フェーズ0)

---

*codename: AI Grimoire (仮) | 正式タイトル未定*
