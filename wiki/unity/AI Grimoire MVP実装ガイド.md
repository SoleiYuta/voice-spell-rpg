---
type: concept
title: "AI Grimoire MVP実装ガイド"
updated: 2026-05-10
tags:
  - ai-grimoire
  - mvp
  - implementation
  - unity
  - fastapi
  - gemini
  - cloud-run
  - speech-to-text
status: evergreen
related:
  - "[[Unity プロジェクトのCLAUDE.md設計]]"
  - "[[VContainer・UniTask・R3とAI連携パターン]]"
  - "[[UnityテストとClaude Code自動化]]"
  - "[[Unity AIデバッグ支援とログ分析]]"
  - "[[AI-Grimoire/05_技術構成]]"
  - "[[AI-Grimoire/06_MVP開発計画]]"
  - "[[AI-Grimoire/tech/API設計]]"
  - "[[AI-Grimoire/tech/音声評価ロジック]]"
---

# AI Grimoire MVP実装ガイド

声で魔法を詠唱する2Dローグライクアクション。MVP縦切り: **録音 → WAV送信 → STT+librosa+Gemini評価 → Unity表示**。

→ 詳細設計書: [[AI-Grimoire/06_MVP開発計画]] | [[AI-Grimoire/tech/API設計]] | [[AI-Grimoire/tech/音声評価ロジック]]

---

## MVP縦切りスコープ (これだけ動けば成立)

```
[Unity] Microphone録音 (最大15秒、16000Hz)
    ↓ WAV bytes (multipart/form-data)
[Cloud Run / localhost:8080] POST /evaluate
    ├─ Google Cloud Speech-to-Text → transcript
    ├─ librosa → 音量(RMS), 速度(WPM), 詰まり数, 感情量
    └─ rapidfuzz → match_rate (正解テキストとの一致率)
    ↓ JSON
[Cloud Run] Gemini API → gm_comment生成
    ↓ EvaluationResult JSON
[Unity] spell_power に変換してエフェクト発動
```

**MVP外**: ローグライクマップ、Firestore永続化、TTS音声読み上げ、AIゲームマスター判断 (`/master-judge`)

---

## 実装フェーズ (設計書 06_MVP開発計画より)

| フェーズ | タスク | 担当 | 注意点 |
|---------|--------|------|--------|
| **Phase 1** | Unity 2D戦闘シーン (プレイヤー, 敵×1, HPゲージ) | Claude Code | WASD移動・Spriteだけ |
| **Phase 1** | キーボードで仮呪文発動 (Space → 固定ダメージ) | Claude Code | 音声なしで動作確認 |
| **Phase 2** | Cloud Run FastAPI 骨格 + `/evaluate` モックレスポンス | Claude Code | 環境変数でURL管理 |
| **Phase 2** | Gemini API接続 + 固定プロンプトで呪文生成確認 | Claude Code (要確認) | ハルシネーション注意 |
| **Phase 3** | Unity Microphone録音 + WAV変換 (44100→16000Hz) | Claude Code | サンプルレート要確認 |
| **Phase 3** | Speech-to-Text連携 + 認識テキスト表示 | Claude Code | word_time_offsets必要 |
| **Phase 3** | librosa + rapidfuzz評価ロジック | Claude Code (要確認) | librosaはコンテナ重い |
| **Phase 4** | EvaluationResult → spell_power変換 → エフェクト | **人間が設計** | 変換式は人間が決める |
| **Phase 5** | デモ演出 + リザルト画面 | Claude Code | 30秒フローで確認 |

---

## API レスポンスモデル (実際の設計)

Unity側で受け取るJSONの正確な構造。[[AI-Grimoire/tech/API設計]] より。

```csharp
// EvaluationResult.cs (Unity側のデシリアライズ用)
[Serializable]
public class EvaluationResult
{
    public string transcript;       // STT認識テキスト
    public float match_rate;        // 0.0-1.0 正解テキストとの一致率
    public string volume;           // "loud" / "normal" / "quiet"
    public float speed_wpm;         // 詠唱速度 (WPM)
    public float completion_rate;   // 0.0-1.0 詠唱完了率
    public int hesitation_count;    // 詰まり・無音区間数
    public float confidence;        // STT信頼度
    public string gm_comment;       // AIゲームマスターのコメント (30字以内)
    public float spell_power;       // 最終威力倍率
}
```

**spell_power変換式** (サーバー側で計算済み・Unity側で調整不可):
```
spell_power = base_power
  × (0.5 + match_rate × 1.0)   // 一致率: 0.5〜1.5
  × volume_factor               // loud=1.3, normal=1.0, quiet=0.8
  × speed_factor                // fast=1.2, normal=1.0, slow=0.9
  × completion_rate             // 0.0〜1.0
```

→ 変換式のチューニングは人間が `音声評価ロジック.md` の factor を調整する。

---

## Unity プロジェクト構成 (MVP最小)

```
Assets/Scripts/
  Audio/
    VoiceRecorder.cs        ← Microphone録音 (16000Hz, mono)
    AudioClipToWav.cs       ← AudioClip → byte[] (WAV, 16bit)
  Network/
    SpellApiClient.cs       ← POST /evaluate (UnityWebRequest)
    EvaluationResult.cs     ← デシリアライズ用モデル
  Game/
    SpellCaster.cs          ← 録音→API→エフェクト統括
    SpellEffectApplier.cs   ← spell_power → パーティクル強度変換
    SpellData.cs            ← 正解テキスト・難易度・属性 (ScriptableObject)
  UI/
    SpellFeedbackUI.cs      ← match_rate, gm_comment表示
    RecordingIndicatorUI.cs ← 録音中インジケーター
  Debug/
    MockSpellApiClient.cs   ← APIなしでゲームテスト用
  Config/
    ApiConfig.cs            ← URL・タイムアウト等 (ScriptableObject)
```

**DI構成 (VContainer)**:
```csharp
public class GameLifetimeScope : LifetimeScope
{
    [SerializeField] ApiConfig config;

    protected override void Configure(IContainerBuilder builder)
    {
        if (config.useMock)
            builder.Register<ISpellApiClient, MockSpellApiClient>(Lifetime.Singleton);
        else
            builder.Register<ISpellApiClient>(
                _ => new SpellApiClient(config.apiUrl, config.timeoutMs),
                Lifetime.Singleton);

        builder.RegisterComponent(config);
        builder.Register<SpellCaster>(Lifetime.Singleton);
    }
}
```

---

## Cloud Run バックエンド構成 (MVP最小)

```
server/
  main.py
  routers/
    evaluate.py         ← POST /evaluate
    spell.py            ← POST /generate-spell (Phase 2)
  services/
    stt_service.py      ← Google Cloud Speech-to-Text
    audio_analyzer.py   ← librosa (音量・速度・詰まり・感情量)
    text_matcher.py     ← rapidfuzz (一致率計算)
    gemini_service.py   ← Gemini (gm_comment生成)
  models/
    evaluation.py       ← EvaluationRequest / EvaluationResponse
  config.py             ← 環境変数 (GEMINI_API_KEY, GOOGLE_CLOUD_PROJECT)
  Dockerfile
  requirements.txt      ← fastapi, librosa, rapidfuzz, google-cloud-speech
```

**ローカル開発**: `http://localhost:8080` → Cloud Run本番: 環境変数で切替

---

## AIが壊しやすい箇所 (AI Grimoire固有)

| 箇所 | 破壊パターン | 対策 |
|------|------------|------|
| `VoiceRecorder.cs` | サンプルレートを44100のままAPIに渡す | CLAUDE.mdに「Unity録音は16000Hz指定、またはlibrosで再サンプリングをサーバー側で行う」と記載 |
| `AudioClipToWav.cs` | マルチチャンネルのデータをそのまま渡す | 「モノラル(channels=1)のみ」をCLAUDE.mdに記載 |
| `SpellApiClient.cs` | multipart/form-data のboundary設定ミス | UnityWebRequest.Postの第2引数にList<IMultipartFormSection>を使う正しいパターンを指定 |
| EvaluationResult デシリアライズ | snake_case (match_rate) を camelCase (matchRate) で定義してしまう | `[Serializable]`クラスはサーバーのJSONキーと完全一致させる。CLAUDE.mdに記載 |
| `SpellEffectApplier.cs` | spell_powerを直接パーティクル強度に使う (範囲0〜∞) | 想定範囲 (0.5〜2.0) を CLAUDE.mdに明記。Mathf.Clampで制限 |
| タイムアウト処理 | STT+librosa+Geminiで2〜5秒かかるのにUIが固まる | キャンセルトークン + "評価中..." ローディングUIを必ずセットで実装させる |
| librosaのコールドスタート | Cloud Run コンテナ起動時にlibrosが遅い | Dockerfileにウォームアップリクエスト用のhealthエンドポイントを含める |

---

## デバッグ戦略

### モックAPIでゲームを先に完成させる

音声認識とゲームロジックを切り離す。**Geminiが返すJSONのスキーマが固まるまでモックで開発する。**

```csharp
// MockSpellApiClient.cs — Inspectorから値を調整できる
public class MockSpellApiClient : ISpellApiClient
{
    [Header("Mock Values")]
    public float mockMatchRate = 0.85f;
    public string mockVolume = "loud";
    public string mockGmComment = "なかなか！もっと大きく叫べ！";
    public float mockSpellPower = 1.35f;

    public async UniTask<EvaluationResult> EvaluateAsync(
        byte[] wav, string spellText, string sessionId, CancellationToken ct)
    {
        await UniTask.Delay(800, cancellationToken: ct); // API遅延シミュレーション
        return new EvaluationResult
        {
            transcript = spellText,
            match_rate = mockMatchRate,
            volume = mockVolume,
            gm_comment = mockGmComment,
            spell_power = mockSpellPower,
            completion_rate = 1.0f
        };
    }
}
```

### ログ設計 (タグ付き)

```csharp
Debug.Log($"[VoiceRecorder] 録音開始: deviceName={deviceName}, freq=16000Hz");
Debug.Log($"[VoiceRecorder] 録音完了: {wavBytes.Length} bytes, {durationSec:F1}sec");
Debug.Log($"[SpellApiClient] POST {url} 開始 (timeout={timeoutMs}ms)");
Debug.Log($"[EvaluationResult] power={result.spell_power:F2}, match={result.match_rate:F2}, latency={latencyMs}ms");
Debug.LogWarning($"[SpellApiClient] タイムアウト: {timeoutMs}ms 経過");
Debug.LogError($"[SpellApiClient] 接続エラー: {req.error}");
```

---

## 実戦投入レベルと評価軸 (システム別)

| システム | 実戦投入レベル | MVP必須度 | AI実装適性 | 人間が実装すべき箇所 |
|---------|-------------|---------|-----------|------------------|
| VoiceRecorder | 罠多いが実装は短い | **必須** | 中 (サンプルレート罠) | 録音開始/停止のUX、デバイス選択 |
| AudioClipToWav | OSSコードで十分 | **必須** | 高 (SavWav等流用) | なし (既存ライブラリ使用) |
| SpellApiClient | HTTP通信は標準的 | **必須** | 高 | タイムアウト値の決定 |
| EvaluationResult | モデル定義のみ | **必須** | 高 (スキーマ固定後) | フィールド名の確定 |
| MockSpellApiClient | テスト分離の鍵 | **必須** | 高 | Inspector上の調整値 |
| SpellEffectApplier | ゲームの核心 | **必須** | 低 | spell_power→演出の変換式全体 |
| SpellData (SO) | 呪文定義 | **必須** | 中 | 呪文テキスト・難易度設計 |
| 音声評価ロジック (Python) | STT+librosa+rapidfuzz | **必須** | 中 (スキーマ要確認) | 評価係数・閾値・factor設計 |
| Gemini gm_comment | 核心ロジック | **必須** | 低 | プロンプト全体・キャラクター性 |
| Firestore永続化 | セッションログ | MVP後 | 高 | コレクション設計 |
| TTS音声読み上げ | 魔導書の声 | MVP後 | 高 | 音声キャラクター設計 |
| /master-judge | AIゲームマスター | MVP後 | 低 | 次フロア設計ロジック |

---

## CLAUDE.md テンプレート (AI Grimoire用)

```markdown
# AI Grimoire — CLAUDE.md

## プロジェクト
2Dローグライクアクション。声で魔法を詠唱してAIが評価する。
ハッカソンデモ用。ターゲット: Windows PC スタンドアロン
Unity 2022.3 LTS, URP 2D, New Input System

## アーキテクチャ
- DI: VContainer (Zenjectは使わない)
- 非同期: UniTask (Coroutine・System.Tasks禁止)
- イベント: R3 (UniRx禁止)
- HTTP: UnityWebRequest + UniTask

## 音声録音
- Unity Microphone API使用
- サンプルレート: 16000Hz (Speech-to-Textの推奨値)
- チャンネル: モノラル (1)
- フォーマット: WAV Linear16 16bit
- 最大録音時間: 15秒
- サーバー側でlibros経由で自動リサンプリングするため、
  Unity側でリサンプリングは不要 (44100Hzで録音しても可)

## API通信
- ローカル開発URL: http://localhost:8080
- 本番URL: Cloud Run URL (ApiConfig ScriptableObjectで管理)
- エンドポイント: POST /evaluate (multipart/form-data)
- タイムアウト: 5000ms (STT+librosa+Geminiで2〜5秒かかる)
- CancellationToken必須
- エラー時は UnityWebRequest.Result で分岐

## EvaluationResult フィールド名 (snake_case厳守)
- transcript (string)
- match_rate (float)
- volume (string: "loud"/"normal"/"quiet")
- speed_wpm (float)
- completion_rate (float)
- hesitation_count (int)
- confidence (float)
- gm_comment (string)
- spell_power (float: 通常 0.5〜2.0)

## 禁止事項
- Coroutineとasync/awaitの混在
- Resources.Load (SpellDataはScriptableObjectで参照)
- DOTS/ECS
- static event (R3 Subject経由でイベント発行)
- EvaluationResultフィールドをcamelCaseで定義 (JSONと不一致になる)

## モック設定
ApiConfig.useMock = true の時はMockSpellApiClientを使用
デフォルトtrue (Cloud Run接続前はモックで開発)
```

---

## 次のアクション (優先順)

1. **今すぐ**: Unityプロジェクト作成 + CLAUDE.mdを上記テンプレートで作成
2. **Phase 1**: `SpellData.cs` (ScriptableObject) → `VoiceRecorder.cs` → `AudioClipToWav.cs` の順でClaude Codeに生成させる
3. **Phase 1**: キーボード (Space) で仮発動が動くことをプレイテストで確認
4. **Phase 2**: FastAPI骨格 + `/evaluate` モックレスポンス → Dockerize → ローカル起動確認
5. **Phase 2**: UnityからPOST → モックJSONが届くことをConsoleログで確認
6. **Phase 3**: Speech-to-Text連携 → 自分の声が認識できることを確認
7. **評価係数チューニング**: 実際に詠唱してspell_powerが体感と合うまで人間が調整
8. **Phase 5**: デモ30秒フローを通し確認

---

## 関連設計書 (AI-Grimoire vault内)

- [[AI-Grimoire/06_MVP開発計画]] — フェーズ別タスクボード
- [[AI-Grimoire/05_技術構成]] — 全体アーキテクチャ図
- [[AI-Grimoire/tech/API設計]] — エンドポイント詳細・UnityWebRequestコード例
- [[AI-Grimoire/tech/音声評価ロジック]] — librosa・rapidfuzz実装詳細
- [[AI-Grimoire/08_リスクと対策]] — ハッカソン向けリスク管理

---

## 出典

- (Source: AI-Grimoire/06_MVP開発計画.md)
- (Source: AI-Grimoire/tech/API設計.md)
- (Source: AI-Grimoire/tech/音声評価ロジック.md)
- (Source: github.com/hadashiA/VContainer)
- (Source: cloud.google.com/speech-to-text)
- (Source: librosa.org)
