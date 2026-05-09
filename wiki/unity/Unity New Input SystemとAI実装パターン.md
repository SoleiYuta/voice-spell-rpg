---
type: concept
title: "Unity New Input SystemとAI実装パターン"
updated: 2026-05-10
tags:
  - unity
  - input-system
  - 2d
  - claude-code
  - controller
status: developing
related:
  - "[[Unity 2D AIコード生成パターン]]"
  - "[[Unity プロジェクトのCLAUDE.md設計]]"
  - "[[VContainer・UniTask・R3とAI連携パターン]]"
---

# Unity New Input SystemとAI実装パターン

Claude CodeによるNew Input System (com.unity.inputsystem) の実装パターン。CLAUDE.mdにInputSystemを明記しないとAIがInput.GetKey()を生成する罠がある。

---

## CLAUDE.mdへの必須記載

```markdown
## 入力システム
- Input System: com.unity.inputsystem (New Input System)
- Input.GetKey() / Input.GetAxis() は使わない
- PlayerInput コンポーネントまたは InputAction クラスを使う
- InputActionAsset (.inputactions) でバインディングを管理
- ActionMap: Player, UI, Gameplay を分ける
```

---

## 基本的な2Dプレイヤー移動 (PlayerInput)

```
プロンプト例:
「Unity New Input Systemで2Dプレイヤーコントローラーを実装:
- com.unity.inputsystem パッケージ使用
- PlayerInput コンポーネントを使用 (Invoke Unity Events)
- OnMove(InputAction.CallbackContext): Vector2で8方向移動
- OnJump(InputAction.CallbackContext): ジャンプ (Performed フェーズのみ)
- OnDash(InputAction.CallbackContext): ダッシュ (クールダウン付き)
- 移動: Rigidbody2Dのvelocityで制御
- Inspect: moveSpeed, jumpForce, dashSpeed, dashCooldown
- [SerializeField]をVContainerのInjectに置き換えない (PlayerInputはInspector設定)」
```

---

## InputAction クラス直接使用パターン

PlayerInput コンポーネントを使わない場合の実装。VContainerと相性がよい。

```
プロンプト例:
「InputAction を直接使ったInputHandler.cs:
- InputActionAsset から Move/Jump/Attack Action を取得
- OnEnable/OnDisable で Enable/Disable を切り替え
- Move.ReadValue<Vector2>() を FixedUpdate で読み取る
- Jump は .performed += OnJump でコールバック
- IInputHandler インターフェースを実装してDI可能にする
- UniTask で非同期の入力待機 (Dashチャージ等)」
```

---

## InputActionPrompts (コントローラーアイコン表示)

`simonoliver/InputSystemActionPrompts` — コントローラーのキーアイコンをUIに自動表示するOSSライブラリ。Claude Codeで連携コードを生成しやすい。(low: github.com/simonoliver/InputSystemActionPrompts)

```
プロンプト例:
「InputSystemActionPrompts を使ったUI:
- Action 'Jump' に対応するキーアイコンをTextMeshProで表示
- コントローラー変更時 (キーボード→ゲームパッド) にアイコンを自動更新
- ローカライゼーション対応 (ja: 'ジャンプ', en: 'Jump')」
```

---

## マルチプレイヤー入力

PlayerInputManagerを使った画面分割・複数プレイヤー入力の実装。

```
プロンプト例:
「Netcode for GameObjectsとNew Input Systemを組み合わせたマルチプレイヤー入力:
- PlayerInputManager でプレイヤーをJoinさせる
- NetworkBehaviour.IsOwner チェックで自分のプレイヤーのみ入力受付
- InputActionを NetworkVariable と連携 (入力をサーバーに送信)
- ローカルプレイヤーのInputActionは有効、他プレイヤーは無効」
```

---

## AIが生成するコードの80-90%ルール

> 「AIは80-90%まで仕上げてくれるが、プロジェクト固有のセットアップは人間が補完する必要がある」(claudelab.net)

### 人間が確認すべき項目

- `.inputactions` ファイルのAction名とコードの対応
- PlayerInputのEvent Mode (Send Messages / Broadcast / Unity Events)
- Input Debugger (Window > Analysis > Input Debugger) でバインディング確認
- WebGL向けの入力制限 (マウスロック制限等)

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | 必須 | CLAUDE.mdへの `Input.GetKey()禁止` 記載は最初に行う |
| **MVP必須度** | 高 | キーボード/マウスでの詠唱トリガーボタン実装に直接必要 |
| **AI実装適性** | 中〜高 | CLAUDE.mdに入力システムを明記すれば高品質なコードが出る。明記なしは確実に失敗 |
| **人間が実装すべき箇所** | `.inputactions` ファイルの手動作成とバインディング確認、Input Debuggerでの動作確認 |

**AI Grimoire CLAUDE.md に追加すべき記載**:
```markdown
## 入力システム
- New Input System (com.unity.inputsystem) 使用
- Input.GetKey() / Input.GetAxis() 禁止
- 詠唱開始: Space/マウスクリック → Microphone.Start()
- 詠唱終了: キー離し → 録音停止 → API送信
```

---

## 出典

- (Source: claudelab.net/en/articles/claude-code/claude-code-unity-game-development-guide)
- (Source: blog.logrocket.com/building-third-person-controller-unity-new-input-system/)
- (Source: github.com/simonoliver/InputSystemActionPrompts)
- (Source: docs.unity3d.com/Packages/com.unity.inputsystem@latest)
- (Source: arsturn.com/blog/how-to-use-claude-with-unity-for-faster-game-development)
