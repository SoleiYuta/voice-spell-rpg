---
type: concept
title: "uLoopMCPとAI駆動Unityループ"
updated: 2026-05-09
tags:
  - unity
  - mcp
  - uloop
  - claude-code
  - autonomous
  - 2d
status: developing
related:
  - "[[Unity MCP統合]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
  - "[[Unity 2D AIコード生成パターン]]"
---

# uLoopMCPとAI駆動Unityループ

uLoopMCPはClaude CodeがUnity Editorを自律的に操作するためのMCPサーバー。コード生成→コンパイル→シーン構築→スクリーンショット確認のサイクルをAIが無人で回す。

---

## uLoopMCPとは

Claude Code等のAIエージェントがUnity Editorを直接操作するMCPサーバー。UnityPackage Managerで導入し、Unity Editorのパネルからサーバーを起動する。

**自律サイクルの概念:**
```
C#スクリプト生成 → コンパイル → エラー検出 → シーン構築
→ スクリーンショット取得 → ビジュアル確認 → 自己修正 → テスト
```
このシーケンス全体をAIが無人で実行できる。(high: zenn.dev/unsoluble_sugar)

---

## 主要MCPツール

| スキル | 機能 |
|--------|------|
| `/uloop-compile` | コンパイルとエラー検出 |
| `/uloop-control-play-mode` | PlayMode の開始/停止/一時停止 |
| `/uloop-capture-window` | Editorウィンドウのスクリーンショット |
| `/uloop-get-hierarchy` | シーンオブジェクト階層の取得 |
| `/uloop-execute-dynamic-code` | 再コンパイル不要のC#動的実行 |

特に強力なのは `/uloop-get-hierarchy` と `/uloop-capture-window` の組み合わせ。AIが現在のシーン状態を視覚的に確認しながら意思決定できる。(high: zenn.dev/unsoluble_sugar)

---

## セットアップ手順

1. Package Manager で OpenUPM スコープを登録
2. `Microsoft.CodeAnalysis.CSharp` ライブラリをインストール
3. Unity Editorで uLoopMCP パネルを起動
4. AIエージェント (Claude Code) とセキュリティレベルを設定
5. MCPサーバーを起動

---

## 2Dゲーム開発での実績例

**数字ブロック崩しゲーム (2D/3Dの両バージョン):**
- 合計18スクリプト
- 全シーン構築をプロンプトのみで実行
- 自律サイクル: 生成→コンパイル→構築→確認
- Claude CodeのPlanモードで仕様を先に策定してから実装

**ワークフロー詳細:**
1. Plan mode で仕様をアウトライン化
2. 実装コードを生成
3. AIがシーンオブジェクトを自動作成
4. スクリーンショットで自己確認と修正

---

## uLoopMCPと他MCPツールの比較

| 項目 | uLoopMCP | mcp-unity (CoderGamester) | unity-cli-loop |
|------|----------|--------------------------|----------------|
| 主な特徴 | 自律ループ重視 | ツール数30+ | AI駆動設計 |
| スクリーンショット | あり | あり | あり |
| 動的コード実行 | `/uloop-execute-dynamic-code` | なし (要再コンパイル) | `execute-dynamic-code` |
| 日本語ドキュメント | あり | なし | なし |
| PlayMode制御 | あり | なし | あり |

---

## 注意事項

- PlayModeテスト中はDomain Reloadが一時無効になる
- セキュリティ設定はプロジェクトごとに適切に管理が必要
- 大規模・既存プロジェクトへの適用時は段階的な検証が必要

---

## フィードバックと判断を人間に残す設計

uLoopMCPの設計思想: **実装労力はAIへ移行し、フィードバックと判断は人間が担う**。

AIが実際のゲーム状態を把握してから調整するため「的外れな修正が大幅に減少」する。(high: zenn.dev/unsoluble_sugar)

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | 推奨 | `/uloop-compile` + `/uloop-get-logs` だけでも大幅に効率アップ |
| **MVP必須度** | 中 | 必須ではないが、コンパイルエラーサイクルを自動化できれば実装速度が上がる |
| **AI実装適性** | 高 | AI自律サイクルの中核。特に `screenshot → 確認 → 修正` は音声UIのデバッグに有効 |
| **人間が実装すべき箇所** | セキュリティ設定の確認、PlayMode制御判断 (いつ開始・終了するか) |

**AI Grimoire での具体的活用**:
- `/uloop-compile` → SpellCaster.cs 修正後にすぐコンパイル確認
- `/uloop-capture-window` → 音声評価UI表示の自動スクリーンショット確認
- `/uloop-get-logs` → STT/API呼び出し時の Debug.Log を AI が直接読んでデバッグ

---

## 出典

- (Source: zenn.dev/unsoluble_sugar/articles/cd8d59be7b8f85)
