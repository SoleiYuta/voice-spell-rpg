from fastapi import FastAPI, File, Form, UploadFile
from google.cloud import speech
from rapidfuzz import fuzz

app = FastAPI()
stt_client = speech.SpeechClient()


def transcribe(wav_bytes: bytes) -> tuple[str, float]:
    audio = speech.RecognitionAudio(content=wav_bytes)
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code="ja-JP",
        enable_word_time_offsets=True,
    )
    response = stt_client.recognize(config=config, audio=audio)
    if not response.results:
        return "", 0.0
    result = response.results[0].alternatives[0]
    return result.transcript, result.confidence


def calc_match_rate(spell_text: str, transcript: str) -> float:
    if not spell_text or not transcript:
        return 0.0
    return fuzz.ratio(spell_text, transcript) / 100.0


@app.post("/evaluate")
async def evaluate(
    audio_file: UploadFile = File(...),
    spell_text: str = Form(""),
    session_id: str = Form(""),
    floor_id: str = Form(""),
):
    wav_bytes = await audio_file.read()
    transcript, confidence = transcribe(wav_bytes)
    match_rate = calc_match_rate(spell_text, transcript)
    spell_power = round(0.5 + match_rate * 1.0, 2)

    return {
        "transcript": transcript,
        "match_rate": round(match_rate, 2),
        "volume": "normal",
        "speed_wpm": 0.0,
        "completion_rate": min(len(transcript) / max(len(spell_text), 1), 1.0),
        "hesitation_count": 0,
        "confidence": round(confidence, 2),
        "gm_comment": "詠唱を受け取った。",
        "spell_power": spell_power,
    }
