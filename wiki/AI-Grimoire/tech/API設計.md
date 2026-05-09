---
title: "API設計"
tags:
  - ai-grimoire
  - tech-research
  - api
  - unity
created: 2026-05-10
---

# API設計

AI魔導書API（Cloud Run上のFastAPI）のエンドポイント設計と、UnityからのHTTP呼び出し方法をまとめる。

---

## API全体設計方針

- **REST（JSON + multipart）** を採用。gRPC は複雑すぎるのでハッカソンでは使わない
- **ステートレス設計**：Cloud Run の複数インスタンス対応のため、セッション状態は Firestore に持つ
- **エラーは常に JSON で返す**：Unity 側でパースしやすい形に統一
- **認証はハッカソン期間中は省略**（本番では Firebase Auth JWT 検証を追加）

---

## エンドポイント一覧

### `POST /evaluate`

**役割：** 音声ファイルを受け取り、Speech-to-Text + 詠唱評価スコアを返す

#### リクエスト（multipart/form-data）

| フィールド | 型 | 内容 |
|---|---|---|
| `audio_file` | File（WAV） | 録音された詠唱音声 |
| `spell_text` | string | 正解の呪文テキスト |
| `session_id` | string | セッションID |
| `floor_id` | string | フロアID |

#### レスポンス（JSON）

```json
{
  "transcript": "闇よ、我が右手に宿れ！",
  "match_rate": 0.87,
  "volume": "loud",
  "speed_wpm": 180.5,
  "completion_rate": 1.0,
  "hesitation_count": 1,
  "confidence": 0.92,
  "gm_comment": "大声が得意だな！だが速さはまだまだだ。",
  "spell_power": 1.42
}
```

---

### `POST /generate-spell`

**役割：** プレイヤーの評価履歴を受け取り、次の呪文を生成して返す

#### リクエスト（JSON）

```json
{
  "session_id": "abc-123",
  "floor_id": "floor-3",
  "player_profile": {
    "avg_match_rate": 0.82,
    "avg_volume": "loud",
    "avg_speed": "slow",
    "weak_pattern": "long_sentences",
    "strong_pattern": "loud_voice"
  }
}
```

#### レスポンス（JSON）

```json
{
  "spell_text": "我が右手の業火よ、敵を灰に還せ！",
  "difficulty": 3,
  "spell_type": "fire",
  "expected_length_sec": 3.5
}
```

---

### `POST /master-judge`

**役割：** フロアクリア後のログを渡し、AIゲームマスターが次フロアを設計する

#### リクエスト（JSON）

```json
{
  "session_id": "abc-123",
  "completed_floor": {
    "floor_id": "floor-3",
    "spell_text": "...",
    "evaluation": { "match_rate": 0.87, "volume": "loud" },
    "cleared": true
  }
}
```

#### レスポンス（JSON）

```json
{
  "next_spell": {
    "text": "嗚呼、星よ、今こそ我が魂を解き放て！",
    "difficulty": 4
  },
  "enemy_config": {
    "count": 2,
    "speed": "fast"
  },
  "reward_tier": "rare",
  "gm_comment": "速さで詰まっていたな。今度は長文で試してみろ。"
}
```

---

### `GET /result/{session_id}`

**役割：** セッション終了後の総評を返す

#### レスポンス（JSON）

```json
{
  "session_id": "abc-123",
  "total_floors": 5,
  "best_floor": {
    "floor_id": "floor-2",
    "spell_text": "...",
    "spell_power": 1.85
  },
  "strong_style": "大声・短文詠唱",
  "weak_style": "長文・早口",
  "ai_review": "お前は荒々しい魔法使いだ。力はある。だが繊細さに欠ける。精進せよ。",
  "overall_score": 78
}
```

---

## UnityからのHTTP API呼び出し方法

### 基本パターン（UnityWebRequest）

Unityでは `UnityWebRequest` を使ってHTTP通信を行う。コルーチンまたはasync/awaitで記述する。

#### JSONリクエスト（POST）

```csharp
// イメージ（詳細はUnityドキュメント参照）
IEnumerator PostJSON(string url, string jsonBody)
{
    UnityWebRequest req = new UnityWebRequest(url, "POST");
    byte[] body = Encoding.UTF8.GetBytes(jsonBody);
    req.uploadHandler = new UploadHandlerRaw(body);
    req.downloadHandler = new DownloadHandlerBuffer();
    req.SetRequestHeader("Content-Type", "application/json");
    yield return req.SendWebRequest();
    // req.downloadHandler.text でレスポンスを取得
}
```

#### 音声ファイルアップロード（multipart/form-data）

```csharp
// イメージ（詳細はUnityドキュメント参照）
IEnumerator PostAudio(string url, byte[] wavBytes, string spellText)
{
    List<IMultipartFormSection> form = new List<IMultipartFormSection>
    {
        new MultipartFormFileSection("audio_file", wavBytes, "recording.wav", "audio/wav"),
        new MultipartFormDataSection("spell_text", spellText),
        new MultipartFormDataSection("session_id", sessionId)
    };
    UnityWebRequest req = UnityWebRequest.Post(url, form);
    yield return req.SendWebRequest();
}
```

### マイク録音からWAVバイト列を取得する方法

1. `Microphone.Start(null, false, recordingSeconds, 44100)` で録音開始
2. `Microphone.End(null)` で録音停止、`AudioClip` を取得
3. AudioClip のサンプルデータを WAV バイト列に変換（自前変換 or フリーライブラリ）
4. `byte[]` を `MultipartFormFileSection` に渡す

> 注意：Unity の `AudioClip` → WAV 変換は標準では提供されていない。WAV書き出しユーティリティが必要（要確認：SavWav等の定番スクリプトを使う）。

### レスポンスのJSONパース

```csharp
// JsonUtility または Newtonsoft.Json（要パッケージ追加）を使用
EvaluationResult result = JsonUtility.FromJson<EvaluationResult>(req.downloadHandler.text);
```

### エラーハンドリング

```
req.result == UnityWebRequest.Result.Success → 成功
req.result == UnityWebRequest.Result.ConnectionError → Cloud Run 到達不可
req.result == UnityWebRequest.Result.ProtocolError → 4xx / 5xx エラー
```

---

## 音声ファイルアップロード設計

### 設計比較

| 方式 | 方法 | メリット | デメリット |
|---|---|---|---|
| **直接POST（採用）** | multipart/form-data で WAV を Cloud Run に直接送信 | シンプル、追加インフラ不要 | 音声が大きいと遅い |
| Base64 エンコード | JSON に base64 で埋め込む | 実装が簡単 | サイズが1.33倍になる |
| GCS Signed URL | GCS に直接アップロード後、URLをAPIに渡す | 大容量向き | 実装が2ステップで複雑 |

**ハッカソン推奨：直接POST方式**（シンプルさ優先）

### 音声フォーマット統一

| 項目 | 設定値 |
|---|---|
| フォーマット | WAV（LINEAR16） |
| サンプルレート | 16,000 Hz（16kHz） |
| チャンネル | モノラル（1ch） |
| ビット深度 | 16bit |
| 最大録音時間 | 15秒（それ以上は制限） |

> Speech-to-Text の推奨フォーマット。Unityの録音サンプルレートは44100Hzなので、サーバー側で16kHzにリサンプリングするか、Unity側でリサンプリングする必要がある（要確認）。

---

## 実装時の注意点

- Cloud Run の URL は環境変数で管理（ハードコード禁止）
- タイムアウトを適切に設定する（音声認識は2〜5秒かかる）
- ローカル開発時は `http://localhost:8080`、本番は Cloud Run の URL に切り替える仕組みを用意
- Unity の WebGL ビルドでは `UnityWebRequest` の動作が異なる場合があるため注意

---

## 関連ノート

- [[tech/バックエンド構成]]
- [[tech/AI側技術調査]]
- [[tech/音声評価ロジック]]
- [[02_ゲームシステム]]
- [[03_AIエージェント設計]]
