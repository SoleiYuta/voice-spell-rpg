---
type: concept
title: "Claude Codeマルチエージェント並列Unity開発"
updated: 2026-05-10
tags:
  - claude-code
  - multi-agent
  - parallel
  - unity
  - git-worktree
  - studio-hierarchy
status: developing
related:
  - "[[Claude Code Game Studios設計]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
  - "[[VContainer・UniTask・R3とAI連携パターン]]"
---

# Claude Codeマルチエージェント並列Unity開発

Claude Code の並列インスタンスをgit worktreeで分離して複数エージェントを同時実行するパターン。2-5エージェントが最適。

---

## 並列インスタンスの基本原則

**鉄則**: 各エージェントのファイル範囲がゼロオーバーラップであること。

```bash
# git worktreeで各エージェントを分離
git worktree add ../unity-feature-movement feature/movement
git worktree add ../unity-feature-enemy feature/enemy
git worktree add ../unity-feature-ui feature/ui

# 各worktreeで別のClaude Codeセッションを起動
cd ../unity-feature-movement && claude
cd ../unity-feature-enemy && claude
cd ../unity-feature-ui && claude
```

**tmux で並列管理**:
```bash
tmux new-session -s movement "cd ../unity-feature-movement && claude"
tmux new-session -s enemy "cd ../unity-feature-enemy && claude"
tmux new-session -s ui "cd ../unity-feature-ui && claude"
```

---

## game-dev-supercharger (マルチエージェントUnityプラグイン)

`nategarelik/game-dev-supercharger` — 2D/3DのUnity開発向けのマルチエージェント専門パネルを提供するClaude Codeプラグイン。(medium: github.com/nategarelik/game-dev-supercharger)

### 専門エージェントパネル

```
Claude Codeセッション内でパネルを起動:
/gamedev-panel

エージェント:
- GameDesignExpert: メカニクス・バランス設計
- UnityArchitect: システム設計・パターン選定
- PerformanceEngineer: 最適化・プロファイリング
- VisualDirector: アート方向性・VFX設計

利用方法:
「@UnityArchitect このシステム設計をレビューして」
「@PerformanceEngineer このコードのボトルネックを分析して」
```

---

## Unityゲーム開発向けAIワークフロー (devdavv)

`devdavv/unity-ai-workflow` — Unity 6.2+向けのClaude Code + Antigravityのワークフロー集。rules, agents, skills, slash commandsを統合。(medium: github.com/devdavv/unity-ai-workflow)

### 特徴

- **Claude Code + Antigravity の共存**: プロジェクト内でAIエージェントを切り替え可能
- **Unity 6.2+ 最適化**: 新しいレンダリングパイプラインとAI Gatewayを前提
- **Rules-based**: エージェントの行動ルールをMarkdownで定義

---

## UnityAgentClient (汎用エージェントブリッジ)

`nuskey8/UnityAgentClient` — Agent Client Protocolを使ってGemini CLI、Claude Code、Codex CLIなど任意のAIエージェントをUnity Editorと統合。(medium: github.com/nuskey8/UnityAgentClient)

```bash
# インストール
upm add github:nuskey8/UnityAgentClient

# Claude Codeとの連携
unity-agent connect claude --port 7890
```

**特徴**: mcp-unityやunity-cli-loopに依存しない独自プロトコル。複数AIの同時接続に対応。

---

## 並列開発の最適分割パターン

Unityプロジェクトをエージェントに分割する際のガイドライン。

### 推奨分割 (3エージェント)

```
エージェントA: ゲームロジック (Scripts/GameLogic/, Scripts/Enemy/)
エージェントB: UI/UX (Scripts/UI/, Assets/UI/)
エージェントC: アーキテクチャ (Scripts/Core/, Tests/)
```

### ファイル重複を防ぐCLAUDE.md設定

```markdown
## このセッションのスコープ
このClaude Codeセッションはゲームロジック担当です。
変更可能: Scripts/GameLogic/**, Scripts/Enemy/**, Tests/GameLogic/**
変更禁止: Scripts/UI/**, Scripts/Core/**, Packages/**

他エージェントのファイルに触れる必要がある場合は作業を止めて報告してください。
```

---

## Claude Code 採用率 (2026年現在)

X (SemiAnalysis) のレポートより:
- GitHubパブリックコミットの**4%**がClaude Codeによる
- 2026年末までに**20%以上**に達する見込み
- ゲームスタジオの95%がAIをコアワークフローに採用 (Unity 2026 Report)

**含意**: Claude Codeはもはやニッチツールではなく業界標準に近づいている。CLAUDE.md設計スキルがチーム全体の生産性を左右する。

---

## Shipyard (マルチエージェントオーケストレーション)

Shipyard.build — Claude Code向けのマルチエージェントオーケストレーターサービス。複数インスタンスの調整をサービスとして提供。(low: shipyard.build/blog/claude-code-multi-agent)

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | 将来的に活用 | ハッカソンは単一セッションで充分。並列化は複数人チームが前提 |
| **MVP必須度** | 低 | MVP期間中は1エージェント1タスクに集中。ファイル競合リスクを避ける |
| **AI実装適性** | 高 | git worktreeによる分離はAI向きのパターン。将来のチーム開発で参考になる |
| **人間が実装すべき箇所** | エージェントへのスコープ割当て、CLAUDE.mdのセッション別スコープ設定 |

**AI Grimoire のチーム分担例** (将来):
```
エージェントA: Unity側 (SpellCaster, UI, Mock連携)
エージェントB: Cloud Run API (FastAPI, Gemini呼び出し)
エージェントC: 音声処理 (STT, librosa pipeline)
```
各エージェントが独立したworktreeで作業し、インターフェース (`ISpellApiClient`) でのみ接合。

---

## 出典

- (Source: github.com/nategarelik/game-dev-supercharger)
- (Source: github.com/devdavv/unity-ai-workflow)
- (Source: github.com/nuskey8/UnityAgentClient)
- (Source: x.com/SemiAnalysis_/status/2027443723362042308)
- (Source: shipyard.build/blog/claude-code-multi-agent)
- (Source: mindstudio.ai/blog/claude-code-agent-teams-parallel-workflows)
- (Source: aiqnahub.com/claude-code-parallel-instances-workflow/)
