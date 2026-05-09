---
type: concept
title: "Unity AIデバッグ支援とログ分析"
updated: 2026-05-10
tags:
  - unity
  - debugging
  - claude-code
  - uloop
  - console-log
  - mcp
status: developing
related:
  - "[[uLoopMCPとAI駆動Unityループ]]"
  - "[[UnityテストとClaude Code自動化]]"
  - "[[Claude Code Unity MCP接続安定化ガイド]]"
---

# Unity AIデバッグ支援とログ分析

Claude Code × Unity CLI LoopによるAI自動デバッグ。`uloop-get-logs` でコンソールログを取得し、AI がエラーを特定して自動修正するループを実現。

---

## uloop-get-logs スキル

uLoopMCPの `uloop get-logs` コマンドでUnity Editorのコンソールログをリアルタイム取得。Claude Codeがエラーを分析して修正コードを提案する。(high: zenn.dev/unsoluble_sugar/articles/cd8d59be7b8f85)

```bash
# Claude Code Skill経由での使用
uloop get-logs                        # 全ログ取得
uloop get-logs --type Error           # エラーのみ
uloop get-logs --type Warning         # 警告のみ
uloop get-logs --last 50             # 最新50件
```

### 自動修正ループの実現

```
1. uloop compile → コンパイルエラー取得
2. Claude Code がエラーを分析
3. 修正コードを生成してファイルを更新
4. uloop compile → 再コンパイル
5. エラーがなくなるまでループ
```

**実績**: テスト駆動的ワークフローがプロンプトだけで回り、失敗テストはAIが自動修正。スクリーンショット機能やログ収集の独自実装が不要。

---

## Unity Script Debugger スキル (mcpmarket.com)

NullReferenceException、コンポーネント依存関係の欠落、スクリプト実行順序の競合、シリアライゼーションエラーを自動特定する専用スキル。(medium: mcpmarket.com/tools/skills/unity-script-debugger)

### 自動診断できるエラー種別

| エラー種別 | 診断精度 |
|-----------|---------|
| NullReferenceException | 高 (スタックトレースから根本原因を特定) |
| Missing Component | 高 (GetComponent先のType名から推測) |
| Script Execution Order | 中 (Awake/Start/OnEnable の順序依存) |
| Serialization Error | 中 (Inspectorでの型不一致) |
| Physics Layer Conflict | 低 (設定ファイル読み取りが必要) |

---

## エラー分析プロンプトパターン

Claude Codeにエラーを貼り付けて修正させる際の効果的なプロンプト構造。

### NullReferenceException の場合

```
「以下のNullReferenceExceptionを修正してください:

エラー:
NullReferenceException: Object reference not set to an instance of an object
EnemyAI.Update () (at Assets/Scripts/EnemyAI.cs:47)

コード (EnemyAI.cs:40-55):
[コードを貼り付け]

制約:
- VContainer でDI済みのため[SerializeField]は使わない
- Awake/Start の順序に依存しない設計にする
- nullチェックを追加するのではなく根本原因を直す」
```

### コンパイルエラーの一括修正

```
「以下のコンパイルエラーをすべて修正してください (上から順に処理):

[コンパイルエラーリストを貼り付け]

環境: Unity 2022.3 LTS, C# 9.0
注意: エラー修正が他のファイルに影響する場合はそのファイルも更新してください」
```

---

## Unity Logging パッケージ (公式)

`com.unity.logging` (Unity Logging) はDebug.Logの後継となる公式ログパッケージ。Claude Codeで使う際はCLAUDE.mdへの記載が必要。(medium: docs.unity3d.com/Packages/com.unity.logging)

```markdown
## ロギング規約 (CLAUDE.md)
- Debug.Log は使わない (com.unity.logging を使用)
- Unity.Logging.Log.Info / Log.Warning / Log.Error を使う
- 構造化ログ: Log.Info("EnemySpawned {EnemyType} at {Position}", type, pos)
- バースト対応: [BurstCompile]内でもLogging使用可
```

---

## AIデバッグの限界と補完

| シナリオ | AIデバッグ | 人間による確認 |
|---------|-----------|------------|
| コンパイルエラー | 自動修正可 | — |
| NullReferenceException | 高精度特定 | — |
| パフォーマンス問題 | Profilerデータ必要 | Profiler操作は人間 |
| 物理挙動バグ | シミュレーション不可 | Editor上で目視確認 |
| レンダリングバグ | スクリーンショット必要 | uloop-capture-windowと組み合わせ |

**uloop-capture-window との組み合わせ**: スクリーンショットを取得してClaude Codeに渡すことでレンダリングバグも診断可能 (uLoopMCPのvision機能)。

---

## Claude Code Settings for Unity (OSS)

`nowsprinting/claude-code-settings-for-unity` — Unityプロジェクト向けClaude Code設定集。CLAUDE.md, custom commands, hooksのテンプレートを提供。(medium: github.com/nowsprinting/claude-code-settings-for-unity)

```bash
# クローンして設定をコピー
git clone https://github.com/nowsprinting/claude-code-settings-for-unity
cp -r claude-code-settings-for-unity/.claude ./MyUnityProject/
```

---

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | 高 | 音声→API→結果のフローでエラー箇所の特定に必須 |
| **MVP必須度** | **必須** | タイムアウト・WAVサイズ・APIレスポンスのログがないとデバッグ不能 |
| **AI実装適性** | 高 | ログ形式をCLAUDE.mdに書けばAIが自動でDebug.Logを挿入する |
| **人間が実装すべき箇所** | ログのタグ設計 (`[SpellCaster]`等)、重要ログの定義 |

**AI Grimoire向けデバッグ優先順位**:
1. `[VoiceRecorder]` — 録音できているか、WAVサイズは妥当か
2. `[SpellApiClient]` — APIへの接続、レイテンシ、ステータスコード
3. `[SpellResult]` — 評価値が期待範囲内か
4. `[SpellEffectApplier]` — エフェクト値の変換が正しいか

---

## 出典

- (Source: zenn.dev/unsoluble_sugar/articles/cd8d59be7b8f85)
- (Source: mcpmarket.com/tools/skills/unity-script-debugger)
- (Source: mcpmarket.com/tools/skills/unity-console-log-viewer)
- (Source: github.com/nowsprinting/claude-code-settings-for-unity)
- (Source: docs.unity3d.com/Packages/com.unity.logging@latest)
- (Source: github.com/CoplayDev/unity-mcp/wiki/2.-Fix-Unity-MCP-and-Claude-Code)
