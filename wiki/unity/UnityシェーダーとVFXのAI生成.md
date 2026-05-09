---
type: concept
title: "UnityシェーダーとVFXのAI生成"
updated: 2026-05-09
tags:
  - unity
  - shader
  - vfx
  - shaderlab
  - claude-code
  - urp
status: developing
related:
  - "[[Unity 2D AIコード生成パターン]]"
  - "[[Unity 2Dパフォーマンス最適化とAI]]"
  - "[[Unity MCP統合]]"
---

# UnityシェーダーとVFXのAI生成

Claude Code/CodexによるShaderLab・HLSL・VFX Graphコード生成のパターン。JSONを中間フォーマットとするパイプラインで開発時間を1/3に削減した事例あり。

---

## ShaderLabコード生成

Claude CodeはShaderLabとHLSLを高精度で生成できる。2D向けシェーダーはVertex/Fragment shaderが主軸。

### 基本プロンプト (URP Unlit)

```
プロンプト例:
「Unity URP向けのUnlit Shaderを作成:
- 名前: Sprites/Dissolve
- Properties: _MainTex, _DissolveMap, _DissolveAmount (0-1), _EdgeColor, _EdgeWidth
- DissolveAmountに基づいてDissolveMapのR値をしきい値と比較してクリップ
- エッジ部分をEdgeColorで着色 (しきい値 ± EdgeWidth範囲)
- SRP Batcher互換 (CBUFFER_START/END使用)
- 2Dスプライトに対応 (MainTex_ST対応)」
```

### アウトライン・グロー効果

```
プロンプト例:
「URP 2Dキャラクター用アウトラインシェーダー:
- サンプリング8方向でアウトライン検出
- アウトライン色と幅を[SerializeField]で制御可能
- SpriteRendererと組み合わせられるようにCustom URP 2D Rendererでセットアップ
- アウトラインの太さをピクセル単位で指定 (解像度非依存)」
```

---

## JSON→シェーダー パイプライン

シェーダーパラメータをJSONで定義してからコードに変換するアプローチ。開発時間を従来の1/3に削減した事例がある。(high: zenn.dev/r96123)

### パイプライン構成

```json
// shader-spec.json
{
  "name": "WaterRipple2D",
  "type": "URP_Unlit",
  "properties": [
    {"name": "_MainTex", "type": "2D"},
    {"name": "_RippleSpeed", "type": "Float", "default": 1.0},
    {"name": "_RippleStrength", "type": "Float", "default": 0.05},
    {"name": "_RippleFrequency", "type": "Float", "default": 10.0}
  ],
  "technique": "uv-distortion",
  "notes": "2Dウォーターエフェクト。UV座標をsin波で歪める"
}
```

```
プロンプト: 「この shader-spec.json をもとにURP ShaderLabコードを生成してください」
```

**メリット**: バージョン管理しやすい、仕様書として読める、非エンジニアが仕様を書ける

---

## Shader Graph (ノードベース)

Shader Graphは.shadergraphファイル (JSON) で管理される。Claude Codeはこのファイルを直接読み書きできる。

```
プロンプト例:
「既存のMyShader.shadergraph を読んで:
1. 現在のノード構成を説明
2. _Intensity プロパティを追加してAlpha値に乗算するノードを挿入
3. 変更後のJSONを出力」
```

**注意**: .shadergraphはUnityバージョンで互換性が変わるためバージョンを明示すること。AI生成したJSONがSchema不一致でインポートエラーになるケースあり。

---

## VFX Graph (パーティクル)

Unity VFX GraphはVisual Effect Graph (.vfx) ファイルで管理。複雑なノードグラフのため直接生成は難しいが、C# API経由でパラメータ制御コードは生成可能。

### C#経由でVFXを制御

```
プロンプト例:
「VisualEffect コンポーネントをコードから制御:
- SendEvent("OnHit") でヒットエフェクトを再生
- SetVector3("HitPosition", hitPoint) でエフェクト位置を指定
- SetFloat("BurstCount", comboCount) でコンボ数に応じてパーティクル数を変える
- コルーチンでPlay/Stopのタイミングを制御」
```

---

## mcp-unity v9.5.2: manage_camera ツール

mcp-unity v9.5.2以降でCinemachineカメラを直接操作できる `manage_camera` ツールが追加。(medium: github.com/CoderGamester/mcp-unity)

```
ツール機能:
- create_virtual_camera: CinemachineVirtualCameraを作成
- set_follow_target: FollowターゲットをGameObjectで指定
- set_camera_properties: FOV、Dutch、Offset等を設定
- add_noise: CinemachineBasicMultiChannelPerlinでカメラシェイク追加
```

```
Claude Codeへの指示例:
「ボス登場時にカメラを震わせるCinemachineセットアップを作成して。
ボスのHPが50%を切ったら自動でZoomInするVirtual Cameraも追加」
```

---

## 2D特有のレンダリング注意点

### URPの2D Rendererでの制約

- **2D Lights**: Normal Map非対応のShaderはLit shaderに差し替えが必要
- **Shadow Caster 2D**: AIはShadowCaster2D の `castsShadows` property を見落としやすい
- **Pixel Perfect Camera**: Pixel Snap有効時にShaderのUVが0.5pxずれる現象 → Snap Pixel操作をShader内で実施

### CLAUDE.mdへの記載推奨

```markdown
## レンダリング設定
- レンダラー: URP 2D Renderer (Light2D使用)
- Pixel Perfect Camera: 使用 (Reference Resolution: 320x180)
- シェーダーはすべてSRP Batcher互換にすること
- Material PropertyBlockは使わない (SRP Batcherが無効化されるため)
```

---

## 出典

- (Source: zenn.dev/r96123/articles/unity-shader-ai-pipeline)
- (Source: github.com/CoderGamester/mcp-unity/releases/tag/v9.5.2)
- (Source: docs.unity3d.com/Packages/com.unity.render-pipelines.universal@latest/manual/ShaderGraph.html)
- (Source: docs.unity3d.com/Packages/com.unity.visualeffectgraph@latest)
- (Source: forum.unity.com/threads/srp-batcher-compatibility-with-material-property-blocks.804497)
