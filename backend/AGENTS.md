# backend/ — Agent Instructions (FastAPI)

AI Grimoire のAPI。音声評価・呪文生成・総評を Google Cloud AI で行い、Cloud Run で公開する。

**必読：`../wiki/AI-Grimoire/tech/API設計.md` / `tech/音声評価ロジック.md` / `10_Web設計書.md`(§5 API契約)**

---

## 現状（実装済み）

- `main.py` に `POST /evaluate` 実装済み（STT + rapidfuzz一致率 + librosa音響解析 + Gemini `gm_comment`）
- Gemini は **Vertex AI 経由**（project=`voicespellrpg`, location=`asia-northeast1`）。**APIキーは使わない**
- STT: ja-JP / 解析: librosa（RMS音量・無音区間）/ `Dockerfile`（Cloud Run用）あり

## これから実装（担当: satoryudev）

- `POST /generate-spell` … `player_profile` から呪文生成（`SpellData` を返す）※**デモの核・最優先 [#12]**
- `GET /result/{session_id}` … セッション総評（`ResultData` を返す）[#13]
- **webm/opus → WAV 変換**：フロントは `webm` で音声を送る。ffmpeg導入済みなので変換してから STT/librosa に渡す
- **CORS ミドルウェア追加**：フロント（Next.js）のオリジンを許可
- Firestore セッションログ（generate-spell/result の入力に使う）

## 規約（厳守）

- **レスポンスのフィールドは snake_case 厳守**（`match_rate`, `spell_power` 等）
- 秘密情報を直書きしない（Vertex AIは project/ADC、Cloud Run URLは環境変数）
- Docker は Cloud Run デプロイ時のみ。ローカルは venv

## ローカル起動

```bash
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8080
```

## レスポンス型（フロントと共通契約・snake_case）

- `/evaluate` → transcript, match_rate, volume, speed_wpm, completion_rate, hesitation_count, confidence, gm_comment, spell_power
- `/generate-spell` → spell_text, difficulty, spell_type, expected_length_sec
- `/result/{session_id}` → session_id, total_floors, best_floor, strong_style, weak_style, ai_review, overall_score
