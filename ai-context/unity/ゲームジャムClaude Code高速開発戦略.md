---
type: concept
title: "ゲームジャムClaude Code高速開発戦略"
updated: 2026-05-10
tags:
  - game-jam
  - claude-code
  - rapid-prototyping
  - unity
  - 2d
  - workflow
status: developing
related:
  - "[[Vibe Coding 2Dゲーム実践ワークフロー]]"
  - "[[日本語コミュニティUnity AI開発事例]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
---

# ゲームジャムClaude Code高速開発戦略

ゲームジャム (48-72時間制限) 向けのClaude Code × Unity高速プロトタイピング。AI活用でプロトタイプ時間を従来の95%削減した事例あり。

---

## ゲームジャムでのAI効果

| 指標 | 従来 | AI活用 |
|------|------|--------|
| プロトタイプ時間 | 40-80時間 | 2-10分 |
| スプライト生成 | — | 5-10秒 |
| 開発時間削減 | — | 約60% |
| ゲームジャム完成率 | — | 向上 |

- **1時間でプレイアブルゲーム**: Unity + Claude MCP で1時間以内にゲーム完成 (Udemy講座「Build Your First Unity Game in 1 Hour」)
- **5時間完成事例**: NNNiNiNNN氏が5時間でゲームジャムを完走、コードを一行も書かずに (qiita.com/NNNiNiNNN)

---

## ゲームジャム向けCLAUDE.md テンプレート

ゲームジャムは時間が限られているためCLAUDE.mdを最小限に。必須事項のみ記載。

```markdown
# GameJam CLAUDE.md (ミニマル版)

## プロジェクト
ゲームジャムプロジェクト: [テーマ名]
制限時間: 48時間
ターゲット: WebGL (unityroom公開予定)

## 環境
Unity 2022.3 LTS, URP 2D, New Input System
ターゲット: WebGL

## 方針
- シンプルを最優先。機能を絞る
- 1機能1コミット
- 動くものを最小単位で作る (「最小単位で動くものを作る」)
- 3時間でも未完成より完成したゲーム

## 禁止事項
- DOTS/ECS (学習コスト高)
- Addressables (設定時間がかかる)
- ネットワーク機能 (スコープ外)
```

---

## ゲームジャム 48時間スケジュール

```
Hour 0-2: セットアップ
  - Claude Code でプロジェクト初期化
  - CLAUDE.md を上記テンプレートで作成
  - コアメカニクス1つを決定

Hour 2-8: コアループ実装
  - /dev-game でゲームループ生成
  - プレイヤー移動 → 敵 → コリジョン → スコア
  - 「動く最小バージョン」を完成させる

Hour 8-16: コンテンツ追加
  - ステージ・難易度調整
  - サウンド (FMOD不要、AudioSource直接)
  - アニメーション (シンプルなSpriteAnimation)

Hour 16-24: ポリッシュ
  - UIスクリーン (タイトル・ゲームオーバー・クリア)
  - エフェクト (パーティクル)
  - バグ修正

Hour 24-36: WebGLビルドと提出準備
  - WebGLビルドテスト
  - unityroom 登録・説明文作成
  - Claude Code で説明文ドラフト生成

Hour 36-48: バッファ / 追加ポリッシュ
```

---

## コアループ最速実装プロンプト

```
「ゲームジャム用シューティングゲームのコアループを実装:

目標: 30分でプレイアブルにする

1. PlayerController.cs
   - WASD/矢印で移動 (New Input System)
   - Space でショット (0.2秒クールダウン)
   - HP: 3

2. EnemySpawner.cs
   - 2秒ごとにランダム位置から敵をスポーン
   - Object Pool (20体)

3. Bullet.cs
   - 上方向に直進、範囲外で破棄
   - 敵に当たったらDamage(1)

4. GameManager.cs
   - スコア、HP管理
   - HP0でGameOver表示
   - 全敵撃破でStageClear表示

シンプルさ最優先。Awake/Startの依存を最小化。」
```

---

## WebGLビルド最速設定

Claude Codeに依頼できる設定。

```
「WebGLビルドの最適設定:
- PlayerSettings.WebGL: CompressionFormat = Gzip
- PlayerSettings.WebGL: MemorySize = 256
- PlayerSettings.WebGL: ExceptionSupport = None (高速化)
- Quality Settings: 低品質プリセット作成 (WebGL向け)
- unityroom 対応: 推奨解像度 1280x720
- Build And Run でローカルテスト」
```

---

## AI生成スプライトの活用

Unityの公式AI Generators (オープンベータ) + 外部サービスで素材生成。

```
素材生成ワークフロー:
1. Unity AI Generators でプロトタイプ用スプライト生成 (テキストプロンプト)
2. DALL-E / Stable Diffusion でゲームジャムアート
3. Claude Code で PaletteSO (ScriptableObject) を生成
4. カラーパレットを統一してアート品質を底上げ
```

---

## ゲームジャム必須スキル一覧

Claude Code Marketplaceで入れておくべきスキル。

```
/plugin marketplace add dev-gom/claude-code-marketplace unity-test-runner
/plugin marketplace add unity-development
/plugin marketplace add unity-script-debugger
```

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | **直接適用** | AI Grimoireはハッカソン開発。48時間スケジュールはそのまま参考になる |
| **MVP必須度** | **最優先** | 「動く最小バージョン」方針と「禁止事項」(DOTS/Addressables) はそのまま採用 |
| **AI実装適性** | 高 | ゲームループ生成プロンプトはAI Grimoire向けに調整するだけで使える |
| **人間が実装すべき箇所** | 「コアメカニクス1つを決定」の判断、スケジュールの実際の調整、WebGLかStandaloneかのターゲット決定 |

**AI Grimoire向けスケジュール調整**:
- Hour 0-2: 既存CLAUDE.md設定 + VContainer/UniTaskセットアップ
- Hour 2-6: MockSpellApiClientで音声→評価→表示フロー完成 (ネットワーク不要)
- Hour 6-12: Cloud Run API接続 + 実音声テスト
- Hour 12-18: STT + Gemini評価フロー
- Hour 18-24: デモフロー最終確認 + 発表準備

---

## 出典

- (Source: kevurugames.com/blog/using-claude-ai-in-game-development-tools-use-cases-and-industry-statistics)
- (Source: udemy.com/course/unity-ai-claude-mcp/)
- (Source: seeles.ai/resources/blogs/ai-game-maker-complete-guide-2026)
- (Source: qiita.com/NNNiNiNNN)
- (Source: claudelab.net/en/articles/claude-code/unity-claude-code-game-dev-accelerate)
