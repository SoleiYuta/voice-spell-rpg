---
type: concept
title: "VContainer・UniTask・R3とAI連携パターン"
updated: 2026-05-09
tags:
  - unity
  - vcontainer
  - unitask
  - r3
  - framework
  - claude-code
  - commercial
status: developing
related:
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
  - "[[Unity プロジェクトのCLAUDE.md設計]]"
  - "[[日本語コミュニティUnity AI開発事例]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
---

# VContainer・UniTask・R3とAI連携パターン

商用Unityゲーム開発でよく使われるサードパーティフレームワークとClaude Code/Codexの連携パターン。フレームワーク参照文書の整備がAI品質の鍵。

---

## なぜフレームワーク文書が必要か

Claude CodeやCodexはUnity標準APIは学習データが豊富だが、VContainer・UniTask・R3は学習データが少ない。フレームワーク固有の能力・制約をAGENTS.md/CLAUDE.mdに記載しないと、AIが標準パターンに退行してしまう。

商用ゲーム開発事例 (DungeonInn/Steam) では「VContainer、UniTask、R3の能力についての包括的な参照文書整備」が成功の重要条件として挙げられている。(high: qiita.com/archeleeds)

---

## VContainer (依存性注入)

**リポジトリ**: https://github.com/hadashiA/VContainer  
**特徴**: Zenjectの5-10倍高速、GCアロケーションゼロ

### Claude Code向けCLAUDE.md記載例

```markdown
## DI Framework: VContainer
- 使用バージョン: VContainer 1.x
- MonoBehaviourのInject: [Inject]属性またはRegisterComponentInHierarchy
- エントリポイント: IInitializable/IStartable/ITickable インターフェース
- LifetimeScope: シーンまたはプレハブ単位でスコープを定義
- Pure C#クラス優先: MonoBehaviourへの依存を最小化すること
- Zenject/Extenjectのコードは生成しないこと
```

### VContainerパターンの基本

```csharp
// Claudeへの指示例:
// 「PlayerServiceをVContainerで登録し、
//  GameSceneLifetimeScopeでバインドしてください。
//  IPlayerServiceインターフェースを使用すること」

public class GameSceneLifetimeScope : LifetimeScope
{
    protected override void Configure(IContainerBuilder builder)
    {
        builder.Register<PlayerService>(Lifetime.Singleton).As<IPlayerService>();
    }
}
```

### AIが混同するパターン

- Zenject の `Container.Bind<>().AsSingle()` → VContainerでは `builder.Register<>().As<>().AsScoped()`
- CLAUDE.mdに「Zenjectのコードを生成しないこと」を明記すると誤生成が減る

---

## UniTask (非同期処理)

**リポジトリ**: https://github.com/Cysharp/UniTask  
**特徴**: Unity最適化のasync/await実装、GCフリー

### CLAUDE.md記載例

```markdown
## Async Framework: UniTask
- async/awaitはすべてUniTaskを使用 (System.Threading.Tasksは使わない)
- キャンセレーション: CancellationTokenSourceとGetCancellationTokenOnDestroy()を使用
- シーケンス: UniTask.WhenAll / UniTask.WhenAny
- コルーチンの変換: UniTask.ToCoroutine() または coroutine.ToUniTask()
```

### 推奨パターン

```csharp
// Claudeへの指示例:
// 「敵の出現演出をUniTaskで実装してください。
//  CancellationTokenで外部からキャンセル可能にすること」

private async UniTaskVoid SpawnEnemyAsync(CancellationToken ct)
{
    await UniTask.Delay(1000, cancellationToken: ct);
    // スポーン処理
}
```

---

## R3 (Reactive Extensions for Unity)

**特徴**: UniRxの後継。Unity向け最適化版Reactive Extensions

### CLAUDE.md記載例

```markdown
## Reactive Framework: R3
- UniRxは使わない (R3に移行済み)
- Observable: R3.Observable を使用
- Subject: R3.Subject<T>
- AddTo(this): MonoBehaviourのライフサイクルに紐付ける
- Subscribe後はDisposableを管理すること
```

---

## TheOne Studio 4段階品質基準

商用ゲーム開発スタジオが制定したClaude Code スキルの品質優先度: (high: github.com/The1Studio)

1. **コード品質** (最優先): Nullable型、アクセス修飾子、例外処理、ログパターン
2. **モダン言語**: フレームワーク固有のイディオム
3. **アーキテクチャ**: DIパターン、状態管理、コンポーネント構成
4. **パフォーマンス** (最低優先): 最適化とレビューチェックリスト

この優先度で「アーキテクチャ基盤の堅牢性をパフォーマンス最適化より優先する」設計。

---

## AI-first Unity Workflow の検証システム

`devdavv/unity-ai-workflow` が実装する信頼性マーキング:

- **[VERIFIED]**: 公式ソースで確認済みの情報
- **[SYNTHESIZED]**: 複数入力からAIが生成した情報
- **[UNVERIFIED]**: 確認が必要な推測的推奨

これをClaude Codeの出力に適用することで「サイレントハルシネーション」を防止。ゲーム開発では特にフレームワーク固有の情報でハルシネーションが起きやすい。

---

## フレームワーク別CLAUDE.md参照文書の作り方

```markdown
## References
- VContainer公式ドキュメント: vcontainer.hadashikick.jp
- UniTask README: github.com/Cysharp/UniTask
- R3 README: github.com/Cysharp/R3
- プロジェクト固有のアーキテクチャ決定: .claude/docs/architecture.md
```

参照文書リンクをCLAUDE.mdに記載すると、Claudeがコード生成時に参照できる。

---

## データ構造先行設計 (重要)

商用ゲームの知見: 「ゲームロジックの本質はUnityの外側にある」

**推奨する実装順序:**
1. Domain オブジェクト (Pure C# クラス)
2. UseCase / Service レイヤー
3. Master データ (ScriptableObject)
4. Repository / Persistence レイヤー
5. Unity 固有の Presenter / View レイヤー
6. MonoBehaviour はできる限り薄く

この順序でClaude Codeに実装を依頼すると、テスタブルでAI生成しやすいコードになる。(high: qiita.com/archeleeds)

---

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | 高 | SpellApiClient / SpellCaster に必須 |
| **MVP必須度** | **必須** | VContainer非使用だとMock切替が困難 |
| **AI実装適性** | 高 | CLAUDE.mdに規約記載後は高精度で生成 |
| **人間が実装すべき箇所** | LifetimeScopeの設計、DIグラフの決定、インターフェース設計 |

**AI Grimoire でのDI登録例**:
```csharp
// GameLifetimeScope.cs
public class GameLifetimeScope : LifetimeScope
{
    [SerializeField] bool useMockSpellApi;
    [SerializeField] string apiUrl = "http://localhost:8000";

    protected override void Configure(IContainerBuilder builder)
    {
        if (useMockSpellApi)
            builder.Register<ISpellApiClient, MockSpellApi>(Lifetime.Singleton);
        else
            builder.Register<ISpellApiClient>(_ => new SpellApiClient(apiUrl), Lifetime.Singleton);

        builder.Register<SpellCaster>(Lifetime.Singleton);
    }
}
```

---

## 出典

- (Source: github.com/The1Studio/theone-training-skills)
- (Source: qiita.com/archeleeds/items/6fbf02174f308e31f284)
- (Source: github.com/devdavv/unity-ai-workflow)
- (Source: vcontainer.hadashikick.jp)
- (Source: github.com/hadashiA/VContainer)
