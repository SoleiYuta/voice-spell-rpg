---
type: concept
title: "Unity 2Dパフォーマンス最適化とAI"
updated: 2026-05-09
tags:
  - unity
  - 2d
  - performance
  - srp-batcher
  - gpu-instancing
  - claude-code
status: developing
related:
  - "[[Unity 2D AIコード生成パターン]]"
  - "[[Unity プロジェクトのCLAUDE.md設計]]"
  - "[[Unityゲームリリースパイプラインとビルド自動化]]"
---

# Unity 2Dパフォーマンス最適化とAI

Claude Code/Codexによるパフォーマンス最適化のアプローチ。SRP BatcherとGPU Instancingが2D描画最適化の主軸。

---

## SRP Batcher (描画コール削減)

URP/HDRPで有効なバッチング手法。同じShaderVariantを使うRendererを1回のdraw callにまとめる。

**効果**: draw call数を70-90%削減 (マテリアル数が多い2Dシーンで特に有効)

### CLAUDE.mdへの記載例

```markdown
## パフォーマンス要件
- レンダラー: URP (SRP Batcher有効)
- SRP Batcher互換のためCBuffer宣言を必須とする
- 動的オブジェクトはGPU Instancing優先
- AtlasはSprite Atlas (2Dグループ単位) で管理
```

### プロンプト例

```
「URP SRP Batcher互換のカスタムShaderを作成:
- Properties ブロックに必要な変数を宣言
- CBUFFER_START(UnityPerMaterial) / CBUFFER_END でマテリアルプロパティをラップ
- SpriteRendererと共存できるようにSpriteColor propertyを含む」
```

**注意**: SRP Batcherは同一ShaderVariantが条件。MaterialPropertyBlockを使うとバッチが崩れる。AIはこの制約を見落としやすいためCLAUDE.mdに明記すること。(high: docs.unity3d.com/Manual/SRPBatcher.html)

---

## GPU Instancing (大量オブジェクト)

弾幕・パーティクル・タイルなど、同一メッシュを大量描画する場合に有効。

### プロンプト例

```
「GPU Instancingを使った弾幕システムを実装:
- Graphics.DrawMeshInstanced を使い1フレームで最大1023発の弾を描画
- MaterialPropertyBlock で弾ごとの色を変える (SRP Batcherとの非互換に注意)
- BulletData構造体 (Vector3 position, Quaternion rotation, float scale) をNativeArrayで管理
- Burst CompilerとJobSystemでTransform計算を並列化」
```

---

## Burst Compiler + Job System

CPUボトルネック (AI計算・物理・経路探索) をマルチスレッド化。

```
プロンプト例:
「Burst Compilerを使ったA*パスファインディングJobを実装:
- IJobParallelFor で複数エージェントの経路を並列計算
- NativeArray<int2> でグリッドデータを渡す
- [BurstCompile] アトリビュートを付与
- メインスレッドへの結果返却はNativeArray経由」
```

**AIの注意点**: BurstはManaged型 (string, List<T>, Dictionary等) を使えない。AIがManaged型を混入させるケースが多いためCLAUDE.mdに制約を記載する。(medium: docs.unity3d.com/Packages/com.unity.burst@latest)

---

## 動的品質スケーリング (DynamicResolution)

モバイル向けに実行時に解像度を動的変更する。Claude Codeはコード生成できるが、しきい値は手動チューニングが必要。

```
プロンプト例:
「URPのDynamic Resolutionを実装:
- FrameTimingManager でGPU時間を計測
- 目標60fpsを下回ったらScalableBufferManager.ResizeBuffers(0.75f, 0.75f)
- 目標を上回ったら1.0fに戻す
- DynamicResolutionHandler.SetDynamicResScaler でカスタムスケーラーを登録」
```

---

## Profilerとの連携

Claude CodeはProfilerのデータを直接読めないが、Profilerのログをテキストで渡すと分析できる。

### ワークフロー

```
1. Unity Profiler → Save (profiler.data)
2. Window > Analysis > Profiler → Export CSV
3. Claude Codeに貼り付け: 「このProfilerデータのボトルネックを分析して」
4. Claude CodeがCSVから最大コスト関数を特定し最適化コードを提案
```

**2D特有のボトルネック**:
- Sprite Atlasのパッキング漏れ → 同一Atlasに収める
- PhysicsシミュレーションのCollider数超過 → CompositeCollider2Dでまとめる
- Canvasの Rebuild → EventSystem.SetSelectedGameObject(null) で抑制

---

## プロファイルに基づくプロンプト設計

最適化プロンプトはコンテキストが多いほど精度が上がる。

```
効果的なプロンプト構造:
「現在の問題: CoroutineでUpdate毎にFindObjectOfType<T>を呼んでいる
環境: Unity 2022.3 LTS、URP、モバイル向け
目標: GC Allocをゼロにしたい
制約: Zenjectは使わない (VContainerを使用)
要件: 既存のMyManager.csを修正してDI経由で参照を注入する」
```

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | MVP後 | パフォーマンス問題はリリース前に対応。MVP期間中は不要 |
| **MVP必須度** | 低 | AI Grimoireは敵1体・1フロアのデモ。1000発弾幕レベルの最適化は不要 |
| **AI実装適性** | 高 | Profiler CSVを渡してボトルネック分析させるパターンはAIが得意 |
| **人間が実装すべき箇所** | Profilerでの計測、最適化の優先順位判断、目標FPSの設定 |

**AI Grimoire での注意点**: 音声評価のネットワーク待機中に Unity 側がフリーズしないよう `async/await + UniTask` を正しく使う方が、GPU最適化より重要。

---

## 出典

- (Source: docs.unity3d.com/Manual/SRPBatcher.html)
- (Source: docs.unity3d.com/Packages/com.unity.burst@latest)
- (Source: blog.unity.com/engine-platform/srp-batcher-speed-up-your-rendering)
- (Source: github.com/Unity-Technologies/EntityComponentSystemSamples)
- (Source: discussions.unity.com/t/srp-batcher-vs-gpu-instancing/247124)
