---
type: concept
title: "AI Unityゲーム開発ワークフロー"
updated: 2026-05-09
tags:
  - unity
  - workflow
  - claude-code
  - codex
  - game-development
  - spec-driven
status: developing
related:
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
  - "[[Unity MCP統合]]"
  - "[[Unity プロジェクトのCLAUDE.md設計]]"
  - "[[Unity 2D AIコード生成パターン]]"
---

# AI Unityゲーム開発ワークフロー

Claude CodeとUnity MCPを組み合わせた8フェーズのspec-driven開発プロセス。コーディング前に仕様を固めることでAIのドリフト（脱線）を防ぐ。

---

## 8フェーズ概要 (claudelab.net推奨)

| フェーズ | 目的 | 主な成果物 |
|----------|------|-----------|
| Phase 0 | MCP接続確認 | 疎通テスト |
| Phase 1 | ゲームデザイン仕様 | GDD (ゲームデザインドキュメント) |
| Phase 2 | 機能リスト | 実装する機能一覧 |
| Phase 3 | 技術アーキテクチャ | クラス設計、依存関係 |
| Phase 4 | テスト計画 | Unity Test Frameworkのテストケース |
| Phase 5 | タスク分解 | 実装順序のチェックリスト |
| Phase 6 | コード実装 | 実際のC#スクリプト群 |
| Phase 7 | テスト実行 | バグ修正サイクル |
| Phase 8 | WebGLデプロイ | ビルド・パブリッシュ |

**核心原則**: Phases 1-5で仕様をロックしてからPhase 6のコーディングを開始する。仕様なしでコーディングするとAIが方向性を見失う。(high: claudelab.net)

## コマンド体系

```bash
/dev-game          # 8フェーズオーケストレーター起動
/unity-check --level 1   # L1: コンパイルエラー検出
/unity-check --level 2   # L2: ランタイムエラー (PlayMode)
/unity-check --level 3   # L3: スクリーンショットでビジュアル検証
```

---

## Claude Codeフック統合

### pre-buildフック
```bash
claude-code /hooks add pre-build
# 実行内容:
# - 命名規約チェック
# - 循環依存検出
# - デバッグ残留コード検出
```

### post-buildフック
```bash
# Unity Test Frameworkのテストを自動実行
# ビルド成功後にリグレッションを即座に検出
```

### pre-releaseフック
```bash
# アセットサイズとコンプレッション設定を監視
# アプリストアの制限超過を防止
```

---

## Vibe Codingアプローチ

Andrej Karpathy (OpenAI共同創業者) が2025年2月に提唱した開発スタイル。「AIに完全に委ね、コードの存在を忘れる」。

**Unity 2D適用時の実態:**
- 基本移動コードは数プロンプトで動作
- 118プロンプトでクロスプラットフォームゲームを完成 (medium: medium.com実例)
- 複雑な衝突検出・パスファインディングはvibe codingで解決不可
- 詰まった時はゲームフローを再設計する方が早い

---

## インクリメンタル開発の推奨順序 (2D)

1. **ユーティリティ関数** (最初はここから。単純で検証しやすい)
2. **入力システム統合** (Input Actionアセットの設定)
3. **プレイヤー移動** (Rigidbody2D, アニメーション状態)
4. **地面検出** (Raycast, ジャンプ制御)
5. **カメラ追従** (Cinemachine設定)
6. **タイルマップ** (Tilemap, TilemapCollider2D, CompositeCollider2D)
7. **敵AI** (waypoint移動, 状態マシン)
8. **UI** (体力バー, スコア表示)
9. **ゲームマネージャー** (状態管理, シーン遷移)

---

## マルチエージェントパネル (game-dev-supercharger)

4つのAIエキスパートが実装前に意思決定を検証:

- **GameDesignExpert**: プレイヤー心理と関与メカニクスを評価
- **UnityArchitect**: アーキテクチャパターンとベストプラクティスをレビュー
- **PerformanceEngineer**: 最適化とフレームバジェットを分析 (モバイル目標: 60FPS, 100ドローコール)
- **VisualDirector**: アートディレクションとビジュアル一貫性を評価

Claudeが会話から自動的に適切なエージェントを選択する。「これを使うべき?」→ Expert Consultant、「スプライトを作成して」→ Asset Generator。(medium: github.com/nategarelik/game-dev-supercharger)

---

## Codex CLI固有のワークフロー

OpenAI Codex CLIはターミナルから直接Unity C#コードを生成:

```bash
# Codex CLIでプレイヤーコントローラーを生成
codex "Unity 2022 LTS用のPlayerController.csを作成。
Rigidbody2D移動、ジャンプ、地面検出(Raycast)を実装。
Input Systemパッケージを使用"
```

**推奨プロジェクト構造 (Codex設定より):**
```
Assets/
  Scripts/
  Addressables/
  UI/
  Prefabs/
  Scenes/
```

イベント駆動プログラミングでコードを疎結合に保つことを推奨。ScriptableObjectでデータ管理。(medium: github.com/viksant vibe-coding-tools)

---

## 実プロジェクト適用例

- [[AI-Grimoire/06_MVP開発計画]] — このワークフローを参考にしたMVPフェーズ設計
- [[AI-Grimoire/00_概要]] — 適用先のハッカソンプロジェクト

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | **直接参照** | インクリメンタル開発順序 (入力→移動→地面→UI→ゲームマネージャー) はそのまま使える |
| **MVP必須度** | **最優先** | 「仕様ロック後に実装開始」原則はAI Grimoireの縦切りMVP戦略と合致 |
| **AI実装適性** | 高 | Phase 1-5 (設計) を人間が行い Phase 6-8 (実装) をAIに任せる分担が最適 |
| **人間が実装すべき箇所** | Phase 1-5 (GDD、機能リスト、アーキテクチャ、テスト計画、タスク分解) の全て |

**AI Grimoire向けインクリメンタル順序**:
1. `ApiConfig.useMock = true` で MockSpellApiClient をDI
2. マイクUIと入力トリガー (ボタン押下でモック評価)
3. EvaluationResult表示 (HP変化 + スコアUI)
4. 実音声録音 → WAVバイト列変換
5. Cloud Run接続 (useMock = false) に切り替え
6. リザルト画面

---

## 出典

- (Source: claudelab.net/en/articles/claude-code/claude-code-unity-mcp-game-dev-workflow)
- (Source: github.com/nategarelik/game-dev-supercharger)
- (Source: medium.com/artcenter-graduate-interaction-design/i-used-ai-to-code-a-game-in-unity)
