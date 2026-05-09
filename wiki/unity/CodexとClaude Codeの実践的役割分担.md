---
type: concept
title: "CodexとClaude Codeの実践的役割分担"
updated: 2026-05-10
tags:
  - codex
  - claude-code
  - multi-agent
  - workflow
  - unity
  - division-of-labor
status: developing
related:
  - "[[Codex Plugin for Claude Code]]"
  - "[[AGENTS.mdとCodex Skills設計]]"
  - "[[Claude Code Game Studios設計]]"
  - "[[Claude Codeマルチエージェント並列Unity開発]]"
---

# CodexとClaude Codeの実践的役割分担

CodexとClaude Codeはサブエージェント設計の思想が異なる。Unityゲーム開発でどう使い分けるかを整理する。

---

## 設計思想の違い (2026-05-08 分析)

(high: knightli.com/en/2026/05/08/codex-vs-claude-code-subagent-design/)

| 観点 | Codex | Claude Code |
|------|-------|-------------|
| 委譲方式 | 明示的委譲 (主セッションが割り当て) | エージェント・ワークステーション (自律的) |
| メモリ | AGENTS.md (セッション単位) | CLAUDE.md + 永続メモリ |
| バックグラウンド実行 | 限定的 | 対応 |
| プラグインエコシステム | Codex Skills | Claude Code Skills/Plugins |
| Unity連携 | mcp-unity AGENTS.md設定 | mcp-unity + CLAUDE.md |

---

## Unity開発での実践的役割分担

### パターン1: Claude Code (設計監督) + Codex (実装)

日本人開発者の商用ゲーム開発事例から抽出 (qiita.com/archeleeds):

```
Claude Code の役割:
- ゲームアーキテクチャの設計・レビュー
- CLAUDE.md の維持・更新
- コンテキスト全体の把握・整合性確認
- /codex:rescue でCodexがスタックした時の救済

Codex の役割:
- 個別機能の実装 (スコープが明確なタスク)
- コードレビュー (/codex:review)
- リファクタリング
- ユニットテスト生成
```

### パターン2: Claude Code (主) + Codex (検証)

```
ワークフロー:
1. Claude Codeが実装
2. /codex:adversarial-review でCodexが逆張りレビュー
3. 問題点をCodexが特定
4. Claude Codeが修正
5. 繰り返し
```

### パターン3: 並列開発 (git worktree分離)

```
Claude Codeセッション A: ゲームロジック (CLAUDE.md-logic)
Codex セッション B: テスト生成 (AGENTS.md-test)
Claude Codeセッション C: UI実装 (CLAUDE.md-ui)

→ 各セッションがworktreeで分離、ファイル競合なし
```

---

## Codex vs Claude Codeの得意・不得意

### Codexが得意

- 明確にスコープが決まった実装タスク
- コードレビュー (adversarial viewpoint)
- テストコード生成
- リファクタリング (既存コードの改善)

### Claude Codeが得意

- アーキテクチャ全体の設計
- CLAUDE.md の文脈でのコード生成
- 複数ファイルにまたがる変更
- セッション間の文脈継続 (hot.md, 永続メモリ)
- Unity MCP経由の Editor操作

---

## 商用ゲーム「DungeonInn」の役割分担事例

Qiita (qiita.com/archeleeds) のシミュレーションゲーム開発事例:

```
企画・設計フェーズ:
  Claude Code → ゲームデザインドキュメント生成

実装フェーズ:
  Claude Code → MonoBehaviourベースのゲームロジック
  Codex → コードレビュー、バグ修正提案

テストフェーズ:
  Claude Code → テスト仕様書
  Codex → ユニットテストコード生成

検証フェーズ:
  Claude Code → 統合テスト
  Codex → adversarialレビュー
```

**結果**: 商用レベルのコード品質を小規模チームで達成

---

## CLAUDE.md と AGENTS.md の共存

同一プロジェクトでClaude CodeとCodexを使う場合。

```
プロジェクトルート/
├── CLAUDE.md          ← Claude Code用 (全体アーキテクチャ・規約)
├── AGENTS.md          ← Codex用 (同一内容 + Codex固有の設定)
├── Scripts/
│   ├── CLAUDE.md      ← Scripts専用の追加コンテキスト
│   └── AGENTS.md      ← Scripts専用のCodex設定
```

**AGENTS.mdはCLAUDE.mdのサブセット**: 共通部分は同じ内容を記載。Codex固有の部分 (Skill呼び出し等) を追加。

---

## Codex Plugin インストール

```bash
# Claude Code内からCodexプラグインをインストール
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex

# 使用可能なコマンド
/codex:review         # コードレビュー
/codex:rescue         # スタックした時の別アプローチ提案
/codex:adversarial-review  # 逆張りレビュー
/codex:status         # バックグラウンドタスクの状態確認
```

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | 参考 | ハッカソンではClaude Code単体に集中する方が速い。役割分担は中盤以降 |
| **MVP必須度** | 低 | Claude Code一本でMVP実装。Codexはコードレビュー用途に限定 |
| **AI実装適性** | 中 | CLAUDE.md + AGENTS.md の両方管理は工数。ハッカソン期間中は費用対効果が低い |
| **人間が実装すべき箇所** | 役割分担設計そのもの。どのタスクをどのAIに割り当てるかは人間が判断 |

**AI Grimoire 推奨**:
- フェーズ1-3: Claude Code単独で実装 (CLAUDE.mdだけ管理)
- フェーズ4以降: `/codex:review` で実装レビューのみ活用
- 複数AIの並列管理よりも、CLAUDE.mdの精度を上げる方が効果的

---

## 出典

- (Source: knightli.com/en/2026/05/08/codex-vs-claude-code-subagent-design/)
- (Source: qiita.com/archeleeds/items/6fbf02174f308e31f284)
- (Source: claudelab.net/en/articles/claude-code/claude-code-unity-game-development-guide)
- (Source: eesel.ai/blog/openai-codex-integrations-with-unity)
