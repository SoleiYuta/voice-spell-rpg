---
type: concept
title: "Unity プロジェクトのCLAUDE.md設計"
updated: 2026-05-09
tags:
  - unity
  - claude-code
  - claude-md
  - game-development
  - context
status: developing
related:
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
---

# Unity プロジェクトのCLAUDE.md設計

CLAUDE.mdはClaude Codeがセッション開始時に自動読み込みするプロジェクトコンテキストファイル。「毎回プロジェクトを知らない天才開発者」を「プロジェクトの慣習と癖を知るチームメンバー」に変える。

---

## なぜCLAUDE.mdが重要か

Claude Codeはセッションをまたぐ記憶を持たない。CLAUDE.mdがない場合、AIはコードからのみコンテキストを推測するが、Unityプロジェクトは「コードから推測できない暗黙の慣習」が多い。

- Unity バージョン (API差異が大きい: 2022 LTS vs 2024)
- レンダリングパイプライン (URP/HDRP/Built-in)
- 入力システム (旧Input Manager vs 新Input System)
- 2Dか3Dかのプロジェクト種別

## CLAUDE.mdの推奨構造 (6セクション)

```markdown
# [プロジェクト名] — Claude Code コンテキスト

## 1. Project Overview
ジャンル: 2Dプラットフォーマー
エンジン: Unity 2022.3 LTS
ターゲットプラットフォーム: PC / Android
概要: [1段落のサマリー]

## 2. Tech Stack
- Unity: 2022.3.50f1
- スクリプティングバックエンド: IL2CPP (Androidビルド)
- レンダリングパイプライン: URP 14.x
- 入力システム: Unity Input System (Package) v1.7+
- 物理: Physics 2D (Rigidbody2D, Collider2D)

## 3. Architecture
- フォルダ構造: Assets/Scripts/{Player, Enemy, UI, Systems}/
- パターン: GameManager シングルトン + ScriptableObject データ
- 2Dカメラ: Cinemachine Virtual Camera
- タイルマップ: Tilemap + TilemapCollider2D

## 4. Conventions
- 命名: PascalCase クラス名、camelCase フィールド
- MonoBehaviour: Start/Awake でのみ初期化
- SerializeField: [SerializeField] private を優先 (public フィールド禁止)
- コルーチン: 長い処理に使用。async/await は UI のみ

## 5. Game Design Context
- プレイヤーはWASD/矢印キーで移動、Spaceでジャンプ
- ダブルジャンプあり、壁ジャンプなし
- 敵はパトロールAI (waypoint ベース)

## 6. Common Tasks
プレイヤー移動スクリプトを変更する場合: Assets/Scripts/Player/PlayerMovement.cs
新しい敵を追加する場合: EnemyBase.cs を継承しwaypoints を設定
```

## 必須記載事項 (Unityに特有)

Claudeがこれを知らないと古いAPIや間違ったパイプラインのコードを生成する:

1. **Unity バージョン** — `using UnityEngine.InputSystem`は旧システムと衝突する
2. **レンダリングパイプライン** — URPとBuilt-inでシェーダー構文が異なる
3. **入力システム** — `Input.GetAxis()`(旧) vs `InputAction`(新)
4. **スクリプティングバックエンド** — IL2CPP制約があるAPIがある

## 拡張パターン

**モジュール別コンテキスト (大規模プロジェクト):**
```
.claude/
  contexts/
    combat-system.md
    dialogue-system.md
    ui-framework.md
```

**アンチパターンセクション (特に重要):**
```markdown
## Do NOT
- Physics.IgnoreLayerCollision を Start() で毎フレーム呼ばない
- GameObject.Find() をUpdate()内で使わない
- OnCollisionEnter2D と OnTriggerEnter2D を混同しない
```

## 自動生成ツール

**Unity Project Context Initializer** (mcpmarket.com): Unityプロジェクト設定・アセット・コード規約をスキャンしてCLAUDE.mdを自動生成するClaudeスキル。 (medium: 単一ソース)

## 初期ファイルサイズの目安

- 最初は約50行で十分 (high: mrphilgames.com)
- AIのミスに基づいてアーキテクチャと規約セクションを拡張する
- 実際のコード例を含めると曖昧な規約の解釈ずれが減る

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | プロジェクト最初に必要 | これがないと全セッションで同じ間違いを繰り返す |
| **MVP必須度** | **最優先** | 録音仕様・UniTask必須・API URLをここに書く |
| **AI実装適性** | 高 (人間が書く) | Claude Codeに書かせるものではなく、人間が設計してAIに渡すもの |
| **人間が実装すべき箇所** | 全て。特に「禁止事項」と「SpellResult変換規則」 |

→ [[AI Grimoire MVP実装ガイド]] にAI Grimoire用テンプレートあり。

**関連するAI Grimoireノート:**
- [[AI-Grimoire/06_MVP開発計画]] — MVP実装フェーズ計画
- [[AI-Grimoire/05_技術構成]] — Unity + Cloud Run 構成
- [[AI-Grimoire/tech/API設計]] — UnityWebRequestの実装設計

---

## 出典

- (Source: mrphilgames.com/blog/claude-md-for-game-devs)
- (Source: claudelab.net/en/articles/claude-code/claude-code-unity-game-development-guide)
- (Source: mcpmarket.com/tools/skills/unity-project-context-initializer)
