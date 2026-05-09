---
type: concept
title: "Unity MCP Claude Code 2D検証レポート"
updated: 2026-05-10
tags:
  - unity
  - mcp
  - claude-code
  - verification
  - 2d
  - bullet-hell
  - dungeon
status: developing
related:
  - "[[Unity 2D AIジャンル別実装検証]]"
  - "[[uLoopMCPとAI駆動Unityループ]]"
  - "[[Unityプロシージャル生成とAI]]"
---

# Unity MCP Claude Code 2D検証レポート

DevelopersIO (dev.classmethod.jp) による独立検証。弾幕シューティング・プラットフォーマー・ダンジョン生成の3ジャンルでClaude Code × MCPを実測評価。

---

## 検証概要

**実施**: DevelopersIO (Classmethod社)  
**ソース**: dev.classmethod.jp/en/articles/unity-mcp-claude-code-2d-game-verification/  
**ゲーム3種**: 弾幕シューティング / 自動生成プラットフォーマー / ダンジョン探索

---

## 結果サマリー

| ジャンル | 時間 | 結果 | 備考 |
|---------|------|------|------|
| 弾幕シューティング | 7.5分 | 成功 | 500-1000発の弾を最適化 |
| プラットフォーマー | 9分 | ほぼ成功 | 全プラットフォームに到達可能 |
| ダンジョン探索 | 49分 | 部分失敗 | 初期版: 第1部屋から脱出できない |

---

## 詳細: 弾幕シューティング (成功)

- **7.5分でプレイアブルに**: オブジェクトプールを自動的に実装し500-1000発の弾を最適化
- 敵のスポーン、弾の軌跡計算、衝突判定をすべてMCP経由で生成
- **成功要因**: タスクの粒度が小さく、データ的な正しさ = プレイ可能性が一致するジャンル

---

## 詳細: プラットフォーマー (ほぼ成功)

- **9分で完成**: ランダム配置でも全プラットフォームに到達可能な設計
- Claude Code が「全プラットフォームへの到達性」を検証するロジックを自動生成
- プラットフォームの隙間チェックをBFSで実装

---

## 詳細: ダンジョン探索 (部分失敗)

### 初期の問題

**「最初の部屋から脱出できない」**:
- 出口の扉が壁の内側に配置されていた
- AIが座標計算を誤り、ドアが実際には通過不可能な位置に

**修正後も残存した問題**:
- **「落ちたら戻れない上向きの通路のみの部屋」** が生成された
- 一方向にしか進めない行き止まり部屋

### 根本原因: データ正確性 ≠ プレイ可能性

> **「Claude Codeは論理的に正しいダンジョン構造を生成したが、プレイヤーの実操作を想定した検証を実施していない」**

AIが自己テスト時にワープ (瞬間移動) 機能で確認するため、コントローラーでの実際のプレイとのギャップが生じる。

---

## DevelopersIOの結論

> 「**単純なゲームは実用的だが、複雑な要件では人間による「プレイ可能性」の補完が不可欠**」

---

## 改善策: プレイアブル性の自動検証

DevelopersIOの知見をもとに設計する検証コード。

```
プロンプト例:
「ダンジョン生成後にPlayabilityValidator.cs を実行:
1. スタート位置から全部屋へのBFS到達性確認
2. 各部屋にコントローラー操作 (最大ジャンプ高さ: 4タイル) で入退場できるか確認
3. 一方向通行の部屋 (入れるが出られない) を検出
4. 問題があれば再生成 (最大10回)
5. 全チェックをPassした場合のみシーンを有効化」
```

**キーポイント**: テレポート/ワープを使わず、キャラクターの実際の移動能力 (ジャンプ高さ・移動速度) を制約として組み込む。

---

## Claude Visionによるスクリーンショット分析

Claude Opus 4.7 の高解像度Vision機能 (最大2576px) を使ったゲームプレイフィードバック。(medium: kevurugames.com)

```
ワークフロー:
1. uloop-capture-window でゲームのスクリーンショット取得
2. Claude Codeに渡す:
   「このスクリーンショットを見てゲームプレイの問題点を特定してください:
   - プレイヤーキャラクターが見えにくい
   - UIレイアウトが不自然な箇所
   - 明らかに通過できない地形
   - 色のコントラストが低い箇所」
3. Claude Codeが視覚的問題点をリストアップ
4. 修正コードを生成
```

---

## 物理設定の自動化 (manage_physics)

mcp-unityの `manage_physics` ツール (21アクション) でレイヤーコリジョンマトリクスをコードから設定。(medium: github.com/CoplayDev/unity-mcp)

```
Claude Codeへの指示例:
「Physics 2Dのコリジョンマトリクスを設定:
- Player と Enemy は衝突
- Player と EnemyBullet は衝突  
- PlayerBullet と Enemy は衝突
- Enemy と Enemy は衝突しない (スルー)
- PlayerBullet と PlayerBullet は衝突しない
manage_physicsツールでProject Settings > Physics 2Dを更新して」
```

**注意**: コリジョンレイヤー設定はMCP経由でも自動化できるが、最終確認は人間が行うこと。設定の見落としが物理バグの根本原因になりやすい。

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | **必読** | 「データ正確性 ≠ プレイ可能性」の教訓はAI Grimoireの音声評価にも直接適用できる |
| **MVP必須度** | 高 | AIが生成した評価ロジックを鵜呑みにせず、実際の音声でテストする必要性を示す |
| **AI実装適性** | — (参照用レポート) | |
| **人間が実装すべき箇所** | 実際の音声でのE2Eテスト、evaluationが体験として機能するかの判断 |

**AI Grimoire での教訓適用**:
- AIが生成した `spell_power` 計算を「数式的に正しい」だけでなく「詠唱体験として面白いか」で評価する
- `MockSpellApiClient` でデータ的に正しい応答を作るだけでなく、実際にプレイして「評価が面白いか」を確認する
- データ整合性テストに合格しても、実プレイテストは別途必要

---

## 出典

- (Source: dev.classmethod.jp/en/articles/unity-mcp-claude-code-2d-game-verification/)
- (Source: github.com/CoplayDev/unity-mcp)
- (Source: github.com/razor-ai/claude-code-game-studios/blob/main/docs/engine-reference/unity/modules/physics.md)
- (Source: kevurugames.com/blog/using-claude-ai-in-game-development-tools-use-cases-and-industry-statistics)
