---
type: concept
title: "AIによるUnityレベルデザイン自動化"
updated: 2026-05-09
tags:
  - unity
  - level-design
  - procedural
  - ai
  - claude-code
  - codex
status: developing
related:
  - "[[Unity 2D AIジャンル別実装検証]]"
  - "[[Unity MCP統合]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
---

# AIによるUnityレベルデザイン自動化

Claude Code/Codex + 専用ツールでUnityのレベルをプロンプトから自動生成するアプローチ。

---

## AI Level Designer (TaaroBravo)

**リポジトリ**: https://github.com/TaaroBravo/ai-powered-level-designer  
**対応Unity**: Unity 6  
**ライセンス**: MIT

### 仕組み

1. 自然言語プロンプトを入力
2. OpenAI (GPT-4o-mini) または Ollama (ローカルLlama 3.1) にリクエスト
3. AIがJSON設計図を生成
4. `LayoutValidator` が構造整合性を検証
5. `LayoutSanitizer` がカタログ制約に合わせてプルーニング
6. Unity Editorがシーンを自動構築

### 対応レイアウト

- 3Dアリーナ
- タワーディフェンスグリッド (セルアライメント)
- 2D/3D汎用グリッドベース配置

### Claude Codeとの組み合わせ

Claude Code でこのツールを拡張:
```
「TaaroBravo/ai-powered-level-designerのLayoutGeneratorを拡張し、
2Dダンジョンルームにスポーン可能な敵の種類と数を
プロンプトで指定できるようにしてください。
既存のLayoutValidatorを継承してDungeonLayoutValidatorを作成すること」
```

---

## Claude Code直接でのレベル生成

### タイルマップベースダンジョン

```
プロンプト例:
「Tilemapを使った2Dダンジョン自動生成システム:
- Random Walk アルゴリズムで洞窟型マップを生成
- RuleTileで自動的に壁・床・角のタイルを配置
- 部屋の接続を保証するFlood Fillで到達可能性を検証
- スポーン地点と出口をランダムに配置するが、
  到達可能性を検証してから配置すること
- シード値を[SerializeField]で公開してデバッグ可能に」
```

### プロシージャル地形 (プラットフォーマー)

```
プロンプト例:
「横スクロールプラットフォーマーのレベル自動生成:
- PerlinノイズベースでY方向の高低差を生成
- プレイヤーがジャンプで到達可能な距離でギャップを配置
  (最大ジャンプ距離: [SerializeField] で設定)
- 足場の高さ差を最大2タイルに制限
- 敵を等間隔に配置するが、スポーン直後のプレイヤーと重ならないよう保証」
```

---

## AIが苦手なレベルデザイン課題

### 体験整合性の検証

**問題**: AIは「論理的に正しいレベル」を作るが「実際にプレイアブルか」を確認できない

検証実験 (dev.classmethod.jp) でのダンジョン失敗例:
- スタートルームに現在の能力で越えられない障害物
- ダブルジャンプなしで脱出不能な部屋

**対策プロンプト:**
```
「生成後に以下を必ず検証してください:
1. 初期能力 (ジャンプ高さ2タイル、ダッシュなし) のみで
   すべての部屋に到達できるか
2. ゴール到達に必要なアビリティが、必ずそのエリアより
   前に入手できる配置になっているか
3. 詰み状態 (脱出不能なエリア) が存在しないか」
```

### 数値バランス

ゲームバランス調整はAIが最も苦手な領域。以下のアプローチで補完:

1. **スプレッドシートで数値管理** → ScriptableObjectに変換 → Claude Codeで読み込み
2. **バランスデータをCLAUDE.mdに記述** (敵HP、ダメージ値の許容範囲)
3. **プレイテストデータをフィードバック** 「プレイヤーがステージ2で平均3回死ぬので、敵のHPを15%下げてください」

---

## AIゲームバランス調整支援

Claude Code Game Studiosの `PerformanceEngineer` エージェントはバランス分析に特化:

```bash
/start
# PerformanceEngineerを呼び出す
「ステージ1のエネミーAI設定を確認し、
 モバイル60FPS維持のためのアクティブ敵数の上限を計算してください」
```

---

## ScriptableObjectベースのレベルデータ設計

AIが生成しやすい構造:

```
プロンプト例:
「以下のScriptableObjectを作成:
- LevelDataSO: 難易度、敵スポーンリスト、BGMクリップ、制限時間
- EnemySpawnDataSO: 敵プレハブ、スポーン座標リスト、スポーン遅延
- LevelLoader.cs: LevelDataSOを受け取ってシーンを組み立てるMonoBehaviour

EnemySpawnDataSOのリストをLevelDataSOに含め、
Wave形式でスポーンできるようにすること」
```

Unity公式: ScriptableObjectはデータとロジックの分離に最適。AIが生成・変更しやすいデータ構造を持つ。(high: unity.com/how-to/separate-game-data-logic-scriptable-objects)

---

## 出典

- (Source: github.com/TaaroBravo/ai-powered-level-designer)
- (Source: dev.classmethod.jp/en/articles/unity-mcp-claude-code-2d-game-verification/)
- (Source: unity.com/how-to/separate-game-data-logic-scriptable-objects)
- (Source: unity.com/how-to/architect-game-code-scriptable-objects)
