---
type: concept
title: "Unity AI Beta 2026とUI自動生成"
updated: 2026-05-10
tags:
  - unity
  - unity-ai
  - ui-toolkit
  - open-beta
  - figma
  - gemini
status: developing
related:
  - "[[Unity AI公式ツール 2026]]"
  - "[[Unity 公式MCP設定ガイド]]"
  - "[[Unity 2Dアニメーション・サウンド・UIのAI実装]]"
---

# Unity AI Beta 2026とUI自動生成

Unity AI が2026年5月4日にオープンベータ移行。全Unity 6開発者が利用可能に。FigmaからUI Toolkitコードを自動生成する機能を含む。

---

## Unity AI オープンベータ移行 (2026-05-04)

従来の招待制ベータから全Unity 6開発者へのオープンベータに移行。(high: discussions.unity.com/t/unity-ai-beta-2026-is-here/1703625)

### 料金

| プラン | 価格 | Unity AI |
|--------|------|----------|
| Pro / Enterprise / Industry | 既存料金 | 自動で含まれる |
| Personal Edition | +$10/月 | 追加サブスクリプション必要 |

### バックエンドモデル

Google Gemini を主要モデルとして採用。Unity 20年分のドキュメントとベストプラクティスで追加学習済み。

---

## 主要機能

### 1. Assistant (エディタ内AIアシスタント)

- C#スクリプト生成
- エディタタスク自動化
- シーン内GameObjectの読み取り・操作
- 自分の変更をCheckpointでロールバック
- **2つのモード**: Ask (質問・説明) / Agent (実際にUnityを操作)

### 2. Generators (アセット生成)

- スプライト生成 (テキストプロンプト)
- テクスチャ生成
- サウンド生成
- アニメーション生成
- マテリアル生成

### 3. Figma → UI Toolkit 変換

Figmaのスクリーンデザインをインポートし、UI Toolkit (UXML/USS) コードに変換する機能。

```
ワークフロー:
1. FigmaでUIをデザイン
2. UnityのAssistantにFigmaリンクを渡す
3. AssistantがUXML + USSを生成
4. スクリーンショットを参考にレイアウトを自動構築
5. C#スクリプトでイベントを紐付け
```

---

## Claude Code + Unity AI の共存

Unity AIがEditor内を担当し、Claude CodeがEditor外 (CI/CD・スクリプト生成・テスト) を担当する分業が最適。

### 役割分担

| タスク | Unity AI | Claude Code |
|--------|----------|-------------|
| エディタ内操作 | 最適 | MCP経由で可能 |
| シーン生成 | 最適 (画像参照) | MCP経由で可能 |
| UI Toolkit生成 | 最適 (Figma連携) | プロンプトで可能 |
| C#ロジック実装 | 可能 | 最適 |
| テスト生成 | 不可 | 最適 |
| CI/CDパイプライン | 不可 | 最適 |
| CLAUDE.md管理 | 不可 | 最適 |

### AI Gateway (Claude連携)

Unity AIのAI Gatewayを通じてClaude APIを直接Unity Editor内で呼び出すことが可能。独自モデルを接続できる。

```csharp
// AI Gateway経由でClaude APIを呼ぶEditor拡張
using UnityEngine;
using UnityEditor.AI;

public class ClaudeGatewayExample : EditorWindow
{
    async void GenerateCode()
    {
        var result = await AIGateway.InvokeAsync(new AIRequest
        {
            model = "claude-sonnet-4-6",
            prompt = "Unity 2Dのプレイヤー移動スクリプトを生成",
            context = AIContext.CurrentScene()  // シーン情報を自動付与
        });
        Debug.Log(result.content);
    }
}
```

---

## Unity AI vs Claude Code: UI生成比較

### Unity AI (Assistant) の強み

- **Figma連携**: デザインファイルをそのままUXMLに変換
- **シーン認識**: 現在のシーン構成を理解してUI配置を提案
- **ビジュアル**: スクリーンショット参照でレイアウトを再現
- **リアルタイムプレビュー**: Editor内でインタラクティブに調整

### Claude Code の強み

- **複雑なロジック**: 動的UI、状態管理、アニメーション
- **コードベース全体の把握**: CLAUDE.mdで全コンテキストを保持
- **カスタムパターン**: プロジェクト固有のUI規約を強制
- **テスト生成**: UIのユニットテストも同時生成

---

## VRChat ワールド制作への応用

VRChatのUnityワールド制作でもClaude MCPが活用されている。(high: zenn.dev/erimgarak/articles/3edc2ee715d00e)

```
ユースケース:
- ワールドのコライダー設定を自動化
- VRC_SceneDescriptorのパラメータをClaude Codeで設定
- アニメーターコントローラーの状態遷移を自動生成
- VRChatの制約 (ポリゴン数・マテリアル数) をCLAUDE.mdに記載して超過防止
```

---

## Bezi (Unity連携AIプロトタイピングツール)

Unity Editorと統合するサードパーティAIアシスタント。アセット実装とレベルレイアウトを自動化するスケーラブルなワークフローを構築できる。(medium: bezi.com)

- プロトタイピング → デバッグ → 反復を一気通貫でAI支援
- Unity AIと競合するが専門性が異なる

---

## 出典

- (Source: discussions.unity.com/t/unity-ai-beta-2026-is-here/1703625)
- (Source: docs.unity3d.com/6000.3/Documentation/Manual/com.unity.ai.assistant.html)
- (Source: buildfastwithai.com/blogs/unity-ai-open-beta-guide-2026)
- (Source: zenn.dev/erimgarak/articles/3edc2ee715d00e)
- (Source: support.unity.com/hc/en-us/articles/48060149523476)
- (Source: bezi.com)
