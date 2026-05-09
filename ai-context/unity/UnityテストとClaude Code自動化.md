---
type: concept
title: "UnityテストとClaude Code自動化"
updated: 2026-05-10
tags:
  - unity
  - testing
  - claude-code
  - e2e
  - playmode
  - editmode
  - uloop
status: developing
related:
  - "[[uLoopMCPとAI駆動Unityループ]]"
  - "[[Unity MCP統合]]"
  - "[[Unityゲームリリースパイプラインとビルド自動化]]"
---

# UnityテストとClaude Code自動化

Claude Code × Unity CLI Loop によるテスト自動化。EditMode/PlayMode テストの完全自動実行、E2Eテストのスクリプト化を実現。

---

## unity-test-runner スキル (Dev-GOM)

Claude Code Marketplaceで公開されているスキル。`uloop run-tests` CLI経由でUnity Test Runnerを操作する。

### インストール

```bash
/plugin marketplace add dev-gom/claude-code-marketplace unity-test-runner
```

### 主要コマンド

```bash
# EditModeテスト全実行
uloop run-tests

# PlayModeテスト実行
uloop run-tests --test-mode PlayMode

# 特定のテストのみ実行
uloop run-tests --filter-type exact --filter-value "MyTest.TestMethod"

# 正規表現でフィルタ
uloop run-tests --filter-type regex --filter-value "Enemy.*AI.*"
```

**結果**: `.uloop/outputs/TestResults/<timestamp>.xml` にNUnit XML形式で保存。Claude Codeがエラーメッセージとスタックトレースを解析して修正提案を出す。

---

## Claude Code × Unity CLI Loop でE2Eテスト自動化

zenn.dev/unsoluble_sugar の実践例。チュートリアルフローのE2Eテストを完全自動化。(high: zenn.dev/unsoluble_sugar/articles/2a1f9e08ac9980)

### アーキテクチャ

```
Claude Code
  ↓ (シェルスクリプト実行)
Unity CLI Loop
  ↓ (PlayMode起動)
Unity Editor
  ↓ (E2Eテストシーン実行)
テスト結果XML
  ↓ (Claude Codeが解析)
失敗箇所の自動修正
```

### 鉄則: AIの推論に頼らない設計

> 「テストロジックはシェルスクリプトとC#にカプセル化し、AI推論に依存しない。高再現性のテストのみ自動化する」

AIがテストの判断をするのではなく、決定論的なC#テストコードをAIが生成し、実行は機械的に行う。

### 実装パターン

```csharp
// AIが生成するテストコード例 (EditMode)
[TestFixture]
public class EnemyAITests
{
    [Test]
    public void Enemy_TransitionsToChase_WhenPlayerInRange()
    {
        // Arrange
        var enemy = new GameObject().AddComponent<EnemyStateMachine>();
        var player = new GameObject();
        enemy.detectionRange = 5f;
        player.transform.position = new Vector3(3f, 0, 0);
        
        // Act
        enemy.UpdateState();
        
        // Assert
        Assert.AreEqual(EnemyState.Chase, enemy.currentState);
    }
}
```

---

## Claude Code Action でチーム開発自動化

`Claude Code Action` (GitHub Actions統合) を使ってPRごとにテストを自動実行した事例。(high: qiita.com/yheihei/items/20bfa0427284e9fe90d8)

### GitHub Actions設定例

```yaml
name: Unity Test
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: game-ci/unity-test-runner@v4
        with:
          unityVersion: 2022.3.21f1
          testMode: EditMode
          artifactsPath: test-results
      - name: Claude Code Review
        uses: anthropics/claude-code-action@v1
        with:
          claude_api_key: ${{ secrets.CLAUDE_API_KEY }}
          prompt: |
            テスト結果を分析して失敗したテストの原因と修正案を提示して
            テスト結果: ${{ steps.test.outputs.coveragePath }}
```

---

## Custom slash commandでテスト自動化

Claude Code の Custom slash command を使ってプロジェクト固有のテストワークフローを定義。(medium: zenn.dev/sc30gsw/articles/96a07baca27b5a)

### `.claude/commands/run-tests.md` 例

```markdown
# Unity Test Runner

Run Unity tests for the current project:

1. Detect Unity version from ProjectSettings/ProjectVersion.txt
2. Run EditMode tests: `uloop run-tests --test-mode EditMode`
3. Run PlayMode tests: `uloop run-tests --test-mode PlayMode`
4. Parse .uloop/outputs/TestResults/*.xml
5. Report failures with file:line references
6. For each failure, suggest a fix based on the test code

If tests pass, output: "✅ All tests passed"
If tests fail, output failing test names and suggested fixes
```

### 使用方法

```
/run-tests
```

---

## テスト戦略: AIが得意な領域と不得意な領域

| テスト種別 | AI適性 | 理由 |
|-----------|--------|------|
| Unit Test (Pure C#) | 高 | 入力/出力が明確 |
| EditMode Test | 高 | MonoBehaviourなしでテスト可 |
| PlayMode Test | 中 | 時間依存・非同期処理が複雑 |
| E2E / UI Test | 低 | ピクセル比較・タイミング依存 |
| パフォーマンステスト | 低 | ハードウェア依存 |

**推奨**: AIにはUnit Test / EditMode Testを主に生成させ、E2Eは人間が仕様を書いてAIがコードに変換する。

---

## DungeonInn (商用ゲーム事例)

シミュレーションゲーム「DungeonInn」の開発でClaude Code + Codexを使ってテスト・検証を自動化。(high: qiita.com/archeleeds/items/6fbf02174f308e31f284)

- Claude Code: ゲーム設計、実装、テスト生成
- Codex: コードレビュー、リファクタリング
- 役割分担で商用レベルのコード品質を達成

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | MVP後半 | フェーズ1（Unity土台）でUnit Testのみ導入、E2Eはデモ品質確認に使う |
| **MVP必須度** | 低〜中 | MockSpellApiClientでの動作確認が優先。テスト自動化はその後 |
| **AI実装適性** | 高 (EditMode) | `SpellCaster`のロジックテストはAIに生成させやすい。音声フローのE2Eは人間が書く |
| **人間が実装すべき箇所** | PlayModeテスト（非同期音声フロー）、UniTask + Awaiterの扱い、マイク入力モック設計 |

**AI Grimoire向けテスト優先順位**:
1. `SpellCaster.CastAsync()` のEditMode Unit Test (mock注入)
2. `EvaluationResult` のJSONデシリアライズテスト
3. `spell_power`計算ロジックのテスト (純粋関数化して単独テスト)
4. PlayModeでの音声→評価→UI更新フロー確認 (手動)

---

## 出典

- (Source: zenn.dev/unsoluble_sugar/articles/2a1f9e08ac9980)
- (Source: mcpmarket.com/tools/skills/unity-test-runner-2)
- (Source: qiita.com/yheihei/items/20bfa0427284e9fe90d8)
- (Source: zenn.dev/sc30gsw/articles/96a07baca27b5a)
- (Source: qiita.com/archeleeds/items/6fbf02174f308e31f284)
- (Source: github.com/hatayama/unity-cli-loop)
