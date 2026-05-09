---
type: concept
title: "Unity 2Dアニメーション・サウンド・UIのAI実装"
updated: 2026-05-09
tags:
  - unity
  - 2d
  - animation
  - audio
  - ui
  - claude-code
  - cinemachine
status: developing
related:
  - "[[Unity 2D AIコード生成パターン]]"
  - "[[VContainer・UniTask・R3とAI連携パターン]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
---

# Unity 2Dアニメーション・サウンド・UIのAI実装

Claude Code/Codexを使ったUnity 2Dゲームのアニメーション・オーディオ・UI実装の具体的プロンプトパターン。

---

## アニメーション

### Animator / Animator Controllerの設定

```
プロンプト例:
「Unity 2022.3 LTS、URP。
PlayerAnimator.csを作成してください:
- Idle/Run/Jump/Fall/Attack の5ステート
- Rigidbody2Dの速度に基づいてステートを自動遷移
- [SerializeField] でAnimatorパラメータ名を設定可能
- SetFloat/SetBool/SetTriggerを整理したラッパーメソッドを持つ」
```

### スプライトシートからアニメーションクリップを自動生成するEditorスクリプト

```
プロンプト例:
「スプライトシートを読み込み、フレーム数を指定してアニメーションクリップを
自動生成するEditorスクリプトを作成してください。
生成したクリップをAnimatorControllerに自動追加する機能も含める」
```

### 2Dボーンアニメーション (Unity 2D Animation Package)

```
プロンプト例:
「Unity 2D Animation Packageを使ったIKリグシステムのセットアップスクリプトを作成。
ボーンウェイトの設定をコードから行い、
InverseKinematics2Dコンポーネントを自動設定してください」
```

---

## Cinemachine 2Dカメラ

Cinemachine 3.0 (Unity 6+) でAPIが簡略化。`m_`プレフィックスが廃止。

### 基本的な2D追従カメラ

```
プロンプト例 (Unity 6以降を明示):
「Unity 6以降のCinemachine 3.0を使用。
CinemachineCamera で2Dプレイヤー追従を実装:
- Framing Transposerでデッドゾーンとダンピングを設定可能
- [SerializeField] で追従速度を調整可能
- プレイヤーが壁際に来たらカメラが止まる処理を含む」
```

### カメラシェイク (衝撃演出)

```csharp
// Claudeへの指示:
// 「CinemachineImpulseSourceで爆発時のカメラシェイクを実装。
//  シェイクの強度と持続時間を[SerializeField]で設定可能にすること」

// 生成されるパターン:
[SerializeField] private CinemachineImpulseSource _impulseSource;

public void TriggerShake(float force)
{
    _impulseSource.GenerateImpulseWithForce(force);
}
```

### カメラ切り替え (カットシーン)

```
プロンプト例:
「ボス部屋入室時にCinemachineカメラをプレイヤー追従カメラからボスフォーカスカメラに
ブレンド切り替えするシステムを実装。
Priority を使った切り替えと、UniTaskで遷移完了を待機する処理を含める」
```

---

## サウンドシステム

### AudioManagerパターン (シングルトン)

```
プロンプト例:
「AudioManager.csをScriptableObjectベースで実装:
- SoundDataSO: AudioClip、音量、ピッチ変動幅を保持
- AudioManager: シングルトン、SoundDataSOを受け取ってPlayOneShot/Loopを制御
- オブジェクトプールで AudioSource を管理 (最大16チャンネル)
- BGMとSEを別チャンネルで管理、独立してボリューム設定可能」
```

### アニメーションイベント連携

```
プロンプト例:
「FootstepSound.csを作成。
AnimationEvent から呼び出し可能なPlayFootstep()メソッドを実装。
地面のPhysics Materialに応じて異なるサウンドを再生する」
```

### FMOD統合 (インディー向け)

```
プロンプト例:
「FMOD Studio統合のFMODManager.csを作成。
EventReference を使った再生管理、パラメータ設定、
ゲームオブジェクトの位置に基づく3D/2D空間オーディオ切り替えを実装」
```

FMOD は $500k 未満のプロジェクトなら無料ライセンスあり。Claude への説明が必要な場合は CLAUDE.md に記載。(high: generalistprogrammer.com FMOD tutorial)

---

## UI (UI Toolkit 推奨 vs uGUI)

### UI ToolkitのUXML/USS自動生成

Unity AI Beta 2026 のGenerators機能でテキストプロンプトからUXMLを生成可能。(high: docs.unity3d.com Unity AI)

**Claude Codeでの生成:**
```
プロンプト例:
「Unity UI Toolkitで以下のHUDをUXMLで作成:
- 左上: HPバー (ProgressBar) + ハートアイコン
- 右上: スコアカウンター (Label)
- 中央下: ジャンプクールダウンインジケーター
USSで dark-theme (#1a1a1a背景, #e07850アクセント) を適用」
```

注意: UI ToolkitとuGUIのコードをAIが混同することがある。CLAUDE.mdに「UI ToolkitのみUXML/USSで実装」と明記すること。

### uGUI のHUD (既存プロジェクト)

```
プロンプト例:
「既存のuGUI UIにHealthBarController.csを追加:
- SliderコンポーネントでスムーズなHP変化アニメーション (DOTween使用)
- HPが20%以下で色を赤に変化
- UniTaskで被ダメージ時のフラッシュ演出」
```

---

## プロシージャルオーディオ (上級)

AI Level Designerと組み合わせることで、生成されたレベルに応じた動的サウンドを自動設定できる。(medium: 実験的)

```
プロンプト例:
「ダンジョンの深さに応じてAmbientサウンドをクロスフェードするシステム:
- 深さ0-5: 洞窟の水音
- 深さ5-10: 不気味な音楽
- ボス部屋: BGM切り替え
AudioMixerGroupを使ってミックスを動的制御」
```

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | フェーズ3以降 | MVP最小構成には含めず、デモ品質向上フェーズで使う |
| **MVP必須度** | 低〜中 | UIは必要 (HP/スコア表示)。アニメーション・サウンドはMVP後半 |
| **AI実装適性** | 高 (uGUI) / 中 (UI Toolkit) | uGUIのHUD実装はAIが得意。UI Toolkitは混同リスクあり |
| **人間が実装すべき箇所** | 評価結果UIのデザイン、詠唱フィードバック (色・エフェクト・サウンド) の「体験的」調整 |

**AI Grimoire MVP向けUI優先順位**:
1. HPゲージ (uGUI Slider) — フェーズ1で実装
2. 詠唱スコア表示 (TextMeshPro) — フェーズ2で実装
3. spell_power / gm_comment 表示パネル — フェーズ2で実装
4. TTS音声再生ボタン → 詠唱開始/終了UI — フェーズ3
5. Cinemachineカメラ / パーティクルエフェクト — フェーズ4 (デモ演出)

---

## 出典

- (Source: github.com/AnotherIFMG/claude-code-game-studios/docs/engine-reference/unity/plugins/cinemachine.md)
- (Source: allinoneaicenter.com/blog/best-ai-tools-for-unity-developers)
- (Source: generalistprogrammer.com/tutorials/fmod-unity-complete-game-audio-integration-tutorial)
- (Source: learn.unity.com/pathway/game-development/unit/audio)
