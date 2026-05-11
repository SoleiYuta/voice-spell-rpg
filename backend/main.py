from fastapi import FastAPI, File, Form, UploadFile

app = FastAPI()


@app.post("/evaluate")
async def evaluate(
    audio_file: UploadFile = File(...),
    spell_text: str = Form(""),
    session_id: str = Form(""),
    floor_id: str = Form(""),
):
    # Phase 2: mock response (STT/librosa added in Phase 3+)
    return {
        "transcript": "闇よ、我が右手に宿れ！",
        "match_rate": 0.87,
        "volume": "loud",
        "speed_wpm": 180.5,
        "completion_rate": 1.0,
        "hesitation_count": 1,
        "confidence": 0.92,
        "gm_comment": "大声が得意だな！だが速さはまだまだだ。",
        "spell_power": 1.42,
    }
