---
type: concept
title: "Unity AI公式ツール 2026"
updated: 2026-05-09
tags:
  - unity
  - unity-ai
  - official
  - game-development
  - ai-assistant
status: developing
related:
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
  - "[[Unity MCP統合]]"
  - "[[Unity 公式MCP設定ガイド]]"
---

# Unity AI公式ツール 2026

Unity Technologies が提供する公式AIツール群。Unity AI Beta 2026で大幅に機能強化。外部AIツール (Claude Code, Codex) との共存設計。

---

## 公式ツール3本柱

### 1. Unity AI Assistant

Unity Editor内蔵のAIコーディングアシスタント。Unity 6.0以降必須。

**2つの動作モード:**
- **Ask**: 質問・回答・トラブルシューティング用クエリ
- **Agent**: プロンプトを専門エージェントに振り分け、マルチステップタスクを自律実行

**Agent モードの新機能 (Beta 2026):**
- 複雑なタスクを多段階で分解して実行
- ビジョン分析 (スクリーンショット解析)
- Git統合 + ビジュアルコードdiff
- プロジェクトコンテキストの検索可能ナレッジグラフ

### 2. Generators (アセット生成)

テキストプロンプトまたは参照画像からアセットを生成:
- スプライト、テクスチャ、アニメーション、オーディオ、マテリアル
- UI Toolkit レイアウト (UXML/USSをテキストから生成)
- スカイボックスキューブマップ (Skybox Generator)
- 3Dモデルとテクスチャ

### 3. Sentis

学習済み機械学習モデルをUnityプロジェクト内で実行するランタイム統合:
- エンドユーザーデバイスでの推論
- Unity Editorでの直接実行
- 独自学習モデルの統合

---

## Unity AI Beta 2026 アクセス要件

- **必要バージョン**: Unity 6.3以降
- **承認期間**: 申込後3-5営業日
- **必須**: クラウドプロジェクト接続 (ポイントは組織単位で割り当て)
- **ベータ枠**: 限定数
- 旧ベータのポイントは引き継がれない

---

## Unity公式MCP (Unity AI Assistantパッケージ付属)

Unity 6.0以降、`com.unity.ai.assistant` パッケージにMCPリレーが同梱。

**特徴:**
- 外部AIクライアント (Claude Code, Cursor, Windsurf, Claude Desktop) から接続可能
- コミュニティMCPとは独立した公式実装
- 自動インストール: エディタ起動時に `~/.unity/relay/` にリレーバイナリを配置

**公開ツール (確認済み):**
- `Unity_ManageScene` — シーン管理
- `Unity_ManageGameObject` — GameObjectの作成/編集
- `Unity_ReadConsole` — コンソールログ読み取り

**設定パス:**
```
Edit > Project Settings > AI > Unity MCP
```
接続状態が "Running" (緑) であることを確認。

> [!gap] 公式MCPが公開するツールの全リストは未確認。コミュニティMCPの30+ツールより少ない可能性がある。

---

## 公式ツール vs コミュニティMCPの比較

| 項目 | Unity AI公式 | コミュニティMCP |
|------|-------------|---------------|
| ベンダー | Unity Technologies | OSS (CoderGamester等) |
| MCP対応 | Unity 6.0+で同梱 | 別途インストール |
| ツール数 | 少 (確認済み3ツール) | 30+ |
| 対応Unityバージョン | 6.0+ | 2021.3 LTS+ |
| ゲームアセット生成 | 公式Generators | なし |
| 安定性 | Beta (週次-隔週更新) | MIT OSS |
| コスト | ポイント制 | 無料 |

---

## 実用上の推奨

- 外部AI (Claude Code/Codex) でのコード生成: コミュニティMCP (mcp-unity等) が充実
- アセット生成 (スプライト/サウンド等): Unity AI公式Generatorsが唯一の統合経路
- Sentis: 独自MLモデルをゲームに組み込む場合のみ使用
- Unity AI公式MCPは将来的に機能拡充の見込み。現状はコミュニティMCPを主力とする

---

## 出典

- (Source: docs.unity3d.com/6000.4/Documentation/Manual/unity-ai.html)
- (Source: discussions.unity.com/t/unity-ai-beta-2026-is-here/1703625)
- (Source: docs.unity3d.com/Packages/com.unity.ai.assistant@2.0/manual/unity-mcp-get-started.html)
- (Source: unity.com/features/ai)
