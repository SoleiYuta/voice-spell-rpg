---
type: concept
title: "AGENTS.mdとCodex Skills設計"
updated: 2026-05-09
tags:
  - codex
  - agents-md
  - codex-skills
  - configuration
  - game-development
status: developing
related:
  - "[[Unity プロジェクトのCLAUDE.md設計]]"
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
  - "[[Codex Plugin for Claude Code]]"
---

# AGENTS.mdとCodex Skills設計

Codex CLIにおけるCLAUDE.md相当のコンテキストファイル (AGENTS.md) と、再利用可能なワークフロー (Skills) の設計パターン。

---

## AGENTS.md: Codexの永続コンテキスト

### 概要

AGENTS.mdはCodexがタスク実行前に読み込む設定ファイル。CLAUDE.mdのCodex版に相当。60,000以上のOSSプロジェクトが採用する事実上の標準形式。(high: agents.md)

Codex, OpenCode, Gemini CLI, Jules, Factory AIが対応。Claude CodeのCLAUDE.mdとは兄弟関係にある仕様。

### 発見階層 (3段階)

```
~/.codex/AGENTS.md                  # グローバル (全プロジェクト共通)
~/.codex/AGENTS.override.md         # グローバル上書き
{git-root}/AGENTS.md                # プロジェクトルート
{subdir}/AGENTS.md                  # サブディレクトリ (より近いものが優先)
```
Gitルートから現在のディレクトリに向かって探索し、複数ファイルを連結。近いディレクトリのガイダンスが優先される。

### 基本フォーマット

```markdown
# AGENTS.md

## Repository expectations
- Run `dotnet build` before opening a pull request.
- 命名規則: PascalCaseクラス名、camelCaseフィールド

## Working agreements
- Unity 2022.3 LTSをターゲットにする
- Rigidbody2Dを使用 (CharacterControllerは使わない)
- [SerializeField] private フィールドを優先

## Unity 2D Rules
- Physics 2Dのみ使用。Physics 3Dのコードは生成しない
- Input System (Package) を使用。旧Input.GetAxis()は禁止
- TilemapCollider2D + CompositeCollider2Dの組み合わせ推奨
```

### CLAUDE.mdとの比較

| 項目 | AGENTS.md | CLAUDE.md |
|------|-----------|-----------|
| 対象 | Codex (+ OpenCode, Gemini CLI等) | Claude Code |
| 場所 | `{project}/AGENTS.md` または `~/.codex/` | `{project}/CLAUDE.md` または `.claude/` |
| 優先度 | 近いディレクトリが優先 | 同様の階層構造 |
| 標準化 | agents.md オープン標準 | Anthropic独自 |
| 形式 | Markdownセクション (自由) | Markdownセクション (自由) |

---

## Codex Skills: 再利用可能ワークフロー

### 概要

Skillsは特定ワークフローをパッケージ化してCodexに教える仕組み。Claude Codeの `/wiki` `/autoresearch` 等のスキルに相当。

**プログレッシブディスクロージャー**: Codexは最初にスキル名・説明・パスのみをロード (コンテキスト窓の約2%=8,000文字上限)。タスクに合致したスキルのSKILL.mdを取得して詳細な指示を読む。

### スキルのディレクトリ構造

```
.agents/skills/
  unity-2d-controller/
    SKILL.md          # 必須: name, description, 指示
    scripts/          # 任意: 実行可能スクリプト
    references/       # 任意: ドキュメント
    assets/           # 任意: テンプレート
    agents/
      openai.yaml     # 任意: UI メタデータ
```

### SKILL.mdフォーマット

```markdown
---
name: unity-2d-controller
description: Generates a complete Unity 2D PlayerController with Rigidbody2D movement, jump, and ground detection
---

# Unity 2D Player Controller Generator

## Instructions
1. Ask for Unity version and target platform
2. Generate PlayerController.cs with:
   - Rigidbody2D velocity-based movement
   - Ground detection via Raycast (not GroundCheck object)
   - [SerializeField] for all tunable parameters
   - New Input System (InputAction)
3. Generate corresponding InputActions asset
4. Add unit tests using Unity Test Framework
```

### スキルの呼び出し方法

**明示的:**
```
/skills  または  $unity-2d-controller
```

**暗示的:** タスク説明に合致すると自動選択。

### Unity 2D向けスキル例

```
.agents/skills/
  unity-2d-setup/      # 新規2Dプロジェクト初期設定
  unity-2d-player/     # プレイヤーコントローラー生成
  unity-2d-tilemap/    # タイルマップシステム生成
  unity-2d-enemy-ai/   # 敵AIパトロール生成
  unity-mcp-check/     # MCP接続確認と動作テスト
```

---

## Codex Plugins: Skillsの配布単位

複数のSkillsと設定をまとめた配布パッケージ。
- ローカル用途: `.agents/skills/` に配置
- 配布用途: Pluginとしてパッケージ化

**インストール例:**
```bash
/plugin marketplace add openai/codex-plugin-cc  # Claude Code内でCodexを使う公式プラグイン
/plugin install codex@openai-codex
```

---

## 実践的なUnity 2D向けAGENTS.md例

```markdown
# AGENTS.md - Unity 2D Platform Game

## Project
- Engine: Unity 2022.3.50f1
- Pipeline: URP 14.x
- Input: Unity Input System v1.7+
- Physics: 2D only (Rigidbody2D, Collider2D)

## Code Rules
- [SerializeField] private を優先 (public フィールド禁止)
- MonoBehaviour は Start/Awake のみで初期化
- フレームレート非依存: Time.deltaTime を必ず使う
- Raycast で地面検出 (GroundCheck オブジェクト不要)

## Do NOT
- Physics 3D APIを使わない
- Input.GetAxis() を使わない (旧APIは廃止)
- GameObject.Find() をUpdate()内で使わない
- OnCollisionEnter2Dと OnTriggerEnter2Dを混同しない

## Before PR
- Run `dotnet build` and confirm 0 errors
- Run Unity Test Framework and confirm all tests pass
```

---

## 出典

- (Source: developers.openai.com/codex/guides/agents-md)
- (Source: developers.openai.com/codex/skills)
- (Source: agents.md - オープン標準サイト)
- (Source: sgryphon.gamertheory.net/2025/07/agents-md-standardisation)
