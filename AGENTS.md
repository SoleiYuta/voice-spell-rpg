# voice-spell-rpg: Agent Instructions

codename: AI Grimoire (仮) | 正式タイトル未定

音声で呪文を唱えて戦う2Dダンジョン探索ゲーム。
AIゲームマスターがプレイヤーの声を評価し、戦闘をリアルタイムで変化させる。

---

## リポジトリ構成

```
voice-spell-rpg/
├── wiki/AI-Grimoire/   設計・仕様ドキュメント
├── unity/              Unityプロジェクト (未作成)
└── backend/            FastAPIバックエンド (未作成)
```

## 実装前に必ず読む

- `wiki/AI-Grimoire/Unity責務分割` — スクリプト役割・DI設定
- `wiki/AI-Grimoire/SpellResultデータ構造` — フィールド名厳守 (snake_case)
- `wiki/AI-Grimoire/MockApiClient運用` — Mock切替手順
- `wiki/AI-Grimoire/tech/API設計` — エンドポイント仕様

## 現在フェーズ

フェーズ0: Mock完結 (録音なし・固定レスポンス)

```
[ボタン押下] → [MockApiClient] → [固定EvaluationResult] → [UI表示] → [敵HP減少]
```

## 禁止事項

- DOTS/ECS を使わない
- Coroutine と UniTask を混在させない
- EvaluationResult フィールドを camelCase にしない (snake_case 必須)
- `useMock = false` でコミットしない (フェーズ0終了まで)
- Unity EditorにDockerを使わない (DockerはCloud Runのみ)
- Firebase Auth / Docker はMVP後

## Git運用ルール

- main へ直接 push しない
- 作業は feature branch で行う
- merge 前に最低1人レビュー
- force push 禁止
- AI generated commit は内容確認後に commit
- hot.md / index.md を壊さない
- 大規模 rename は事前共有

## 技術スタック (確定)

| レイヤー | 技術 |
|---|---|
| クライアント | Unity + C# |
| バックエンド | FastAPI + Python (Cloud Run) |
| AI モデル | Gemini 2.5 Flash |
| 音声認識 | Speech-to-Text v2 (ja-JP, latest_short) |
| DB | Firestore |
| CI/CD | GitHub Actions |

詳細: `wiki/AI-Grimoire/tech/採用技術まとめ`
