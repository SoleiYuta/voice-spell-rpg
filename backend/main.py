import asyncio
import io
import logging
import os
import time
import numpy as np
import librosa
from fastapi import FastAPI, File, Form, UploadFile
from google.cloud import speech
from google import genai
from rapidfuzz import fuzz

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
stt_client = speech.SpeechClient()
gemini_client = genai.Client(
    vertexai=True,
    project="voicespellrpg",
    location="asia-northeast1",
)


def transcribe(wav_bytes: bytes) -> tuple[str, float]:
    audio = speech.RecognitionAudio(content=wav_bytes)
    config = speech.RecognitionConfig(
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


def analyze_audio(wav_bytes: bytes) -> dict:
    y, sr = librosa.load(io.BytesIO(wav_bytes), sr=16000, mono=True)

    # 無音区間を除いた発話部分を抽出
    intervals = librosa.effects.split(y, top_db=30)
    if len(intervals) == 0:
        return {"volume": "quiet", "speed_wpm": 0.0, "hesitation_count": 0}

    speech_samples = np.concatenate([y[s:e] for s, e in intervals])
    speech_duration_sec = len(speech_samples) / sr

    # 音量（RMS）
    rms = float(np.sqrt(np.mean(speech_samples ** 2)))
    if rms > 0.05:
        volume = "loud"
    elif rms > 0.01:
        volume = "normal"
    else:
        volume = "quiet"

    # 詰まり回数（無音区間の数 - 1）
    hesitation_count = max(0, len(intervals) - 1)

    # 速度は後でSTT word_time_offsets から計算（今は0）
    return {
        "volume": volume,
        "speed_wpm": round(60.0 / speech_duration_sec, 1) if speech_duration_sec > 0 else 0.0,
        "hesitation_count": hesitation_count,
    }


def generate_gm_comment(transcript: str, match_rate: float, volume: str, spell_power: float) -> str:
    prompt = f"""あなたは古代魔導書に宿る皮肉屋の精霊です。
プレイヤーの詠唱結果を見て、一言コメントしてください。
- 認識テキスト: {transcript}
- 一致率: {match_rate:.0%}
- 音量: {volume}
- 詠唱威力: {spell_power}
日本語50文字以内で、褒め・煽り・挑発を混ぜた口調で。"""
    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        logger.warning(f"Gemini error: {e}")
        return "魔導書が沈黙している……"


def calc_spell_power(match_rate: float, volume: str, completion_rate: float) -> float:
    volume_factor = {"loud": 1.3, "normal": 1.0, "quiet": 0.8}.get(volume, 1.0)
    return round((0.5 + match_rate) * volume_factor * completion_rate, 2)


@app.post("/evaluate")
async def evaluate(
    audio_file: UploadFile = File(...),
    spell_text: str = Form(""),
    session_id: str = Form(""),
    floor_id: str = Form(""),
):
    t0 = time.time()
    wav_bytes = await audio_file.read()
    logger.info(f"[timing] read={time.time()-t0:.2f}s")

    loop = asyncio.get_event_loop()
    t1 = time.time()
    (transcript, confidence), audio = await asyncio.gather(
        loop.run_in_executor(None, lambda: transcribe(wav_bytes)),
        loop.run_in_executor(None, lambda: analyze_audio(wav_bytes)),
    )
    logger.info(f"[timing] stt+librosa={time.time()-t1:.2f}s")

    match_rate = calc_match_rate(spell_text, transcript)
    completion_rate = round(min(len(transcript) / max(len(spell_text), 1), 1.0), 2)
    spell_power = calc_spell_power(match_rate, audio["volume"], completion_rate)

    t2 = time.time()
    gm_comment = await loop.run_in_executor(
        None, lambda: generate_gm_comment(transcript, match_rate, audio["volume"], spell_power)
    )
    logger.info(f"[timing] gemini={time.time()-t2:.2f}s total={time.time()-t0:.2f}s")

    return {
        "transcript": transcript,
        "match_rate": round(match_rate, 2),
        "volume": audio["volume"],
        "speed_wpm": audio["speed_wpm"],
        "completion_rate": completion_rate,
        "hesitation_count": audio["hesitation_count"],
        "confidence": round(confidence, 2),
        "gm_comment": gm_comment,
        "spell_power": spell_power,
    }
