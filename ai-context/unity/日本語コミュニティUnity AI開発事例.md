---
type: concept
title: "日本語コミュニティUnity AI開発事例"
updated: 2026-05-09
tags:
  - unity
  - claude-code
  - codex
  - case-study
  - japanese
  - 2d
status: developing
related:
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
  - "[[Unity プロジェクトのCLAUDE.md設計]]"
  - "[[uLoopMCPとAI駆動Unityループ]]"
---

# 日本語コミュニティUnity AI開発事例

Zenn・Qiita・noteの日本語コミュニティによるClaude Code/Codex + Unity開発の実践報告まとめ。

---

## 事例1: 商用UnityゲームをAIに全コーディング委任 (Qiita)

**URL**: qiita.com/archeleeds/items/6fbf02174f308e31f284  
**ゲーム**: DungeonInn (Steamリリース予定のシミュレーションゲーム)

### Claude Code + Codex の役割分担

| ツール | 担当領域 |
|--------|---------|
| Claude Code | 全体アーキテクチャ設計・監督 |
| Codex | 具体的な実装コードの生成 |

AIとAIの間のコミュニケーションをMarkdownファイルで行い、人間の介入なしに開発サイクルを回す。(high: qiita.com/archeleeds)

### 重要な発見: データ構造先行設計

「ゲームロジックの本質はUnityの外側にある」。UIや見た目より先にDomain/UseCase/Masterデータ構造を設計することで効率が劇的に向上。アセンブリライン的な開発を実現。

### 成功条件

1. **ドキュメント整備**: AI向けコードパターン・アーキテクチャルール・ドメイン設計ガイドラインを作成 (上級エンジニア2ヶ月分の初期投資)
2. **コード品質フィードバックループ**: レビューコメントからスタイルガイドを逆算生成
3. **フレームワーク参照文書**: VContainer・UniTask・R3の能力についての包括的なリファレンス

### 限界

- アーキテクチャ基盤なしではデバッグ効率がボトルネック
- 初期投資 (ガイドライン作成) なしには高品質出力にならない

---

## 事例2: CLAUDE.mdで作業時間が体感半分に (note)

**URL**: note.com/ryuryu_game/n/n657865017c70

### 変化の核心

CLAUDE.mdを整備してからAIが「最初からプロジェクトを理解した状態でスタート」できるようになった。

**Before**: Unityバージョン・URP設定・依存アセットを毎セッション説明  
**After**: 「ジャンプ機能を追加して」だけでUniTask・DOTweenを活用したコードが生成される

### CLAUDE.mdの3つの必須要素

1. **Unity環境情報**: バージョン + レンダリングパイプライン (旧APIの提案を防ぐ)
2. **フォルダ構成**: 人間管理ディレクトリとAI管理ディレクトリを分離
3. **コーディング規約**: 「MonoBehaviourを最小化」「ロジックはPure C#に」→テスタブルな設計

### 実践的なヒント

- CLAUDE.mdは100行以下に抑える (情報過多でAI信頼性が低下)
- `~/.claude/CLAUDE.md` に個人設定 (言語、コミュニケーションスタイル) を記述
- プロジェクト構造変更のたびに更新
- 最初は最小限で始め、観察したギャップに基づいて追記

---

## 事例3: コードゼロで5時間でゲーム完成 (Qiita)

**URL**: qiita.com/NNNiNiNNN/items/101433e7c0c503d1d6d5

### 開発環境

- Claude Desktop (Pro、$20/月) + Claude 3.7
- Unity MCP (日本製サーバー「Isuzu」製: 日本語ドキュメント、接続安定)
- `@modelcontextprotocol/server-filesystem` (ファイル操作補完)

### 作成ゲーム

縦向きの棒が横方向に動き、タップで方向を変え、障害物を避け続ける2Dゲーム「I Escape」(unityroom公開済み)。60秒以内でプレイ完了。

### 重要な教訓

**「最小単位で動くものを作る」** が成功の鍵。

テスト駆動開発を試みたところ、Claudeがコンパイルエラーを含む巨大コードベースを素早く生成し把握不能になった。「一度に全部生成」より「最小機能→確認→次の機能」のサイクルが有効。

### 有効なワークフロー

1. Claudeに実行前に手順を説明させる
2. 各変更後に動作確認
3. コード量を把握できる範囲に維持

---

## 事例4: uLoopMCPで自律的なゲーム開発ループ (Zenn)

**URL**: zenn.dev/unsoluble_sugar/articles/cd8d59be7b8f85

→ [[uLoopMCPとAI駆動Unityループ]] に詳細を記載。

---

## 共通するベストプラクティス (日本語コミュニティより)

1. **CLAUDE.mdは必須** — プロジェクトの前提をAIに教える最重要ファイル
2. **最小単位での開発** — 一度に多くを生成させない
3. **データ構造から設計** — UIより先にドメインオブジェクトを固める
4. **Markdownで仕様共有** — AI-AI間も人間-AI間も仕様はMarkdownで管理
5. **フレームワーク文書を用意** — VContainer/UniTask等の能力参照を事前整備

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | **最重要参考事例** | 同じ日本語コミュニティ・Unity・ハッカソンという状況。事例3 (5時間完成) が最も近い |
| **MVP必須度** | 高 | 「最小単位で動くものを作る」「データ構造から設計」の2つはAI Grimoire MVPに必須の教訓 |
| **AI実装適性** | — (事例集) | |
| **人間が実装すべき箇所** | CLAUDE.mdの作成・維持 (事例2より)、フレームワーク参照文書の整備 (事例1より) |

**AI Grimoire への直接適用**:
- 事例1の「VContainer/UniTask参照文書」→ `AI Grimoire MVP実装ガイド.md` がこの役割を担う
- 事例2の「CLAUDE.mdは100行以下」→ AI Grimoire CLAUDE.mdも最小限に維持する
- 事例3の「最小機能→確認→次」→ Mock→実音声→Cloud Run の段階開発に一致

---

## 出典

- (Source: qiita.com/archeleeds/items/6fbf02174f308e31f284)
- (Source: note.com/ryuryu_game/n/n657865017c70)
- (Source: qiita.com/NNNiNiNNN/items/101433e7c0c503d1d6d5)
- (Source: zenn.dev/unsoluble_sugar/articles/cd8d59be7b8f85)
