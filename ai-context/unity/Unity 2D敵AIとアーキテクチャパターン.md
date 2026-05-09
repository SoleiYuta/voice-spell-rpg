---
type: concept
title: "Unity 2D敵AIとアーキテクチャパターン"
updated: 2026-05-09
tags:
  - unity
  - 2d
  - enemy-ai
  - state-machine
  - observer
  - architecture
  - claude-code
status: developing
related:
  - "[[Unity 2D AIコード生成パターン]]"
  - "[[Unity 2D AIジャンル別実装検証]]"
  - "[[VContainer・UniTask・R3とAI連携パターン]]"
---

# Unity 2D敵AIとアーキテクチャパターン

Claude Code/Codexで生成しやすい敵AIのアーキテクチャパターン。有限状態機械 (FSM) とObserverパターンが2D開発の主軸。

---

## 有限状態機械 (FSM) による敵AI

AIが最もよく生成するパターン。Patrol → Chase → Attack → Retreat のステートを持つ基本構造。

### 基本FSMプロンプト

```
プロンプト例:
「Unity 2022.3 LTS。EnemyStateMachine.csを作成:
- ステート: Patrol (waypoint巡回), Chase (プレイヤー追跡), Attack (攻撃), Dead
- Patrolは[SerializeField]のwaypoint配列を巡回
- ChaseはPlayerの位置に向かってMove()
- Attackは射程内でAttackCooldownが0の時にAttack()を呼ぶ
- ステート遷移: 視野距離内→Chase、攻撃距離内→Attack、HP0→Dead
- 各ステートをInterface IEnemyStateで実装すること
- InjectionはVContainerを使用」
```

### UnityHFSM (階層型FSM)

```
プロンプト例:
「UnityHFSMライブラリを使った階層型FSMでボスAIを実装:
- Phase 1 (HP 100-50%): BasicAttack ステート
- Phase 2 (HP 50-0%): RageMode (サブステートマシン)
  - RageMode内: Rush, LaserBeam, SummonMinion の3ステート
- HPしきい値でフェーズ遷移」
```

**GitHub**: https://github.com/Inspiaaa/UnityHFSM (Unity向け高性能HFSM)

---

## Observerパターンによるイベント連携

ScriptableObjectベースのイベントチャンネルでシステム間を疎結合に。AI生成コードでは最も信頼性が高いアーキテクチャ。

### Unity公式推奨パターン

```
プロンプト例:
「ScriptableObjectベースのイベントシステムを実装:
- GameEventSO: void型イベント (Raise/AddListener/RemoveListener)
- GameEventSO<T>: 型付きイベント
- EnemyDeathEvent: EnemyDataSOを引数に持つイベント

使用例:
- Enemy.cs が EnemyDeathEvent.Raise(this.enemyData) を呼ぶ
- ScoreSystem.cs が EnemyDeathEvent.AddListener(OnEnemyDeath) で購読
- AchievementSystem.cs が同じイベントで実績チェック」
```

Unity公式eBookで推奨されているパターン。(high: unity.com/how-to/scriptableobjects-event-channels-game-code)

---

## ML-Agents によるNPC学習AI

Claude Code/Codexはコードを生成できるが、ML-Agentsは**学習環境のセットアップ**がメインで、学習自体はPythonで実行。

### ML-Agents + Claude Codeの分担

| 役割 | Claude Code | 人間/Python |
|------|-------------|-------------|
| 環境スクリプト | 生成 (C#) | — |
| 報酬関数 | 補助 (提案) | 人間が設計 |
| 学習設定 | 補助 (yaml) | 調整 |
| 学習実行 | 不可 | mlagents-learn |

```
プロンプト例 (環境セットアップ):
「Unity ML-Agents 3.0を使った2Dプラットフォーマー用
 エージェント環境を作成:
- 観測空間: プレイヤー位置、敵位置、ゴール位置 (各2D座標)
- 行動空間: 離散行動 (左移動、右移動、ジャンプ、待機)
- 報酬: ゴール到達+1.0、落下-0.5、タイムアウト-0.01/ステップ
- AgentスクリプトはAgentクラスを継承」
```

**注意**: ML-AgentsのDOTS対応はまだ限定的。シンプルな観測空間から始めること。(medium: 公式ドキュメントより)

---

## Netcode for GameObjects (2Dマルチプレイヤー)

公式の無料マルチプレイヤーパッケージ。Claude Codeはボイラープレートを生成できるが、ネットワーク設計の意思決定は人間が行う。

### 基本的なプロンプト

```
プロンプト例:
「Netcode for GameObjects を使った2Dプラットフォーマーの
 NetworkPlayerController.csを作成:
- [NetworkVariable] でプレイヤー位置を同期
- IsOwner チェックで自分のプレイヤーのみ入力を受け付ける
- ClientRPC でジャンプエフェクトを全クライアントに送信
- ServerRPC でダメージ処理をサーバー権威で実行」
```

**2Dマルチプレイヤーサンプル**: Galactic Kittens (Unity公式、co-op 2Dゲーム)

---

## AIに適したアーキテクチャ設計原則

Claude CodeとCodexが一貫したコードを生成するための原則:

1. **インターフェース駆動**: `IEnemyState`, `IDamageable` 等のインターフェースをCLAUDE.mdに定義
2. **依存性の注入 (VContainer)**: MonoBehaviourへの依存を排除、Pure C#でロジックを書く
3. **ScriptableObjectイベント**: Static eventの代わりにSO-based eventで疎結合
4. **データ/ロジック分離**: EnemyDataSO (データ) + EnemyAI.cs (ロジック) を分離
5. **小さな責務**: 1クラス1責務でAIが把握できるサイズに抑える

---

## 開発フロー (企画→公開の完全ワークフロー)

Claude Code × unity-mcp の8フェーズでの完全自動化実績 (qiita.com/umezu_y):

```
Phase 0: MCP接続確認
Phase 1: ゲームデザインドキュメント生成
Phase 2: 機能仕様書生成
Phase 3: 技術仕様書生成
Phase 4: テスト仕様書生成
Phase 5: タスクリスト生成
Phase 6: 実装 (1タスク1コミット)
Phase 7: L1/L2/L3 検証
Phase 8: WebGLビルド → GitHub Pages デプロイ
```

**成果**: 仕様書→ゲーム公開までのすべてがClaude Codeで自動化。音声生成もC#スクリプト内蔵。

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | MVP後半 | フェーズ1 (土台) では敵は固定配置で十分。AIは詠唱評価の後に実装 |
| **MVP必須度** | 中 | MVP定義に「敵1体」が含まれる。パトロールAI程度 (waypoint FSM) で十分 |
| **AI実装適性** | 高 (FSM) | FSMパターンはAIが得意。VContainerでDI設計すればテストも容易 |
| **人間が実装すべき箇所** | 敵の強さバランス、waypoint配置、spell_powerに連動したダメージ設計 |

**AI Grimoire 敵AI最小実装** (MVP向け):
```
EnemyStateMachine: Patrol (waypoint 2点) → Dead (HP0)
攻撃はAI Grimoire側からではなく、SpellCasterから spell_power に基づいてダメージを受ける
プレイヤーへの攻撃は一定間隔で自動 (固定ダメージ) で十分
```
ML-AgentsやNetcodeはMVPスコープ外。

---

## 出典

- (Source: github.com/Inspiaaa/UnityHFSM)
- (Source: qiita.com/umezu_y/items/090a0fd25f9f915ad375)
- (Source: unity.com/how-to/scriptableobjects-event-channels-game-code)
- (Source: unity-technologies.github.io/ml-agents/)
- (Source: docs.unity.com/ugs/en-us/manual/mps-sdk/manual/build-your-first-session)
- (Source: peerdh.com/blogs/programming-insights/implementing-state-machine-patterns-for-enemy-ai-in-unity-2d)
