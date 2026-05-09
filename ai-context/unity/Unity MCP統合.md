---
type: concept
title: "Unity MCP統合"
updated: 2026-05-09
tags:
  - unity
  - mcp
  - claude-code
  - codex
  - game-development
status: developing
related:
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
  - "[[Unity AIツール比較]]"
---

# Unity MCP統合

Model Context Protocol (MCP) でAIアシスタントをUnity Editorに直接接続するアーキテクチャ。複数の独立したOSSプロジェクトが存在し、すべてClaude Code・Codex CLIの両方に対応。

---

## MCPとは何か

MCP (Model Context Protocol) はAIアシスタントが外部ツールを操作するための標準プロトコル。Unity MCP実装では、AIがWebSocketブリッジ経由でUnity Editorのアセット管理、シーン編集、スクリプト操作を自然言語で制御できる。

## 主要MCPプロジェクト一覧

### 1. mcp-unity (CoderGamester)

- URL: https://github.com/CoderGamester/mcp-unity
- 特徴: 30+ツールを提供する最も包括的な実装
- 対応AI: Cursor, Windsurf, Claude Code, Codex CLI, GitHub Copilot, Claude Desktop

**主要機能:**
- GameObject作成・変更・削除
- コンポーネント管理・フィールド更新
- シーンのロード/保存/作成
- マテリアル作成・変更
- テスト実行
- アセットデータベースクエリ
- コンソールログ監視
- プレハブ作成・Transform操作
- 2D/3Dの物理設定 (9種類の2Dジョイント対応)

**インストール:**
1. Node.js 18+をインストール
2. Unity Package ManagerでGit URL追加: `https://github.com/CoderGamester/mcp-unity.git`
3. Tools > MCP Unity > Server Windowでサーバー起動
4. AIクライアントにMCPサーバー設定を追加

### 2. Unity-MCP (IvanMurzak)

- URL: https://github.com/IvanMurzak/Unity-MCP
- 特徴: 任意のC#メソッドを1行でツール化できるAPI設計
- 無料で利用可能

### 3. unity-mcp (CoplayDev)

- URL: https://github.com/CoplayDev/unity-mcp
- 特徴: Claude・Cursorに特化したブリッジ。アセット管理・シーン編集・スクリプト・タスク自動化に対応

### 4. unity-cli-loop (hatayama)

- URL: https://github.com/hatayama/unity-cli-loop
- 特徴: AIがUnityプロジェクトを最小人間介入で自律駆動する設計

**16の公開ツール:**
- `compile` / `get-logs` — ビルド・ログループ
- `execute-dynamic-code` — 柔軟なEditorスクリプト実行
- `simulate-mouse-ui` / `simulate-keyboard` — PlayMode操作シミュレーション
- `screenshot` — ビジュアルフィードバック
- `run-tests` — 自動テスト

**AI駆動サイクル (2D開発):**
```
screenshot → UI/ビジュアル分析 → コード変更 → 再コンパイル → 結果確認
```
スプライト配置・衝突テスト・ゲームプレイ検証をこのサイクルで自律的に処理。

### 5. UnityAgentClient (nuskey8)

- URL: https://github.com/nuskey8/UnityAgentClient
- 特徴: Agent Client Protocol (ACP) を使用。Gemini CLI・Claude Code・Codex CLI等と統合

## Claude Code固有のセットアップ

```bash
# Coplay MCPの場合
# 1. Unity Package Managerでインストール
# 2. Claude Code設定にMCPサーバーを追加
# 3. プロジェクトルートにCLAUDE.mdを配置
claude-code init --project-root . --language csharp
```

## `[MenuItem]`属性によるAIテスト制御

```csharp
[MenuItem("AI/Reset Game State")]
public static void ResetGameState()
{
    // AIがPlayMode中にゲーム状態を操作するためのフック
    GameManager.Instance.Reset();
}
```
MCPを通じてAIがメニューアイテムを呼び出し、手動介入なしでゲーム状態をテストできる。(high: claudelab.net)

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | オプション | ハッカソンでは不要でも開発可能。あると便利だが優先度は低い |
| **MVP必須度** | 低 | Unity MCP接続より先に `MockSpellApiClient` での評価フロー完成を優先 |
| **AI実装適性** | 高 | 接続さえできればAIがシーン操作・デバッグを自動化できる |
| **人間が実装すべき箇所** | MCP設定・ポート設定・セキュリティ設定。接続確認は人間が実施 |

**AI Grimoire での推奨**: `unity-cli-loop` の `/uloop-compile` と `/uloop-get-logs` だけでも導入する価値あり。コンパイルエラーの検出サイクルが大幅に速くなる。

## 出典

- (Source: https://github.com/CoderGamester/mcp-unity)
- (Source: https://github.com/hatayama/unity-cli-loop)
- (Source: claudelab.net/en/articles/claude-code/claude-code-unity-mcp-game-dev-workflow)
