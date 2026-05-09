---
type: concept
title: "Unityセーブシステムとゲームバランス自動化"
updated: 2026-05-10
tags:
  - unity
  - save-system
  - game-balance
  - claude-code
  - serialization
  - scriptable-object
status: developing
related:
  - "[[Unity 2D AIコード生成パターン]]"
  - "[[RPGデータベース設計]]"
  - "[[Claude Code Game Studios設計]]"
---

# Unityセーブシステムとゲームバランス自動化

Claude CodeによるセーブシステムとゲームバランスのAI設計パターン。JSON vs Binary の選択、バランスパラメーターのAI提案。

---

## セーブシステム設計

### JSON vs Binary 選択基準

| 基準 | JSON | Binary |
|------|------|--------|
| デバッグ | 容易 (人間が読める) | 困難 |
| ファイルサイズ | 大 | 小 (約40-60%) |
| 速度 | 遅い (1MBで約100ms) | 速い |
| バージョン互換 | 容易 | 要管理 |
| AI生成適性 | 高 | 中 |

**推奨**: 中規模ゲームはJSONで十分。大量データ (10万レコード以上) はバイナリ。

---

## セーブシステムのプロンプトパターン

### クリーンアーキテクチャ構成

```
プロンプト例:
「レイヤード・アーキテクチャのセーブシステムを実装:

Domain層:
- ISaveRepository インターフェース (Save, Load, Delete, Exists)
- SaveData クラス (GameProgress, PlayerData, Settings)

Infrastructure層:
- JsonSaveRepository: JsonUtility でJSON保存 (Application.persistentDataPath)
- BinarySaveRepository: System.Runtime.Serialization.Formatters.Binary で保存
- EncryptedSaveRepository: JsonをAES暗号化

Application層:
- SaveManager: VContainer でリポジトリをDI、AutoSave機能
- 自動セーブ: 60秒ごと + シーン遷移時

VContainerのLifetimeScope:
- SaveRepositoryをシングルトンで登録
- 環境変数でDebug=Json、Release=Binary を切替」
```

---

## ScriptableObjectベースのゲームバランス管理

バランスパラメーターをScriptableObjectで管理し、Claude Codeが提案・調整するパターン。

```
プロンプト例:
「EnemyBalanceSO (ScriptableObject) を作成:
- HP, Attack, Defense, Speed, ExpReward, GoldReward
- [MinMaxRange] カスタムAttributeで範囲制限
- [CreateAssetMenu] でアセット作成可能に

EnemyFactory.cs:
- EnemyBalanceSO[] balanceConfigs を参照
- Difficulty (Easy/Normal/Hard) に応じてパラメーターをスケーリング:
  Easy: HP*0.7, Attack*0.7
  Hard: HP*1.5, Attack*1.3
- ランダム性: HP ± 10%のバリエーション」
```

---

## AIによるゲームバランス提案

Claude Code Game Studiosの `/balance-check` コマンドを使った自動バランスチェック。(medium: github.com/Donchitos/Claude-Code-Game-Studios)

```
使用方法:
/balance-check

出力例:
- プレイヤーHP: 100、エネミーダメージ: 45 → 最初の2発で死亡。TTK (Time to Kill) が短すぎる
- スライム (Lv1) の経験値: 10、Lv2に必要: 100 → 10匹倒す必要がありチュートリアルが長い
- 提案: スライムExp → 20、プレイヤーHP → 150
```

### バランス分析プロンプト

```
「以下のゲームパラメーターを分析してバランス提案をしてください:

プレイヤー:
- HP: 100, 攻撃力: 25, 移動速度: 5

エネミーリスト:
- スライム: HP 30, 攻撃力 10, 速度 3
- ゴブリン: HP 50, 攻撃力 20, 速度 4
- ドラゴン: HP 500, 攻撃力 80, 速度 6

目標:
- プレイヤーが初心者でも数秒生き残れる
- ドラゴン戦は緊張感のある5分間の戦闘
- 1-10面の難易度カーブ

現在の問題: ドラゴン戦でプレイヤーが2秒で死ぬ」
```

---

## 難易度調整の自動化パターン

Dynamic Difficulty Adjustment (DDA) のClaude Code実装。

```
プロンプト例:
「Dynamic Difficulty Adjustmentを実装:
- DifficultyManager.cs
- プレイヤーの死亡回数、クリア時間、ダメージ受量をトラッキング
- 5回連続死亡: 敵HP-10%, 攻撃力-10%
- ノーダメージクリア3回: 敵HP+15%, 攻撃力+10%
- 調整値の上下限: ±30%
- 調整はゲームオーバー時またはステージクリア時にのみ適用
- ScriptableObjectに調整履歴を保存」
```

---

## クラウドセーブ (Unity Gaming Services)

Unity Gaming Services (UGS) のCloud Save APIとClaude Codeの連携。

```
プロンプト例:
「Unity Cloud Saveを使ったオンラインセーブ:
- CloudSaveRepository: ISaveRepositoryの実装
- CloudSaveService.Instance.Data.Player.SaveAsync() でセーブ
- LoadAsync() でロード
- 接続エラー時はローカルJSON にフォールバック
- 最終同期時刻をPlayerPrefsに保存
- 競合解決: サーバー側を優先 (Last Write Wins)」
```

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | セーブはFirestore、バランスは別管理 | AI GrimoireはセッションログをFirestoreに保存する設計 (05_技術構成) |
| **MVP必須度** | 低 (セーブ) / 高 (バランス設計) | ローカルセーブ不要。バランスパラメーター (spell_power式の係数) の設計は重要 |
| **AI実装適性** | 高 (JSONシリアライズ) | `EvaluationResult` のJSON→C#変換は AIが得意 |
| **人間が実装すべき箇所** | spell_power式の係数チューニング (0.5 + match_rate × 1.0 の係数が体験として適切かどうか)、DDA不要の判断 |

**AI Grimoire でのバランス設計例**:
```
spell_power = base_power × (0.5 + match_rate × 1.0)
               × volume_factor × speed_factor × completion_rate
```
この係数 (0.5、1.0) が体験的に正しいかはAIには判断できない。実際に詠唱してみて調整するのは人間の仕事。

---

## 出典

- (Source: generalistprogrammer.com/tutorials/game-save-systems-complete-data-persistence-guide-2025)
- (Source: github.com/Donchitos/Claude-Code-Game-Studios)
- (Source: discussions.unity.com/t/mcp-ai-ide-cursor-antigravity-claude-code-windsurf-next-steps-for-unity-workflow-automation/1705679)
- (Source: claudelab.net/en/articles/claude-code/claude-code-unity-game-development-guide)
- (Source: discussions.unity.com/t/solved-future-proofing-the-save-function-json-or-binary-serialization/668333)
