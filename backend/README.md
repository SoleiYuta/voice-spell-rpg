# backend/

FastAPI バックエンドディレクトリ。**実装済み**（`/evaluate` 稼働）。

AI向けの指示・タスク・規約は `AGENTS.md` を参照（Claude Code/Codexはこれを自動で読む）。

## 現状の構成

```
backend/
├── main.py            FastAPI 本体（/evaluate 実装済み: STT+librosa+Gemini）
├── requirements.txt
├── Dockerfile         Cloud Run デプロイ用
└── AGENTS.md          AI向け指示（タスク・規約）
```

未実装（これから）：`/generate-spell`・`/result`・webm→WAV変換・CORS・Firestore。詳細は `AGENTS.md`。

## ローカル開発

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Docker は **Cloud Run デプロイ時のみ** 使用する。ローカル開発は venv で十分。

## 設計ドキュメント

- `wiki/AI-Grimoire/tech/API設計` — エンドポイント仕様
- `wiki/AI-Grimoire/tech/音声評価ロジック` — rapidfuzz/librosa パイプライン
- `wiki/AI-Grimoire/tech/バックエンド構成` — FastAPI / Cloud Run 詳細
- `wiki/AI-Grimoire/tech/Google Cloud構成` — Secret Manager / IAM
