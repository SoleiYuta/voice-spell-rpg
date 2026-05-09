---
type: meta
title: "Wiki Index"
updated: 2026-05-10
tags:
  - meta
  - index
status: evergreen
related:
  - "[[hot]]"
  - "[[log]]"
---

# Wiki Index

**Project codename: AI Grimoire (仮)** | Last updated: 2026-05-10

> 初めて来た人は [[TEAM_START_HERE]] から読んでください。

Navigation: [[TEAM_START_HERE]] | [[hot]] | [[log]]

---

## ナビゲーション (メタ)

| ファイル | 目的 |
|---|---|
| [[TEAM_START_HERE]] | 新規メンバー向け入口・Obsidian開き方・Git運用 |
| [[hot]] | 今日やること・現在フェーズ・禁止事項 |
| [[log]] | 調査・判断履歴 (なぜその決定をしたか) |
| [[index]] | このファイル。全ノートの地図 |

---

## AI Grimoire (仮) — ハッカソンプロジェクト

現在フェーズ: **フェーズ0 着手 (Mock完結)**
実装導線: [[TEAM_START_HERE]] → [[hot]] → 以下のページを順に読む

### 実装必読ノート (優先順)

> 実装前に必ず読む。仕様変更はここを更新する。

- [[AI-Grimoire/縦切り実装ロードマップ]] — フェーズ0〜6の工程・各完了条件
- [[AI-Grimoire/Unity責務分割]] — スクリプト一覧・DI設定・誰が何を担当するか
- [[AI-Grimoire/SpellResultデータ構造]] — EvaluationResult C#クラス (フィールド名厳守)
- [[AI-Grimoire/MockApiClient運用]] — Mock切替手順・テストシナリオ

### プロジェクト設計ノート

- [[AI-Grimoire/00_概要]] — ゲームコンセプト・ハッカソン戦略 (まず読む)
- [[AI-Grimoire/01_ハッカソン要件対応]] — GCP要件対応チェックリスト
- [[AI-Grimoire/02_ゲームシステム]] — 詠唱システム・ゲームフロー・シーケンス図
- [[AI-Grimoire/03_AIエージェント設計]] — AI 5役割 (STT/評価/呪文生成/GM/リザルト)
- [[AI-Grimoire/04_音声詠唱評価項目]] — 14評価軸・ゲーム効果対応表
- [[AI-Grimoire/05_技術構成]] — アーキテクチャ・mermaidデータフロー
- [[AI-Grimoire/06_MVP開発計画]] — 縦切りMVP・5フェーズ優先順序
- [[AI-Grimoire/07_発表デモ構成]] — 60秒デモタイムライン・30秒ピッチ
- [[AI-Grimoire/08_リスクと対策]] — 5リスク+緩和策・リスクマトリクス

### 技術調査

- [[AI-Grimoire/tech/採用技術まとめ]] — **確定スタック** (ここが技術選定の根拠)
- [[AI-Grimoire/tech/AI側技術調査]] — Gemini 2.5 Flash・STT v2・音声評価アルゴリズム
- [[AI-Grimoire/tech/バックエンド構成]] — FastAPI・Cloud Run・Firestore
- [[AI-Grimoire/tech/API設計]] — 4エンドポイント仕様・UnityWebRequest実装
- [[AI-Grimoire/tech/音声評価ロジック]] — rapidfuzz/librosa・spell_powerスコア算式
- [[AI-Grimoire/tech/Google Cloud構成]] — IAM・Secret Manager・Cloud Logging
- [[AI-Grimoire/tech/GitHub ActionsとCI_CD]] — Workload Identity Federation・デプロイワークフロー

---

## Unity AI 開発ナレッジ (リサーチ完了・参照用)

> 実装中に必要になったら参照する。能動的に読む必要はない。

### 主要コンセプト

- [[concepts/Claude CodeとCodexによるUnity 2Dゲーム開発の概要]] — AI得意/苦手領域・3大ツール
- [[concepts/Unity プロジェクトのCLAUDE.md設計]] — 6セクション構成・必須記載事項
- [[concepts/AI Unityゲーム開発ワークフロー]] — 8フェーズspec-driven・インクリメンタル順序
- [[concepts/Unity AIツール比較]] — Claude Code vs Codex CLI vs GitHub Copilot
- [[concepts/Unity MCP統合]] — mcp-unity/unity-cli-loop・30+ツール
- [[concepts/AI Grimoire MVP実装ガイド]] — AI Grimoire向けCLAUDE.mdテンプレート

### 実装パターン

- [[concepts/Unity 2D AIコード生成パターン]] — 移動/タイルマップ/物理/ScriptableObject
- [[concepts/Unity 2D敵AIとアーキテクチャパターン]] — FSM/HFSM・ScriptableObjectイベント
- [[concepts/Claude Codeマルチエージェント並列Unity開発]] — git worktree分離・専門エージェント
- [[concepts/Unity New Input SystemとAI実装パターン]] — InputAction・PlayerInput
- [[concepts/Unityセーブシステムとゲームバランス自動化]] — JSON/Binary・DDA
- [[concepts/UnityテストとClaude Code自動化]] — unity-test-runner・E2E自動化

### ツール・環境

- [[concepts/Unity 公式MCP設定ガイド]] — com.unity.ai.assistant付属MCP・Claude Code接続
- [[concepts/uLoopMCPとAI駆動Unityループ]] — 自律開発サイクル
- [[concepts/Claude Code Unity MCP接続安定化ガイド]] — stdioモード・Session not found解消
- [[concepts/AGENTS.mdとCodex Skills設計]] — Codex Skills/Plugins・Unity 2D設定例
- [[concepts/Codex Plugin for Claude Code]] — /codex:review・rescue

### 専門領域

- [[concepts/Unity 2Dパフォーマンス最適化とAI]] — SRP Batcher・GPU Instancing・Burst
- [[concepts/UnityシェーダーとVFXのAI生成]] — ShaderLab/HLSL・JSON→シェーダーパイプライン
- [[concepts/Unityローカライゼーション自動化]] — Unity Localizationパッケージ・AI翻訳
- [[concepts/UnityAddressablesとAIアセット管理]] — 非同期ロード・Handle.Release管理
- [[concepts/Unity AIデバッグ支援とログ分析]] — uloop-get-logs・AI自動修正ループ
- [[concepts/Unityプロシージャル生成とAI]] — WFC/BSP/Perlin・プレイアブル性検証
- [[concepts/AIによるUnityレベルデザイン自動化]] — AI Level Designer・タイルマップ
- [[concepts/Unity 2Dアニメーション・サウンド・UIのAI実装]] — Cinemachine/FMOD/UI Toolkit
- [[concepts/Unityゲームリリースパイプラインとビルド自動化]] — pre-buildフック・GitHub Actions
- [[concepts/Unity DOTS・ECSとAIコード生成の限界]] — 三重苦・CLAUDE.mdでDOTS禁止
- [[concepts/Unity AI Beta 2026とUI自動生成]] — オープンベータ・Figma→UI Toolkit変換
- [[concepts/Unity 2D AIジャンル別実装検証]] — 弾幕7.5分成功・ダンジョン49分部分失敗
- [[concepts/ゲームジャムClaude Code高速開発戦略]] — 48時間スケジュール・WebGLビルド
- [[concepts/VContainer・UniTask・R3とAI連携パターン]] — フレームワーク参照文書設計
- [[concepts/GodotとUnityのAIコード生成比較]] — GDScript vs C#・エンジン選択指針
- [[concepts/CodexとClaude Codeの実践的役割分担]] — 設計 (Claude) + 実装 (Codex) 分業
- [[concepts/日本語コミュニティUnity AI開発事例]] — Qiita/Zenn/note 4事例
- [[concepts/Claude Code Game Studios設計]] — 49エージェント/72スキル構成
- [[concepts/Vibe Coding 2Dゲーム実践ワークフロー]] — 5フェーズ手順・失敗パターン
- [[concepts/Unity AI公式ツール 2026]] — Unity AI Beta・Sentis・AI Gateway
- [[concepts/Unity MCP Claude Code 2D検証レポート]] — DevelopersIO独立検証

---

## アーカイブ (現プロジェクト非使用)

> 削除せず保管。参照は自由。詳細は [[archive/index]]。

### RPGエンジン リサーチ

- [[concepts/RPGツクール風ゲームエンジンの概要]]
- [[concepts/タイルマップシステム]]
- [[concepts/RPGイベントシステム]]
- [[concepts/RPGバトルシステム]]
- [[concepts/RPGデータベース設計]]
- [[concepts/ゲームエンジンアーキテクチャ]]

---

### プラグイン開発ナレッジ (claude-obsidian v1.6.0)

- [[concepts/LLM Wiki Pattern]]
- [[concepts/DragonScale Memory]]
- [[concepts/Compounding Knowledge]]
- [[concepts/Hot Cache]]
- [[concepts/Persistent Wiki Artifact]]
- [[concepts/Source-First Synthesis]]
- [[concepts/Query-Time Retrieval]]
- [[concepts/SVG Diagram Style Guide]]
- [[Wiki vs RAG]]
- [[claude-obsidian-ecosystem]]

---

## 100_AI_WORKSPACE

一時的なAI作業領域。会話をまたいで引き継ぐ作業中データ。

- `wiki/100_AI_WORKSPACE/tmp/` — 作業中の一時ファイル
- `wiki/100_AI_WORKSPACE/summaries/` — 調査サマリー
- `wiki/100_AI_WORKSPACE/investigations/` — 調査結果
- `wiki/100_AI_WORKSPACE/scratch/` — スクラッチメモ
