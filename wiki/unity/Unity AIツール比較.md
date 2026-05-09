---
type: concept
title: "Unity AIツール比較"
updated: 2026-05-09
tags:
  - unity
  - claude-code
  - codex
  - github-copilot
  - comparison
  - game-development
status: developing
related:
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
  - "[[Unity MCP統合]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
---

# Unity AIツール比較

Claude Code、OpenAI Codex CLI、GitHub CopilotのUnity 2D開発における特徴と使い分け。

---

## ツール別特徴マトリクス

| 特徴 | Claude Code | Codex CLI | GitHub Copilot |
|------|-------------|-----------|----------------|
| 操作方法 | CLIターミナル | CLIターミナル | IDE内補完 |
| コンテキスト長 | 長大 (200K+ tokens) | 中 | 小 (補完単位) |
| プロジェクト記憶 | CLAUDE.mdで永続化 | AGENTS.mdで設定可 | プロジェクト内ファイル参照 |
| MCP連携 | 完全対応 | 完全対応 | 対応 |
| Unity Editor直接操作 | MCP経由で可能 | MCP経由で可能 | Copilot Chat経由 |
| C# 生成品質 | 高 (Unityアーキテクチャ理解) | 高 | 高 (ハルシネーションあり) |
| DOTS/ECS対応 | 弱 | 弱 | 弱 |
| コスト | API従量課金 | API従量課金 | サブスクリプション |

---

## Claude Code の強み

- **長文コンテキスト**: プロジェクト全体の構造を把握した上でコードを生成
- **CLAUDE.mdによる永続記憶**: バージョン、パイプライン、規約を毎回説明不要
- **8フェーズワークフロー**: spec-drivenアプローチでAIのドリフトを防止
- **MCP toolsとの連携**: Unity Editorを直接操作しながら開発ループを回せる
- **ゲームアーキテクチャ理解**: GameObject階層、Componentパターン、Transform数学を理解 (high: claudelab.net)

## Codex CLI の強み

- **ターミナルファースト**: CLIから直接Unity C#を生成するvibe codingスタイル
- **軽量**: インストールと起動が速い
- **MCPフル対応**: mcp-unity等と完全統合
- **Unityスキルフレームワーク**: Unity-SkillsパッケージでCodexに最適化されたスキルを提供 (medium: github.com/Besty0728/Unity-Skills)

## GitHub Copilot の強み・弱み

- **IDE内リアルタイム補完**: コードを書きながら即座に候補が出る
- **弱点**: 存在しない関数を提案するハルシネーションが発生 (high: Unity Discussions)
- **UI Toolkit混同**: USSとCSSを混同した提案をする (high: Unity Discussions)
- **クロスファイル変更は不向き**: 大規模コードベースの変更には不適

---

## コミュニティの評価 (2025年6月時点)

Unity公式Discussionsでの開発者レポート:

- 「AI コーディングアシスタントはWebアプリ開発ほど成熟していない」(high: Unity Discussions)
- Copilotは「オートコンプリートは改善されたが、存在しない関数を提案する」
- ChatGPTは「一般的なコード生成には使えるが、エラーが多い」
- CursorのSonnet-4/GPT-5は「大規模コードベースの変更と分析で最も有望」
- DOTS (ECS) はAI提案がほぼ常に間違い (学習データ不足)

---

## 使い分けの指針

**Claude Code を選ぶべき場面:**
- 新規プロジェクトの立ち上げ (spec-drivenフロー)
- プロジェクト全体のアーキテクチャ設計
- 複数ファイルにまたがるリファクタリング
- CLAUDE.mdで規約を徹底したい場合

**Codex CLI を選ぶべき場面:**
- ターミナル中心のワークフロー
- 短いセッションで単一ファイルを生成
- OpenAIモデルを好む場合
- vibe codingスタイルで高速プロトタイプ

**GitHub Copilot を選ぶべき場面:**
- IDE内でのリアルタイム補完が重要
- 比較的単純な構文補完
- チームがVS Code/JetBrainsを使用

---

## 組み合わせ戦略

最大効果を得るための組み合わせ:

1. **Claude Code** でプロジェクト全体の設計と複雑なシステム実装
2. **GitHub Copilot** でIDE内のリアルタイム補完
3. **MCP Unity** で両ツールからのUnity Editor直接操作

> [!gap] Claude CodeとCopilotの同時使用におけるコンフリクト事例は未検証。実際のワークフローでの経験報告が少ない。

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | 判断済み | AI Grimoire は Claude Code 一本で進める。Codex は補助的に |
| **MVP必須度** | 低 (比較検討は完了) | ツール選定が迷走するとハッカソン時間を消費する。Claude Code に集中 |
| **AI実装適性** | — (判断資料として使用) | |
| **人間が実装すべき箇所** | ツール選択の最終判断。「今このタスクにどのツールが適切か」は常に人間が判断 |

**AI Grimoire 結論**: Claude Code + CLAUDE.md が最優先。GitHub Copilot は VS Code/Rider の補完として併用可。Codex は `/codex:review` のみ活用。

---

## 出典

- (Source: Unity Discussions - unity-ai-coding-tools-current-state-june-2025)
- (Source: claudelab.net/en/articles/claude-code/claude-code-unity-game-development-guide)
- (Source: github.com/CoderGamester/mcp-unity)
- (Source: github.com/Besty0728/Unity-Skills)
