---
type: concept
title: "Unity 2D AIコード生成パターン"
updated: 2026-05-09
tags:
  - unity
  - 2d
  - code-generation
  - claude-code
  - codex
  - patterns
status: developing
related:
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
  - "[[Unity プロジェクトのCLAUDE.md設計]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
---

# Unity 2D AIコード生成パターン

Claude CodeとCodex CLIでUnity 2D固有のシステムを生成するための実践パターン集。

---

## プロンプト設計の基本原則

1. **Unityコンテキストを明示**: バージョン、パイプライン、使用パッケージを必ず伝える
2. **制約を先に書く**: `Rigidbody2D使用、Physics 2Dのみ、旧Input Systemは使わない`
3. **期待する動作を具体的に**: `ジャンプ力は設定可能でInspectorに露出すること`
4. **アーキテクチャパターンを指定**: `MonoBehaviourを継承、SerializeFieldを使う`

---

## 2D固有システム別パターン

### プレイヤー移動コントローラー

```
プロンプト例:
「Unity 2022.3 LTS、URP、Unity Input Systemを使用。
PlayerMovement.csを作成してください:
- WASDと矢印キーの両方に対応
- フレームレート非依存の速度計算 (Time.deltaTimeを使用)
- ジャンプはSpace、ジャンプ力は[SerializeField]で設定可能
- 地面検出はRaycast (LayerMaskで設定可能)
- アニメーション状態遷移: Idle/Run/Jump/Fall
- Rigidbody2D.velocityで移動 (AddForceは使わない)」
```

Claudeはこれに対しGameObject階層、Componentパターン、Transformの数学、Physics計算、コルーチン、asyncワークフローを理解した上でコードを生成する。(high: claudelab.net)

### 地面検出 (ダブルジャンプ対応)

**推奨**: Raycastベース (GroundCheckオブジェクトより信頼性が高い)

```csharp
// Claudeへの指示例:
// 「GroundCheck用のRaycastを実装。
// 地面レイヤーはLayerMaskで設定。
// ダブルジャンプのカウントもここで管理」
```

> [!gap] ダブルジャンプのタイミング問題はClaude生成コードで報告されている。地面判定ロジックに微妙なバグが入りやすい。必ずPlayMode検証を行うこと。

### タイルマップシステム

Unityの`Tilemap`コンポーネントとの統合コードはAIが得意な領域:

```
プロンプト例:
「TilemapCollider2D + CompositeCollider2DでTilemapを設定。
ランダムなタイル配置のためのMapGeneratorを作成。
Perlinノイズで地形を生成し、Rules Tileを使用」
```

注意: Rules TileはUnity 2D Extras パッケージが必要。CLAUDE.mdに記載しておくこと。

### 2D物理 (Rigidbody2D)

MCP Unityのmanage_physicsツールは2D物理設定をAPI経由で変更できる:
- 9種類の2Dジョイント (HingeJoint2D, SpringJoint2D等)
- Physics 2D Layerの衝突マトリクス設定

注意: 衝突レイヤー設定はAIが自動設定できない。手動でEditorから設定が必要。(high: arsturn.com)

### スプライトアニメーション

```
プロンプト例:
「Animator + AnimatorControllerをコードから設定するEditorスクリプトを作成。
spriteSheetから自動でアニメーションクリップを生成し、
Idle→Run→Jump→Fallの遷移を設定する」
```

### ScriptableObjectによるデータ管理

```
プロンプト例:
「敵キャラクターのデータをScriptableObjectで管理するシステムを作成。
EnemyDataSO: 名前、HP、速度、攻撃力、ドロップアイテムリスト。
EnemyBase.csはEnemyDataSOを参照して初期化する」
```

---

## バグ修正のプロンプトパターン

```
「以下のコードでダブルジャンプのバグがあります:
[コードを貼り付け]
症状: 地面に接触直後にジャンプするとダブルジャンプカウントがリセットされない。
根本原因を特定し、OnCollisionEnter2Dのタイミング問題を修正してください」
```

実際の事例: 118プロンプトで完全なクロスプラットフォームゲームを完成させた報告あり。(medium: medium.com thuy le)

---

## AIコード生成の限界 (2D固有)

| 課題 | 理由 | 対処法 |
|------|------|--------|
| パスファインディング | NavMesh非対応 (3D前提)。A*実装は複雑 | A* Pathfinding Projectを別途使用 |
| 衝突レイヤー設定 | Editorの物理設定はコードから変更不可 | 手動設定後にCLAUDE.mdに記録 |
| モバイル最適化 | プラットフォーム固有の最適化は経験則が必要 | IL2CPP、オブジェクトプールの指示を明示 |
| 複雑なシェーダー | URP Shader GraphはAPIが複雑 | ShaderGraphは手動、コード側の連携のみAI化 |

---

## エディタツール生成

```
プロンプト例:
「ScriptableObject設定を管理するカスタムEditorWindowを作成。
検索機能とプレビュー機能付き。
UnityEditor名前空間を使用し、OnGUI()で実装」
```

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | 即戦力 | 音声入力フロー・SpellCaster・UI更新の全てにこのパターンを使う |
| **MVP必須度** | **最優先** | コード生成プロンプトの書き方がMVP速度を直接左右する |
| **AI実装適性** | 高 | 制約とアーキテクチャを明示すれば高品質なC#コードを生成 |
| **人間が実装すべき箇所** | 音声録音 (`Microphone`クラス)、WAV変換バイト列操作、EvaluationResultのsnake_case→C#マッピング確認 |

**AI Grimoire向け重要プロンプト制約**:
```
「Unity 2022.3 LTS、URP、VContainer + UniTask必須。
UnityWebRequestは使わない（UniTask対応の独自実装を使う）。
[Serializable]フィールドはAPIのsnake_caseに合わせること。
async/await + UniTaskのみ使用、Coroutine混在禁止。」
```

---

## 出典

- (Source: claudelab.net/en/articles/claude-code/claude-code-unity-game-development-guide)
- (Source: arsturn.com/blog/how-to-use-claude-with-unity-for-faster-game-development)
- (Source: medium.com/artcenter-graduate-interaction-design/i-used-ai-to-code-a-game-in-unity)
