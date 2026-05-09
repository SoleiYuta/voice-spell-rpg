---
type: concept
title: "Codex Plugin for Claude Code"
updated: 2026-05-09
tags:
  - codex
  - claude-code
  - plugin
  - official
  - openai
status: developing
related:
  - "[[AGENTS.mdとCodex Skills設計]]"
  - "[[Unity AIツール比較]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
---

# Codex Plugin for Claude Code

OpenAI公式のClaude Code内Codex統合プラグイン。Claude CodeセッションからCodexのコードレビューとタスク委任を直接行える。

---

## 概要

**リポジトリ**: https://github.com/openai/codex-plugin-cc

Claude Codeユーザーが既存ワークフローを維持しながらCodexの機能を使うためのブリッジ。「Claude Codeしか使っていないが、Codexのコードレビュー品質も利用したい」というニーズに応える。

---

## インストール

```bash
# 1. マーケットプレイスを追加
/plugin marketplace add openai/codex-plugin-cc

# 2. プラグインをインストール
/plugin install codex@openai-codex

# 3. プラグインをリロード
/reload-plugins

# 4. セットアップ実行
/codex:setup
```

**前提条件:**
- Node.js 18.18+
- ChatGPTサブスクリプション (Plus/Pro/Business/Edu/Enterprise) またはOpenAI APIキー

---

## 利用可能コマンド

| コマンド | 機能 |
|---------|------|
| `/codex:review` | 未コミット変更またはブランチの標準コードレビュー (読み取り専用) |
| `/codex:adversarial-review` | 設計の前提と実装の選択を質問する対抗レビュー |
| `/codex:rescue` | バグ調査や修正タスクをCodexに委任 |
| `/codex:status` | 実行中・完了済みCodexジョブの表示 |
| `/codex:result` | 完了ジョブの最終出力を表示 |
| `/codex:cancel` | アクティブなバックグラウンドタスクを停止 |
| `/codex:setup` | インストール確認と任意のレビューゲート管理 |

---

## Unity 2D開発での活用パターン

### パターン1: 二重レビューによる品質保証

```bash
# Claude Codeがプレイヤーコントローラーを生成した後
/codex:review
# → Codexが同じコードを別視点でレビュー
# → ハルシネーションや見落としを相互チェック
```

### パターン2: アドバーサリアルレビューで設計を強化

```bash
/codex:adversarial-review
# 例: 「Rigidbody2Dのvelocity直接操作 vs AddForceのトレードオフは?」
# → CodexがClaude Codeの設計選択を意図的に質問・批判
# → ゲームバランスや物理設計の前提を再考
```

### パターン3: 複雑なバグ調査をCodexに委任

```bash
/codex:rescue
# 例: 「ダブルジャンプのカウントが特定条件下でリセットされない」
# → CodexがバックグラウンドでデバッグをCode
/codex:status   # 進捗確認
/codex:result   # 結果取得
```

---

## Claude Code + Codexのハイブリッド戦略

両ツールの強みを組み合わせたUnity 2D開発フロー:

```
1. Claude Code (CLAUDE.md設定済み)
   → プロジェクト全体のアーキテクチャ設計
   → CLAUDE.mdを参照した一貫したコード生成
   
2. /codex:review
   → Claudeが生成したコードをCodexが独立レビュー
   
3. /codex:adversarial-review
   → ゲームシステムの設計トレードオフを検討
   
4. /codex:rescue (必要時)
   → Claude Codeが詰まったバグをCodexに委任
```

---

## 注意事項

- Codex自体のインストールが必要 (`npm install -g @openai/codex`)
- Claude CodeとCodexは別のAPIキーを使用
- バックグラウンドジョブは `/codex:status` で確認が必要
- ゲーム開発固有の用途ガイドは公式READMEに未記載 (medium: 独自解釈)

---

## 出典

- (Source: github.com/openai/codex-plugin-cc)
- (Source: github.com/openai/codex-plugin-cc/blob/main/README.md)
