---
title: "AI側技術調査"
tags:
  - ai-grimoire
  - tech-research
  - gemini
  - speech-to-text
created: 2026-05-10
---

# AI側技術調査

AI Grimoire のバックエンドAI部分で使用する技術の調査ノート。

---

## 1. Gemini API

### 役割

呪文生成・詠唱評価コメント生成・AIゲームマスター判断の中核エンジン。

### 今回のゲームで使う理由

- 日本語の文章生成品質が高い
- Structured Output（JSON強制出力）に対応しており、ゲームロジックとの連携がシンプル
- Google Cloud製品（Cloud Run・Firestore等）との親和性が高くハッカソン要件に適合
- 無料ティアがあり、ハッカソン期間中はコストゼロで動かせる

### 主要モデル（2026年5月時点）

| モデル | 特徴 | 推奨用途 |
|---|---|---|
| **Gemini 3 Flash** | 高速・高コスパ、フロンティア性能 | 本企画のメイン候補 |
| **Gemini 2.5 Flash** | 低遅延・高ボリューム向け、枯れた安定版 | フォールバック候補 |
| Gemini 2.5 Flash-Lite | 最速・最安 | レート制限対策の軽量版 |
| Gemini 2.5 Pro | 最高性能、複雑なタスク向け | リザルト分析のみ（コスト高） |

> **要確認：** 最新モデル名・料金は公式ページで確認。2026年3月時点で gemini-2.0-flash は新規プロジェクト非推奨、2.5/3系を使用すること。

### 料金・レート制限

| 区分 | 内容 |
|---|---|
| 無料ティア | Google AI Studio 経由、RPM・TPD制限あり |
| 有料（Pay-as-you-go） | Vertex AI 経由または AI Studio課金 |
| ハッカソン向け | 無料ティアで十分（本番デプロイ後はモニタリング必須） |

- 公式料金: https://ai.google.dev/gemini-api/docs/pricing
- レート制限: https://ai.google.dev/gemini-api/docs/rate-limits

### Structured Output（JSON強制出力）

AIゲームマスターの出力をゲーム側で確実にパースするために必須の機能。

```
設定方法：
- response_mime_type = "application/json" を指定
- response_schema に Pydantic モデルまたは JSON Schema を渡す
- Gemini 2.5 / 3 系で動作確認済み
```

出力例（次フロア設計）：
```json
{
  "spell_text": "我が右手の業火よ、敵を灰に還せ！",
  "difficulty": 3,
  "enemy_count": 2,
  "reward_tier": "rare",
  "gm_comment": "大声が得意なようだな。では今度は速さで試してみろ。"
}
```

### 注意点

- Structured Output は大きすぎるスキーマや深すぎるネストで失敗することがある。シンプルなスキーマに保つ。
- Vertex AI 経由では IAM 認証（サービスアカウント）が必要。Google AI Studio 経由は APIキーで済む。
- **ハッカソン推奨：** Google AI Studio（APIキー認証）+ Gemini 3 Flash または 2.5 Flash

### メリット / デメリット

| メリット | デメリット |
|---|---|
| Structured Output が標準対応 | Vertex AI は設定が複雑 |
| 日本語生成品質が高い | 無料ティアのレート制限が厳しい場合あり |
| Google Cloud と連携しやすい | モデル名が頻繁に変わる（要最新確認） |
| マルチモーダル対応（将来拡張に有利） | |

### 公式ドキュメント

- API概要: https://ai.google.dev/gemini-api/docs
- モデル一覧: https://ai.google.dev/gemini-api/docs/models
- Structured Output: https://ai.google.dev/gemini-api/docs/structured-output
- Python SDK: https://googleapis.github.io/python-genai/

### ハッカソン最低限実装

- APIキー取得（Google AI Studio）
- Gemini 2.5 Flash or 3 Flash で呪文生成プロンプト作成
- Structured Output で JSON 返却

### 発展実装

- Vertex AI への移行（本番グレードのレート制限）
- System Instruction でAIゲームマスターのペルソナを強化
- ストリーミング出力でリアルタイムコメント表示

---

## 2. Google Cloud Speech-to-Text

### 役割

プレイヤーの詠唱音声をテキストに変換する。認識テキストを発音一致率計算・Gemini評価に渡す。

### 今回のゲームで使う理由

- 日本語（ja-JP）対応が安定している
- 音声の信頼スコア・単語タイムスタンプを返してくれる（詠唱評価に使える）
- Google Cloud製品なのでCloud Runとの連携がシンプル
- 月0〜60分は無料枠

### v1 vs v2

| 項目 | v1 | v2 |
|---|---|---|
| エンドポイント | シンプル | Recognizer リソースの事前作成が必要 |
| モデル | default, phone_call, video 等 | chirp, latest_long, latest_short 等 |
| ストリーミング | gRPC | gRPC（REST は非対応） |
| **推奨** | 既存プロジェクト | **新規プロジェクト推奨** |

> **ハッカソン推奨：** v2 + `latest_short` モデル（短文詠唱に最適）

### 料金

| 利用量 | 料金 |
|---|---|
| 月0〜60分 | **無料** |
| 60分超（標準） | $0.016 / 分（$0.004〜のボリューム割引あり） |
| Dynamic Batch | 標準より75%安い（最大24時間待ち） |

- 公式料金: https://cloud.google.com/speech-to-text/pricing

### 対応フォーマット

| フォーマット | 推奨 |
|---|---|
| LINEAR16（WAV 16bit） | 最も安定 |
| FLAC | 圧縮効率が良い |
| MP3, OGG_OPUS | 対応あり |
| **推奨サンプルレート** | **16kHz** |

> WAV ファイルはヘッダーにエンコード情報が含まれるため `encoding` フィールド省略可。

### 詠唱評価に使えるレスポンスフィールド

| フィールド | 使い方 |
|---|---|
| `transcript` | 認識テキスト（正解テキストと比較して一致率を算出） |
| `confidence` | 認識確信度 0〜1（音声の明瞭さの参考） |
| `words[].word` | 単語ごとの認識結果 |
| `words[].start_time / end_time` | 詠唱速度（WPM）の算出に使う |

### 注意点

- `confidence` は「聞き取れたか」の確信度であって「発音が正確か」の指標ではない
- ストリーミング認識は gRPC が必要。REST APIはバッチ（録音済み音声）のみ
- **ハッカソン向け：** 録音音声を POST するバッチ認識で十分。リアルタイムストリーミングはMVP後

### メリット / デメリット

| メリット | デメリット |
|---|---|
| 日本語精度が高い | ストリーミングには gRPC が必要 |
| 単語タイムスタンプ取得可能 | v2 は Recognizer 作成が一手間 |
| 無料枠あり | confidence は発音品質の指標にならない |

### 代替案

| 代替技術 | 特徴 |
|---|---|
| OpenAI Whisper（ローカル） | 高精度だが Cloud Run でのホスティングが重い |
| Azure Speech Services | GCP縛りがある場合は使えない |
| Web Speech API（ブラウザ） | Unity WebGL なら使えるが精度に難あり |

### 公式ドキュメント

- v2 概要: https://cloud.google.com/speech-to-text/v2/docs
- REST API: https://docs.cloud.google.com/speech-to-text/docs/reference/rest
- 料金: https://cloud.google.com/speech-to-text/pricing

### ハッカソン最低限実装

- `recognize`（バッチ）エンドポイントで WAV 音声を送信
- `transcript` と `words[].start_time` を取得
- 正解テキストとの一致率を文字列類似度で算出

### 発展実装

- gRPC ストリーミングでリアルタイム認識
- `word_time_offsets` で詠唱速度を精密計測
- 複数候補（alternatives）から最良スコアを選択

---

## 3. 音声評価アルゴリズム

### 役割

Speech-to-Text の出力テキスト・音声メタデータをもとに、詠唱の品質を数値化する。

### 評価指標と実装手法

| 評価指標 | 手法 | Pythonライブラリ |
|---|---|---|
| **発音一致率** | 正解テキスト vs STT テキストの文字列類似度（Levenshtein比） | `rapidfuzz` |
| **詠唱完了率** | 単語数 / 正解単語数 | STT の words フィールド |
| **詠唱速度（WPM）** | 単語数 / (end_time - start_time) | STT の word_time_offsets |
| **音量（RMS）** | 短時間フレームごとの二乗平均平方根 | `librosa.feature.rms` |
| **声の安定性** | 音量の標準偏差 | `librosa`, `numpy` |
| **詰まり・無音区間** | 無音区間（VAD）の検出と頻度 | `webrtcvad`, `librosa.effects.split` |
| **感情量（興奮度）** | ピッチ変動・音量変動を組み合わせた簡易スコア | `librosa.yin` |

### 実装方針（シンプル版）

```
1. Unity が音声を録音 → WAV で Cloud Run に POST
2. Speech-to-Text で テキスト変換
3. rapidfuzz.ratio(正解テキスト, 認識テキスト) → 発音一致率
4. librosa で RMS（音量）・ピッチを抽出
5. word_time_offsets から速度計算
6. 上記を JSON にまとめて Gemini にコメント生成依頼
```

### 注意点

- 日本語発音評価の研究ツールは英語に比べて少ない。シンプルな文字列類似度が現実的
- `librosa` はサーバーサイドで動かす（Cloud Run のコンテナに含める）
- 音声フォーマットは **16kHz・モノラル・WAV** に統一すること

### 公式・参考

- rapidfuzz: https://github.com/rapidfuzz/RapidFuzz
- librosa: https://librosa.org/doc/latest/index.html

---

## 4. LLMによる詠唱コメント生成

### 役割

評価スコアをもとに Gemini が「AIゲームマスターとしてのコメント」を日本語で生成する。

### 設計方針

- Gemini の Structured Output を使い、コメントと各種パラメータを JSON で同時に返す
- System Prompt でAIゲームマスターのペルソナ（古代魔導書の精霊）を定義
- Few-Shot Example を 2〜3 件入れて品質を安定させる

### Systemプロンプトの骨格

```
あなたは古代魔導書に宿る精霊です。
プレイヤーの詠唱ログを読み、次の内容をJSON形式で返してください。
- gm_comment: プレイヤーへの一言（日本語・50文字以内・煽り・褒め・挑発を混ぜる）
- next_spell_difficulty: 1〜5の整数
- next_spell_text: 次の呪文テキスト
- reward_tier: "common" | "rare" | "legendary"
コメントは全年齢向け。下ネタ・暴力表現は禁止。
```

### 注意点

- JSON スキーマは小さく保つ。プロパティ数は10以下が目安
- 日本語出力の指示は毎回プロンプトに明記する
- トークン節約のため評価スコアは小数点2桁で渡す

---

## 関連ノート

- [[03_AIエージェント設計]]
- [[04_音声詠唱評価項目]]
- [[tech/バックエンド構成]]
- [[tech/音声評価ロジック]]
- [[tech/Google Cloud構成]]

---

> 公式ドキュメントURL一覧
> - Gemini API: https://ai.google.dev/gemini-api/docs
> - Speech-to-Text v2: https://cloud.google.com/speech-to-text/v2/docs
> - Structured Output: https://ai.google.dev/gemini-api/docs/structured-output
