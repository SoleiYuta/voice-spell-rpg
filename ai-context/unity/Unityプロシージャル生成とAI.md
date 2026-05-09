---
type: concept
title: "Unityプロシージャル生成とAI"
updated: 2026-05-10
tags:
  - unity
  - procedural-generation
  - dungeon
  - tilemap
  - roguelike
  - claude-code
status: developing
related:
  - "[[AIによるUnityレベルデザイン自動化]]"
  - "[[Unity 2D AIジャンル別実装検証]]"
  - "[[Unity 2D AIコード生成パターン]]"
---

# Unityプロシージャル生成とAI

Claude Code/Codexによるプロシージャル生成実装。ローグライクダンジョン、タイルマップ地形、バイオーム生成のコード生成パターン。

---

## プロシージャル生成とAIの相性

AIがコードを生成しやすいプロシージャル生成アルゴリズムとそうでないものがある。

| アルゴリズム | AI適性 | 注意点 |
|------------|--------|--------|
| ランダムウォーク | 高 | シンプルな実装 |
| BSP (Binary Space Partitioning) | 高 | 再帰構造が明確 |
| Cellular Automaton | 高 | ルールが数値化できる |
| Wave Function Collapse | 中 | 制約ソルバーの実装が複雑 |
| Perlin/Simplex Noise | 高 | 数学的に明確 |
| Delaunay三角分割 | 低 | 幾何計算が複雑でミスが多い |

---

## ランダムウォーク ダンジョン生成

Unityの公式ブログでも紹介されている基本パターン。AIが高精度で生成できる。(high: blog.unity.com/engine-platform/procedural-patterns-you-can-use-with-tilemaps-part-1)

### プロンプト例

```
「Unity 2022.3 LTS, TilemapでRandomWalkダンジョンを生成:
- グリッドサイズ: 50x50
- ウォーカー数: 3 (並行して歩く)
- 各ウォーカーはステップ数200で歩く
- 歩いたセルをFloorTileに、隣接セル(4方向)をWallTileに設定
- 開始位置は中央 (25,25)
- Tilemap.SetTile() を使用
- 生成後にConnectivity Check (全床タイルが連結か) を実行
- 非連結なら再生成する」
```

---

## BSP ダンジョン生成 (ローグライク)

部屋同士が必ず廊下でつながることが保証される。Enter the Gungeon タイプの構造に適している。

### プロンプト例

```
「Binary Space Partitioning (BSP) アルゴリズムでダンジョン生成:
- DungeonGenerator.cs を作成
- BSPNode クラス: Rect bounds, BSPNode left, BSPNode right, Room room
- 分割条件: 最小サイズ 10x10, 最大サイズ 25x25
- 葉ノードに部屋を配置 (ノードサイズの60-90%)
- 隣接するBSPノードの部屋を廊下で接続 (L字型)
- Unity Tilemap に Procedural Tilemap で描画
- [ContextMenu("Generate")] で再生成可能に」
```

---

## Wave Function Collapse (WFC)

タイルセットに基づいて制約を満たすマップを生成するアルゴリズム。プロンプトが複雑になるが生成品質が高い。

```
プロンプト例:
「Wave Function Collapseの簡易実装:
- TileConstraint: 各タイルの隣接可能タイルをリストで定義
- Cell クラス: 候補タイルのリスト (最初は全タイル)
- Propagate: エントロピー最小のCellを選び、タイルを確定してから隣接Cellの候補を絞る
- Contradiction (候補が0になった場合): バックトラックして再試行
- 入力: 5種類のタイル (Floor, Wall, Door, Chest, Stairs) のConstraintRule配列
- Unity TilemapにRuleTileで描画」
```

**注意**: WFCは実装バグが多いためユニットテストを最初に書かせること。Claude Codeはバックトラック処理を忘れやすい。

---

## Perlin Noise による地形生成 (オープンワールド2D)

横スクロールゲームのチャンク生成、高低差のある地形生成に適している。

```
プロンプト例:
「Perlin Noiseを使った横スクロール地形生成:
- チャンクサイズ: 16x64 (幅x高さ)
- Mathf.PerlinNoise(x * 0.1f, seed) で地表高さを決定
- 地表から3タイル下まで土、さらに下は石
- 種 (seed) をInspectorで設定可能
- カメラが右端に近づいたら右側にチャンクを追加生成
- 左端に離れたチャンクを破棄 (プール管理)
- チャンク境界がシームレスになるようにオフセット計算」
```

---

## プロシージャル生成とプレイアブル性

**最重要知見**: AIはデータ的に正しいダンジョンを生成できるが、プレイアブルかどうかは保証できない。(前提: [[Unity 2D AIジャンル別実装検証]] のダンジョン生成49分失敗事例)

### プレイアブル検証チェックリスト (CLAUDE.mdに記載)

```markdown
## プロシージャル生成の検証要件
生成後に以下を必ず確認:
- [ ] スタート位置からゴールまでパスが存在する (BFS確認)
- [ ] 最小通路幅 2タイル以上 (1タイル通路は詰まりやすい)
- [ ] 孤立した部屋がない (すべての部屋が到達可能)
- [ ] スポーン可能エリア (障害物なし3x3) が存在する
- [ ] アイテム配置スペースが確保されている
```

### 自動検証コード (Claude Codeに生成させる)

```
プロンプト例:
「DungeonValidator.cs を作成:
- BFSでスタートからすべての床タイルへの到達性を検証
- Pathfinding.cs を使ってスタート→ゴール間の最短距離を計算
- 到達不能な床タイルが存在したらfalseを返す
- ValidateAndRegenerate() はValidate()がfalseの場合に再生成する (最大10回試行)」
```

---

## Dungeon Generator Pro 2D (アセット)

itch.ioで公開されているUnity向けダンジョン生成ライブラリ。Claude Codeでカスタマイズする際の参考実装として使える。(low: despairlab-games.itch.io/dungeon-generator-pro-2d)

---

## 出典

- (Source: blog.unity.com/engine-platform/procedural-patterns-you-can-use-with-tilemaps-part-1)
- (Source: gamedevacademy.org/understanding-procedural-dungeon-generation-in-unity/)
- (Source: pavcreations.com/procedural-generation-of-2d-maps-in-unity/)
- (Source: github.com/sunsided/unity-procedural-dungeons)
- (Source: github.com/robinxb/Procedural-Generation-Tilemap)
