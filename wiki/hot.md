---
type: meta
title: "Hot Cache"
updated: 2026-05-11
tags: [meta, hot-cache]
---

# 現在フェーズ: フェーズ1 — 録音 → WAV変換

**状態**: フェーズ0完了 (2026-05-11) → フェーズ1着手

---

## フェーズ進捗

- [x] フェーズ0: Mock完結 ✅ (ブランチ: `feature/phase0-mock`)
- [ ] フェーズ1: 録音 → WAV変換 ← **今ここ**
- [ ] フェーズ2: WAV → FastAPIローカル
- [ ] フェーズ3: STT接続
- [ ] フェーズ4: librosa音響評価
- [ ] フェーズ5: Gemini gm_comment
- [ ] フェーズ6: Cloud Runデプロイ

---

## フェーズ0で確定した実装方針（変更禁止）

- DI: VContainer **未使用**。`SerializeField` + Inspector配線で代替（VContainerはMVP後に検討）
- Coroutine のみ使用（UniTask は未インストール）
- `EvaluationResult` フィールドは snake_case 厳守
- `ApiConfig.useMock = true` のままコミット
- スクリプト配置: `Assets/Scripts/{Api,Config,Data,Game,UI}/`

---

## 今やること（フェーズ1）

```
[ボタン押下] → [Microphone.Start()] → [ボタン離す] → [AudioClip→WAV変換] → [SpellCaster.CastSpell(wavBytes)]
```

### 作るファイル

| ファイル | 場所 | 役割 |
|---|---|---|
| `MicrophoneRecorder.cs` | `Scripts/Game/` | Microphone.Start/Stop・AudioClip保持 |
| `WavConverter.cs` | `Scripts/Util/` | AudioClip → byte[] (WAV) 変換ユーティリティ |
| `RecordingButton.cs` | 既存を更新 | 押下で録音開始・離したら変換してCastSpell |

### 実装手順

1. `WavConverter.cs` を作る（静的メソッド `ToWav(AudioClip) → byte[]`）
2. `MicrophoneRecorder.cs` を作る
   - `StartRecording()` → `Microphone.Start(null, false, 15, 16000)`
   - `StopRecording()` → `Microphone.End(null)` → AudioClip を返す
3. `RecordingButton.cs` を更新
   - `OnPointerDown` → `MicrophoneRecorder.StartRecording()`
   - `OnPointerUp` → `StopRecording()` → `WavConverter.ToWav()` → `SpellCaster.CastSpell(wavBytes)`

### 注意点

- Unity の録音サンプルレートは 16000 Hz 固定で取る（FastAPI側でリサンプル不要にする）
- WAV変換は自前実装（Unity標準にはない）
- `Microphone` クラスは Editor では動作するが WebGL では制限あり（今は気にしない）
- フェーズ1終了時点でも `useMock = true` のまま（WAVバイト列はMockに渡るが無視される）

---

## 禁止事項

- DOTS/ECS 一切使わない
- Coroutine と UniTask を混在させない
- EvaluationResult のフィールドを camelCase にしない（snake_case 必須）
- `useMock = false` でコミットしない
- Firebase Auth / Docker は MVP後

---

## チーム状況

| 項目 | 内容 |
|---|---|
| Unity担当 | フェーズ1（録音実装）|
| FastAPI担当 | フェーズ2に向けて `/evaluate` エンドポイントのモック実装を先行可 |
| 今詰まっている箇所 | なし |
| 次に実装するもの | `WavConverter.cs` + `MicrophoneRecorder.cs` |

---

*詳細: [[TEAM_START_HERE]] | [[index]] | [[AI-Grimoire/06_MVP開発計画]] | [[AI-Grimoire/tech/API設計]]*
