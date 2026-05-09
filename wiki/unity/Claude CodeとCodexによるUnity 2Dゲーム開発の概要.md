---
type: concept
title: "Claude CodeとCodexによるUnity 2Dゲーム開発の概要"
updated: 2026-05-09
tags:
  - unity
  - game-development
  - claude-code
  - codex
  - ai-assisted
status: developing
related:
  - "[[Unity MCP統合]]"
  - "[[Unity プロジェクトのCLAUDE.md設計]]"
  - "[[Unity 2D AIコード生成パターン]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
  - "[[Unity AIツール比較]]"
---

# Claude CodeとCodexによるUnity 2Dゲーム開発の概要

AI支援によるUnity 2Dゲーム開発は2025年から急速に成熟した分野。Claude Code、OpenAI Codex CLI、GitHub Copilotの三者が主要プレイヤー。MCPによるUnity Editor直接操作が統合の要。

---

## AI支援ゲーム開発の現状 (2025-2026)

- 世界のゲームスタジオの95%がAIをコアワークフローに採用 (high: 2026 Unity Game Development Report)
- 62%のスタジオがClaude等のAIエージェントをバックエンド/コーディングに活用
- Unity開発者の70%が「AIにより高速かつ低コストに開発できる」と回答
- 開発者の79%がゲーム開発でのAI活用に肯定的

## AIが得意な領域

| 領域 | 具体例 |
|------|--------|
| ボイラープレート生成 | MonoBehaviourスクリプト、移動コントローラー |
| デバッグ支援 | エラーの根本原因分析、コードレビュー |
| 単体システム | アルゴリズム、シェーダー、個別メソッド |
| テスト自動化 | Unity Test Frameworkのテストケース生成 |
| エディタツール | カスタムEditorWindow、ScriptableObject管理 |

## AIが苦手な領域

- ゲームバランスの調整 (medium: 主観的判断が必要)
- ビジュアルデザインの仕上げ
- アセットパイプラインの統合
- 大規模プロジェクトのクロスファイル変更
- Unity DOTS/ECS (学習データ不足で提案がほぼ常に誤る)
- UI Toolkitの複雑なレイアウト (CSSとUSSを混同する)

## 3大AIアシスタントの位置付け

**Claude Code**: 長文コンテキスト理解に優れる。CLAUDE.mdでプロジェクト全体を記憶させ、セッションをまたいで一貫した支援が可能。MCPでUnity Editorを直接操作できる。

**OpenAI Codex CLI**: ターミナルベースの軽量コーディングエージェント。vibe-codingスタイルでのC#生成に対応。MCP経由でUnityに接続可能。

**GitHub Copilot**: IDE内補完が主戦場。コード補完精度は高いが、存在しない関数をハルシネーションすることがある。

## 生産性への影響

- 初心者の生産性: 20-30%向上 (high: 複数報告で一致)
- 熟練開発者: 慣れた領域では約19%低下する場合あり (medium: 単一研究)
- 基本的な移動コードは「数プロンプトでほぼ即座に動作」

## 関連ページ

- [[Unity MCP統合]] — MCP経由でのUnity Editor操作
- [[Unity プロジェクトのCLAUDE.md設計]] — コンテキストファイルの書き方
- [[Unity 2D AIコード生成パターン]] — 2D固有システムのコード生成
- [[AI Unityゲーム開発ワークフロー]] — フェーズ別開発プロセス
- [[Unity AIツール比較]] — ツール間の機能比較

### 実プロジェクト適用例

- [[AI-Grimoire/00_概要]] — このナレッジを適用中のハッカソンプロジェクト
- [[AI-Grimoire/tech/採用技術まとめ]] — AI Grimoire の技術スタック選定

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | 基礎知識として必須 | AI得意/不得意の把握がCLAUDE.md設計と役割分担に直結 |
| **MVP必須度** | 中 | 「AIが苦手な領域」リストをCLAUDE.mdの禁止事項として転用する |
| **AI実装適性** | — (このページ自体は設計参照用) |  |
| **人間が実装すべき箇所** | ゲームバランス調整、アセットパイプライン設定、DOTS/ECS判断、UI Toolkitの複雑レイアウト |

**AI Grimoire への適用**:
- 「AI得意」→ SpellCaster/APIクライアント/UIバインディングはAIに任せる
- 「AI苦手」→ 音声録音バイト列操作・ゲームフィール調整・評価パラメータ設定は人間が担当

## 出典

- (Source: Kevuru Games blog, 2025 - Unity AI statistics)
- (Source: claudelab.net/en/articles/claude-code/claude-code-unity-game-development-guide)
- (Source: Unity Discussions - unity-ai-coding-tools-current-state-june-2025)
