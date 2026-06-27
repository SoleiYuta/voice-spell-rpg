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


def _calc_speed_wpm(words) -> float:
    """STTの単語タイムスタンプから発話速度(WPM)を算出。
    最初の単語の開始〜最後の単語の終了を所要時間とし、単語数 / 秒 × 60。
    単語が1個以下・所要時間0なら測定不能として0.0。"""
    if len(words) < 2:
        return 0.0
    start = words[0].start_time.total_seconds()
    end = words[-1].end_time.total_seconds()
    duration = end - start
    if duration <= 0:
        return 0.0
    return round(len(words) / duration * 60.0, 1)


def transcribe(wav_bytes: bytes) -> tuple[str, float, float]:
    audio = speech.RecognitionAudio(content=wav_bytes)
    config = speech.RecognitionConfig(
        language_code="ja-JP",
        enable_word_time_offsets=True,
    )
    response = stt_client.recognize(config=config, audio=audio)
    if not response.results:
        return "", 0.0, 0.0
    result = response.results[0].alternatives[0]
    return result.transcript, result.confidence, _calc_speed_wpm(result.words)


def calc_match_rate(spell_text: str, transcript: str) -> float:
    if not spell_text or not transcript:
        return 0.0
    return fuzz.ratio(spell_text, transcript) / 100.0


def analyze_audio(wav_bytes: bytes) -> dict:
    y, sr = librosa.load(io.BytesIO(wav_bytes), sr=16000, mono=True)

    # 無音区間を除いた発話部分を抽出
    intervals = librosa.effects.split(y, top_db=30)
    if len(intervals) == 0:
        return {"volume": "quiet", "hesitation_count": 0}

    speech_samples = np.concatenate([y[s:e] for s, e in intervals])

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

    return {
        "volume": volume,
        "hesitation_count": hesitation_count,
    }


def generate_gm_comment(
    transcript: str,
    match_rate: float,
    volume: str,
    speed_wpm: float,
    hesitation_count: int,
    completion_rate: float,
    spell_power: float,
) -> str:
    vol_ja = {"loud": "大声", "normal": "普通の声", "quiet": "小声"}.get(volume, volume)
    prompt = f"""あなたは古代魔導書に宿る皮肉屋の精霊。プレイヤーの今の詠唱に一言だけ返せ。

実測:
- 認識テキスト: 「{transcript}」
- 一致率: {match_rate:.0%}
- 声量: {vol_ja}
- 速度: {speed_wpm} wpm
- 詰まり: {hesitation_count}回
- 完了率: {completion_rate:.0%}
- 詠唱威力: {spell_power}

ルール:
- 上の実測のうち最も目立つ点を1つ具体的に引用して、褒め・煽り・挑発を混ぜる（例「3回も噛んだな」「大声だけは一流だ」）
- 日本語1文・40字以内・皮肉屋の口調
- ラベル名（"一致率""声量"等）はそのまま書かず、自然な口語で"""
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
    (transcript, confidence, speed_wpm), audio = await asyncio.gather(
        loop.run_in_executor(None, lambda: transcribe(wav_bytes)),
        loop.run_in_executor(None, lambda: analyze_audio(wav_bytes)),
    )
    logger.info(f"[timing] stt+librosa={time.time()-t1:.2f}s")

    match_rate = calc_match_rate(spell_text, transcript)
    completion_rate = round(min(len(transcript) / max(len(spell_text), 1), 1.0), 2)
    spell_power = calc_spell_power(match_rate, audio["volume"], completion_rate)

    t2 = time.time()
    gm_comment = await loop.run_in_executor(
        None,
        lambda: generate_gm_comment(
            transcript,
            match_rate,
            audio["volume"],
            speed_wpm,
            audio["hesitation_count"],
            completion_rate,
            spell_power,
        ),
    )
    logger.info(f"[timing] gemini={time.time()-t2:.2f}s total={time.time()-t0:.2f}s")

    return {
        "transcript": transcript,
        "match_rate": round(match_rate, 2),
        "volume": audio["volume"],
        "speed_wpm": speed_wpm,
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
        vol_ja = {"loud": "大声", "normal": "普通の声", "quiet": "小声"}.get(
            profile.avg_volume, profile.avg_volume
        )
        prof_desc = (
            f"- 平均一致率: {profile.avg_match_rate:.0%}\n"
            f"- 平均声量: {vol_ja}\n"
            f"- 得意: {profile.strong_pattern or '不明'}\n"
            f"- 苦手: {profile.weak_pattern or '不明'}"
        )
    else:
        prof_desc = "（初回・傾向データなし。標準的な難易度で）"

    prompt = f"""あなたはプレイヤーの才能を見抜く魔導書の精霊。次の試練の呪文を1つ生成せよ。

フロア{floor_num}。プレイヤーの傾向:
{prof_desc}

方針:
- プレイヤーの傾向に合わせる：苦手を少しだけ克服させ、得意が活きる内容・難易度にする（傾向不明なら標準）
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


# ===== /result（リザルト診断）=====
# Firestore未使用のため、フロントが保持するセッション履歴を受け取って集計する。
# タイプは「コードで機械的に確定」→ Geminiは煽り文の味付けだけ（詳細: 11_リザルト診断設計）。

TYPE_NAMES = {
    "loud_clean": "正統派の大魔導士",
    "loud_messy": "勢い任せの暴れ詠唱",
    "quiet_clean": "囁きの暗殺者",
    "quiet_messy": "自信なき見習い",
    "normal_clean": "安定詠唱の賢者",
    "normal_messy": "ムラのある術士",
}


class FloorLog(BaseModel):
    floor_id: str = ""
    spell_text: str = ""
    match_rate: float = 0.0
    volume: str = "normal"
    speed_wpm: float = 0.0
    completion_rate: float = 0.0
    hesitation_count: int = 0
    spell_power: float = 0.0


class ResultRequest(BaseModel):
    session_id: str = ""
    floors: list[FloorLog] = []


def classify_type(floors: list[FloorLog]) -> tuple[str, dict]:
    """2軸（音量 × 安定）でタイプを機械的に確定し、集計statsを返す。"""
    n = len(floors)
    counts = {"loud": 0, "normal": 0, "quiet": 0}
    for f in floors:
        counts[f.volume if f.volume in counts else "normal"] += 1
    avg_volume = max(counts, key=counts.get)
    avg_completion = sum(f.completion_rate for f in floors) / n
    total_hesitation = sum(f.hesitation_count for f in floors)
    clean = avg_completion >= 0.85 and total_hesitation <= n
    type_key = f"{avg_volume}_{'clean' if clean else 'messy'}"
    stats = {
        "avg_volume": avg_volume,
        "total_hesitation": total_hesitation,
        "avg_match_rate": round(sum(f.match_rate for f in floors) / n, 2),
    }
    return type_key, stats


def build_verdict(type_name: str, stats: dict, best: dict, events: str) -> str:
    vol_ja = {"loud": "大声", "normal": "普通の声", "quiet": "小声"}.get(
        stats["avg_volume"], stats["avg_volume"]
    )
    prompt = f"""あなたは皮肉屋の古代魔導書。プレイヤーの詠唱セッションを総評する。
確定タイプ: {type_name}
実測: 平均音量={vol_ja} / 詰まり合計={stats['total_hesitation']} / 平均一致率={stats['avg_match_rate']:.0%}
ベスト詠唱: 「{best['spell_text']}」(威力{best['spell_power']})
観測事象: {events}
→ 上の観測事象と数値を必ず引用し、50〜80字の日本語で煽れ。
ただし「確定タイプ」「平均音量」等のラベル名はそのまま書かず、自然な口語で。タイプ名は文に織り込む。性格の捏造・改善アドバイスは禁止。"""
    try:
        res = gemini_client.models.generate_content(
            model="gemini-2.5-flash", contents=prompt
        )
        return res.text.strip()
    except Exception as e:
        logger.warning(f"build_verdict error: {e}")
        return f"お前は{type_name}だ。それ以上でも以下でもない。"


@app.post("/result")
async def result_endpoint(req: ResultRequest):
    floors = req.floors
    if not floors:
        return {
            "session_id": req.session_id,
            "type_key": "unknown",
            "type_name": "詠唱なき者",
            "best_floor": {"floor_id": "", "spell_text": "", "spell_power": 0.0},
            "ai_verdict": "一度も詠唱せぬとはな。話にならん。",
            "stats": {"avg_volume": "normal", "total_hesitation": 0, "avg_match_rate": 0.0},
        }

    type_key, stats = classify_type(floors)
    type_name = TYPE_NAMES.get(type_key, "謎の詠唱者")

    best = max(floors, key=lambda f: f.spell_power)
    best_floor = {
        "floor_id": best.floor_id,
        "spell_text": best.spell_text,
        "spell_power": round(best.spell_power, 2),
    }

    # 観測事象（本人が体感した事実を引用させる材料。捏造防止）
    events = []
    stumbles = [f for f in floors if f.hesitation_count > 0]
    if stumbles:
        worst = max(stumbles, key=lambda f: f.hesitation_count)
        events.append(f"{worst.floor_id or 'あるフロア'}で{worst.hesitation_count}回噛んだ")
    if stats["avg_volume"] == "loud":
        events.append("終始大声")
    elif stats["avg_volume"] == "quiet":
        events.append("終始小声")
    events_str = "・".join(events) if events else "特筆事項なし"

    loop = asyncio.get_event_loop()
    t0 = time.time()
    verdict = await loop.run_in_executor(
        None, lambda: build_verdict(type_name, stats, best_floor, events_str)
    )
    logger.info(f"[timing] result gemini={time.time()-t0:.2f}s floors={len(floors)}")

    return {
        "session_id": req.session_id,
        "type_key": type_key,
        "type_name": type_name,
        "best_floor": best_floor,
        "ai_verdict": verdict,
        "stats": stats,
    }
