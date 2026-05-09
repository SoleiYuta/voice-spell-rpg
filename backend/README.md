# backend/

FastAPI バックエンドディレクトリ。**現在未作成。**

フェーズ2 (WAV → FastAPI ローカル) 以降に配置する。

## 配置予定構造

```
backend/
├── main.py               FastAPI エントリポイント
├── routers/
│   ├── evaluate.py       POST /evaluate
│   ├── generate_spell.py POST /generate-spell
│   ├── master_judge.py   POST /master-judge
│   └── result.py         GET /result/{session_id}
├── models/               Pydantic スキーマ
├── services/             STT / Gemini / Firestore クライアント
├── requirements.txt
├── Dockerfile            Cloud Run デプロイ用 (フェーズ6以降)
└── .env.example          APIキーテンプレート (.env は .gitignore済み)
```

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
