---
type: meta
title: "TEAM_START_HERE"
updated: 2026-05-10
tags: [meta, onboarding, team]
---

# チームWiki 入口

**Project codename: AI Grimoire (仮)**
音声で呪文を唱えて戦う2Dダンジョン探索ゲーム + AIゲームマスターエージェント

---

## このWikiの目的

実装者が迷わないための設計・仕様ドキュメントを一元管理する。
チャットや口頭での仕様共有を排除し、実装前に必ず参照する場所にする。

---

## 最初に読む順番

```
1. このファイル (TEAM_START_HERE.md)
2. wiki/hot.md            → 現在フェーズ・今日やること
3. wiki/AI-Grimoire/縦切り実装ロードマップ    → 全体工程
4. wiki/AI-Grimoire/Unity責務分割            → 担当スクリプト確認
5. wiki/AI-Grimoire/SpellResultデータ構造    → フィールド名厳守
6. wiki/AI-Grimoire/MockApiClient運用        → 開発環境立ち上げ方
```

---

## ObsidianでのVault開き方

```bash
# 1. clone
git clone <repo-url>
cd claude-obsidian

# 2. Obsidianを起動
# → "Open folder as vault" → clone先フォルダを選択

# 3. 推奨プラグイン (Community plugins から検索してインストール)
- Dataview        — wikiのクエリ表示
- Templater       — テンプレート使用
- Git             — vault内からgit操作
```

> Obsidianを使わなくても、Markdownビューアで読めば問題ない。

---

## Git運用ルール

| ルール | 内容 |
|---|---|
| ブランチ | `main` に直接push可 (hackathon速度優先) |
| コミットメッセージ | `docs: ...` / `feat: ...` / `fix: ...` |
| wiki更新 | 仕様変更したら必ずwikiも更新する |
| `useMock = false` | Unityコード側でfalseにしたままコミットしない |
| コンフリクト | `.obsidian/workspace.json` は各自ローカルで管理 |

### Obsidian個人設定ファイル (共有しなくていいもの)

以下を手元の `.git/info/exclude` に追加するとコンフリクトを防げる:
```
.obsidian/workspace.json
.obsidian/graph.json
.obsidian/workspace-mobile.json
```

---

## AGENTS.md の役割

リポジトリルートの `AGENTS.md` は Claude Code / Codex CLI が参照するAI用の指示ファイル。
人間向けではなく、AIへの「このプロジェクトのルール」を書く場所。
Unityスクリプトを書かせる前に必ず更新する (CLAUDE.md相当)。

---

## プロジェクト概要・技術スタック

詳細は [[AI-Grimoire/PROJECT_README]] に記載。

## Wikiの構造

```
project-root/
├── README.md                    claude-obsidianプラグイン説明
├── AGENTS.md                    AI向けプロジェクト指示
├── unity/                       Unityプロジェクト (未作成)
│   └── README.md
├── backend/                     FastAPIバックエンド (未作成)
│   └── README.md
└── wiki/                        Obsidian Wiki (設計・仕様)
    ├── TEAM_START_HERE.md       ← このファイル
    ├── hot.md                   現在フェーズ・今日やること
    ├── index.md                 全ノートの地図
    ├── AI-Grimoire/             プロジェクト設計ノート
    │   ├── PROJECT_README.md    プロジェクト概要・Git運用
    │   ├── tech/                技術調査・確定スタック
    │   └── ...
    ├── concepts/                Unity AI開発ナレッジ
    ├── archive/                 現在不要なノート
    └── 100_AI_WORKSPACE/        AI一時作業領域 (人間は見なくていい)
```

---

## hot.md と index.md の違い

| ファイル | 用途 | 更新頻度 |
|---|---|---|
| `hot.md` | 今日やること / 現在フェーズ / 禁止事項 | 毎セッション |
| `index.md` | 全ノートの一覧と分類 | 構造変更時 |

---

## MVPの現在地

```
[ ] フェーズ0: Mock完結 ← 今ここ
[ ] フェーズ1: 録音 → WAV変換
[ ] フェーズ2: WAV → FastAPIローカル
[ ] フェーズ3: STT接続
[ ] フェーズ4: librosa音響評価
[ ] フェーズ5: Gemini gm_comment
[ ] フェーズ6: Cloud Runデプロイ
```

---

## Claude Code 利用ルール

- `CLAUDE.md` (repo root) または `AGENTS.md` を必ず読ませる
- 実装前に仕様ページ (`Unity責務分割`, `SpellResultデータ構造`) を渡す
- `useMock = true` のまま開発する
- DOTS/ECS は提案されても断る
- Docker を Unity Editor に使わない

---

*更新担当: Vault構造管理 (Claude Code)*
