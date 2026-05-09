---
type: concept
title: "Claude Code Game Studios設計"
updated: 2026-05-09
tags:
  - claude-code
  - multi-agent
  - game-studio
  - architecture
  - unity
status: developing
related:
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
  - "[[Unity AIツール比較]]"
---

# Claude Code Game Studios設計

Claude Codeを本物のゲーム開発スタジオのように機能させる49エージェント・72スキル構成のOSSテンプレート。

---

## 概要

**リポジトリ**: https://github.com/Donchitos/Claude-Code-Game-Studios  
**構成**: 49エージェント定義、72スラッシュコマンド、12フックスクリプト、11パス別コーディング標準

「ソロでAIゲーム開発すると早期の悪い意思決定を止めるものがいない」問題を解決する。実際のスタジオ運営を模倣した構造。(high: github.com/Donchitos)

---

## スタジオ階層構造

### ディレクター層 (ビジョンを守る)
- **Creative Director** — ゲームデザイン全体の一貫性管理
- **Technical Director** — アーキテクチャ・技術的意思決定
- **Producer** — スケジュール・スコープ管理

### 部門リード層 (各ドメインを所有)
- **Game Design Lead** — メカニクス・バランス設計
- **Engineering Lead** — コードアーキテクチャ標準
- **Art Direction Lead** — ビジュアル一貫性
- **QA Lead** — 品質基準と承認ゲート

### スペシャリスト層 (ハンズオン作業)
エンジン別専門エージェント:

| エンジン | スペシャリスト |
|---------|--------------|
| Unity | DOTS/ECS、シェーダー/VFX、Addressables、UI Toolkit |
| Godot | GDScript、シーンツリー、GDNative |
| Unreal | Blueprint、C++、Nanite、Lumen |

---

## /start コマンドから始まるワークフロー

```bash
/start
```
このコマンドでスタジオ全体が起動。Creative Director が最初に登場し、プロジェクトのビジョンをヒアリングする。その後、適切なエージェントが自動的に割り当てられる。

---

## 承認ゲートプロトコル

各フェーズで人間の承認が必要な設計:
1. コンセプト確認 (Creative Director)
2. 技術アーキテクチャレビュー (Technical Director)
3. 実装フェーズ移行 (Producer)
4. QA承認 (QA Lead)

「AIが自走し過ぎないように人間を意思決定ループに残す」設計思想。(medium: explainx.ai)

---

## Unity 2D開発での使い方

```bash
/start
# → Creative Directorがプロジェクトタイプを聞く

「Unity 2Dプラットフォーマーを作りたい。主人公は横スクロールで敵を倒す」

# → Technical DirectorがUnityアーキテクチャを提案
# → Engineering Leadがフォルダ構成とCLAUDE.mdを生成
# → Unity Specialistがコンポーネント設計を担当
```

---

## コンテキスト管理

49エージェントが同時に動くとコンテキスト消費が激しいため、専用のコンテキスト管理戦略を持つ:
- 各エージェントは自分のドメインのみのコンテキストをロード
- エージェント間の引き継ぎはMarkdownファイル経由
- `.claude/docs/context-management.md` に戦略を文書化

---

## ソロ開発者が陥る問題をどう解決するか

| 問題 | Claude Code Game Studiosの解決策 |
|------|----------------------------------|
| 序盤の設計ミス | Creative Director + Technical Directorが事前レビュー |
| マジックナンバーのハードコード | コーディング標準エージェントが検出 |
| 設計ドキュメントのスキップ | Producer がドキュメント作成をゲート |
| スパゲッティコード | Engineering Lead がアーキテクチャ標準を強制 |

---

## X/SNSでの反響

- 「48 AIエージェントが協調して動く。Creative Director、Technical Director、Producer、部門リード、40以上のスペシャリスト」(x.com/nrqa__)
- 「実際のスタジオ運営を模倣した構造 — ビジョンを守るディレクター、ドメインを所有するリード、ハンズオン作業をするスペシャリスト」(threads.com/@alphasignal.ai)

---

## 出典

- (Source: github.com/Donchitos/Claude-Code-Game-Studios)
- (Source: mdskills.ai/skills/claude-code-game-studios)
- (Source: pyshine.com/Claude-Code-Game-Studios-AI-Game-Development)
- (Source: x.com/om_patel5, x.com/nrqa__, x.com/sukh_saroy)
