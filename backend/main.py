import asyncio
import io
import json
import logging
import os
import time
from typing import Optional

import numpy as np
import librosa
from pydub import AudioSegment
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import speech
from google import genai
from google.genai import types
from rapidfuzz import fuzz

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS: フロント（ブラウザ）から直接叩けるようにする。
# MVPは全オリジン許可。本番でフロントのドメインが決まったら絞る。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

stt_client = speech.SpeechClient()
gemini_client = genai.Client(
    vertexai=True,
    project="voicespellrpg",
    location="asia-northeast1",
)

SPELL_TYPES = ["fire", "ice", "thunder", "dark", "light", "wind"]
FALLBACK_SPELL = {
    "spell_text": "我が手に宿れ、紅蓮の焔よ",
    "difficulty": 2,
    "spell_type": "fire",
    "expected_length_sec": 3.0,
}


class PlayerProfile(BaseModel):
    avg_match_rate: float = 0.0
    avg_volume: str = "normal"
    avg_speed: str = "normal"
    weak_pattern: str = ""
    strong_pattern: str = ""


class GenerateSpellRequest(BaseModel):
    session_id: str = ""
    floor_id: str = ""
    player_profile: Optional[PlayerProfile] = None


class SpellData(BaseModel):
    spell_text: str
    difficulty: int
    spell_type: str
    expected_length_sec: float


def to_wav_16k_mono(raw: bytes) -> bytes:
    """ブラウザ録音(webm/opus 等)を STT/librosa が確実に扱える WAV(16kHz/mono/16bit)へ変換。
    フロントは MediaRecorder の既定(webm/opus)で送ってくるため、ここで正規化する。
    """
    seg = AudioSegment.from_file(io.BytesIO(raw))
    seg = seg.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    out = io.BytesIO()
    seg.export(out, format="wav")
    return out.getvalue()


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
    raw = await audio_file.read()
    loop = asyncio.get_event_loop()
    try:
        wav_bytes = await loop.run_in_executor(None, lambda: to_wav_16k_mono(raw))
    except Exception as e:
        logger.warning(f"transcode failed ({e}); raw bytes をそのまま使用")
        wav_bytes = raw
    logger.info(f"[timing] read+transcode={time.time()-t0:.2f}s")

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


def _parse_floor(floor_id: str) -> int:
    digits = "".join(c for c in (floor_id or "") if c.isdigit())
    return int(digits) if digits else 1


def generate_spell(profile: Optional[PlayerProfile], floor_num: int) -> dict:
    if profile:
        prof_desc = (
            f"- 平均一致率: {profile.avg_match_rate:.0%}\n"
            f"- 平均音量: {profile.avg_volume}\n"
            f"- 得意: {profile.strong_pattern or '不明'}\n"
            f"- 苦手: {profile.weak_pattern or '不明'}"
        )
    else:
        prof_desc = "（初回・傾向データなし。標準的な難易度で）"

    prompt = f"""あなたはプレイヤーの才能を見抜く魔導書の精霊。次の試練の呪文を1つ生成せよ。

フロア{floor_num}。プレイヤーの傾向:
{prof_desc}

方針:
- 得意は伸ばし、苦手は少しだけ挑戦させる難易度にする
- フロアが進むほど難しく（長め・発音難）
- 声に出して詠唱したくなる、厨二病で格好いい日本語の呪文（1〜2文・40字以内目安）
- difficulty は 1〜5（フロア{floor_num}相当）、spell_type は {"/".join(SPELL_TYPES)} のいずれか
- expected_length_sec は詠唱想定秒数（1.5〜6.0）

JSON で spell_text, difficulty, spell_type, expected_length_sec を返せ。"""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=SpellData,
            ),
        )
        data = json.loads(response.text)
        return {
            "spell_text": str(data.get("spell_text") or FALLBACK_SPELL["spell_text"]).strip(),
            "difficulty": max(1, min(5, int(data.get("difficulty", 2)))),
            "spell_type": data.get("spell_type") if data.get("spell_type") in SPELL_TYPES else "fire",
            "expected_length_sec": round(max(1.0, min(8.0, float(data.get("expected_length_sec", 3.0)))), 1),
        }
    except Exception as e:
        logger.warning(f"generate_spell error: {e}")
        return dict(FALLBACK_SPELL)


@app.post("/generate-spell")
async def generate_spell_endpoint(req: GenerateSpellRequest):
    t0 = time.time()
    floor_num = _parse_floor(req.floor_id)
    loop = asyncio.get_event_loop()
    spell = await loop.run_in_executor(
        None, lambda: generate_spell(req.player_profile, floor_num)
    )
    logger.info(f"[timing] generate-spell={time.time()-t0:.2f}s floor={floor_num}")
    return spell
