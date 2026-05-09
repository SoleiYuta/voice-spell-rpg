---
type: concept
title: "Unity DOTS・ECSとAIコード生成の限界"
updated: 2026-05-10
tags:
  - unity
  - dots
  - ecs
  - burst
  - ai-limitations
  - claude-code
status: developing
related:
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
  - "[[Unity 2D AIジャンル別実装検証]]"
  - "[[Unity 2Dパフォーマンス最適化とAI]]"
---

# Unity DOTS・ECSとAIコード生成の限界

Unity DOTS/ECSはAIにとって最も難しい領域。OOP思考からデータ指向設計へのパラダイムシフトがAIの学習データと合わない。

---

## なぜDOTS/ECSはAIが苦手か

1. **学習データの少なさ**: ECSがUnity公式でフルリリースされたのは2022年以降。AIの学習データにMonoBehaviour/GOパターンが圧倒的に多い
2. **パラダイムの逆転**: OOPでは「オブジェクトがデータを持ちメソッドを持つ」、ECSでは「ComponentにデータのみSystemにロジックのみ」
3. **Burst制約**: `[BurstCompile]` 内ではManaged型 (class, string, List<T>) が使えない制約をAIが見落とす
4. **Job System**: `IJobParallelFor`, `NativeArray` の使い方がMonoBehaviourと全く異なる
5. **頻繁なAPI変更**: ECS APIは2020-2024年に大幅に変わっており、古いAPIを生成するリスクが高い

---

## DOTSの現状 (2026)

Unity 6でDOTS/ECSが正式版へ移行。しかしAIコード生成の品質はまだ改善途上。(medium: darkounity.com/blog/getting-started-with-unity-6-dots-and-ecs-in-2026)

| 領域 | AI生成品質 |
|------|-----------|
| ComponentDataの定義 | 中 (構造体の定義は可能) |
| ISystem / SystemBase | 低 (ScheduleParallelが不安定) |
| EntityCommandBuffer | 低 (Playback順序を誤りやすい) |
| Burst対応Job | 低 (Managed型の混入) |
| ECS + Physics | 非常に低 |

---

## DOTS/ECSをCLAUDE.mdで制御する

**推奨**: ゲームジャムや小規模プロジェクトではDOTSを使わないとCLAUDE.mdに明記。

```markdown
## アーキテクチャ制約
- DOTS/ECSは使わない (MonoBehaviour + Componentパターンを使用)
- Burst CompilerはJob Systemと組み合わせる場合のみ使用
- NativeArrayはパフォーマンスクリティカルな箇所のみ
- ECS Entity操作コードを生成する必要がある場合は必ず人間がレビュー
```

---

## DOTSが必要な場合のプロンプト戦略

DOTS使用が避けられない場合 (大量エンティティの弾幕等) の対処法。

### ステップ1: ComponentDataの定義を先行させる

```
プロンプト例:
「ECSのComponentDataのみを定義:
- BulletData: position, velocity, damage, lifetime (float3, float3, int, float)
- EnemyData: hp, speed, attackRange (int, float, float)
- PlayerTag: タグコンポーネント (IComponentData の空構造体)

Systemは後で追加するため、今はComponentのみ。
[BurstCompile]とManaged型を混在させないこと。」
```

### ステップ2: Systemを個別に実装させる

```
「先ほど定義したBulletDataを処理するBulletMoveSystem:
- ISystem を実装
- [BurstCompile] でマーク
- SystemAPI.Query<RefRW<BulletData>>() で全弾丸を処理
- position += velocity * deltaTime
- lifetime -= deltaTime; lifetime <= 0 の弾をECBで削除
- EntityCommandBuffer.ParallelWriter を使う」
```

### ステップ3: 必ず人間がBurstコンパイラエラーを確認

Burst CompilerのエラーはEditorではなく **Jobs > Burst > Open Inspector** で確認。AIはこの工程を省略しがち。

---

## Utility Intelligence (ECS) アセット

DOTSネイティブのAIフレームワーク。AIゲームの挙動をECSで実装するためのアセット。(low: assetstore.unity.com/packages/tools/behavior-ai/utility-intelligence-ecs-utility-ai-framework-for-dots-316295)

Claude CodeでUtility Intelligenceの設定コードを生成させることは可能だが、フレームワーク自体の理解が必要なため上級者向け。

---

## DOTSが向いているシナリオ vs 向いていないシナリオ

### 向いている (AI支援でも挑戦可)
- 弾幕シューティング (1000発以上の同時処理)
- 大規模タイルマップ操作
- パーティクルシステムの補完

### 向いていない (MonoBehaviourを使うべき)
- 2Dプラットフォーマーのキャラクター制御
- UI連携が必要なシステム
- ゲームジャム / 短期開発
- チームのDOTS経験がない場合

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | **使わない** | AI Grimoireは2Dローグライクで弾幕1000発規模ではない。MonoBehaviourで十分 |
| **MVP必須度** | **ゼロ** | CLAUDE.mdに「DOTS/ECSは使わない」と明記して封印する |
| **AI実装適性** | 低 | ECS/DOTSコードは誤生成リスクが高く、ハッカソン時間内にデバッグ困難 |
| **人間が実装すべき箇所** | 判断そのもの（DOTSを使わないという判断）。CLAUDE.mdへの制約明記 |

**AI Grimoire CLAUDE.md への追記 (重要)**:
```markdown
## アーキテクチャ制約
- DOTS/ECSは一切使わない (MonoBehaviour + Componentパターンで統一)
- パフォーマンス問題が起きてから最適化を検討する
- 弾幕が必要になっても最初はMonoBehaviourで実装し、ボトルネック計測後に判断
```

---

## 出典

- (Source: darkounity.com/blog/getting-started-with-unity-6-dots-and-ecs-in-2026)
- (Source: discussions.unity.com/t/coreclr-scripting-and-ecs-status-update-march-2026/1711852)
- (Source: assetstore.unity.com/packages/tools/behavior-ai/utility-intelligence-ecs-utility-ai-framework-for-dots-316295)
- (Source: pixelmatic.github.io/articles/2020/05/13/ecs-and-ai.html)
- (Source: unity.com/ecs)
