import asyncio
import base64
import io
import json
import logging
import os
import random
import time
from typing import Optional

import numpy as np
import soundfile as sf
from pydub import AudioSegment
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import speech
from google.cloud import firestore
from google import genai
from google.genai import types
from rapidfuzz import fuzz

# 評価ロジックはテスト可能なよう scoring.py に分離（GCP非依存）
from scoring import (
    analyze_audio,
    calc_match_rate,
    calc_spell_power,
    delivery_bonus,
    rule_delivery_match,
)

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
# 画像生成(gemini-2.5-flash-image)は asia-northeast1 に無いため global で叩く
image_client = genai.Client(
    vertexai=True,
    project="voicespellrpg",
    location="global",
)
IMAGE_MODEL = "gemini-2.5-flash-image"

# Firestore：プレイヤー記憶の永続化（#83）。未有効/失敗でも動くようガードする。
try:
    fs_client = firestore.Client(project="voicespellrpg")
except Exception as e:  # pragma: no cover - 環境依存
    logging.getLogger(__name__).warning(f"Firestore init failed: {e}")
    fs_client = None


def load_player_memory(player_id: str) -> Optional[dict]:
    """匿名プレイヤーIDから過去の記録を読む。無ければ None（初回）。"""
    if not fs_client or not player_id:
        return None
    try:
        doc = fs_client.collection("players").document(player_id).get()
        return doc.to_dict() if doc.exists else None
    except Exception as e:
        logger.warning(f"load_player_memory error: {e}")
        return None


def save_player_memory(player_id: str, data: dict) -> None:
    """1プレイ終了時にプレイヤーの記録を更新（来訪回数を+1・最終プレイ時刻を刻む）。"""
    if not fs_client or not player_id:
        return
    try:
        payload = dict(data)
        payload["play_count"] = firestore.Increment(1)
        payload["last_played"] = firestore.SERVER_TIMESTAMP
        fs_client.collection("players").document(player_id).set(payload, merge=True)
    except Exception as e:
        logger.warning(f"save_player_memory error: {e}")

SPELL_TYPES = ["fire", "ice", "thunder", "dark", "light", "wind"]

# 詠唱の「言い方（お題）」。key はフロントの deliveryStyles.ts と一致させる。
# instruction=Geminiに渡す採点基準 / target=ルール保険用の目標プロファイル(声量/速度/気迫 0..1)。
DELIVERY_STYLES = {
    "chuuni": {
        "label": "厨二病全開で",
        "instruction": "中二病っぽく、大げさに格好つけて熱く叫ぶような話し方",
        "target": {"volume": 1.0, "speed": 0.5, "intensity": 0.9},
    },
    "sexy": {
        "label": "色っぽく囁くように",
        "instruction": "色気のある、ゆっくりした囁き声で艶やかに紡ぐ話し方",
        "target": {"volume": 0.0, "speed": 0.15, "intensity": 0.4},
    },
    "angry": {
        "label": "怒りを込めて",
        "instruction": "怒りと気迫をぶつけるように、強く速くまくし立てる話し方",
        "target": {"volume": 1.0, "speed": 0.85, "intensity": 0.9},
    },
    "sigh": {
        "label": "ため息まじり気だるげに",
        "instruction": "気だるく、ため息まじりの脱力した調子の話し方",
        "target": {"volume": 0.0, "speed": 0.1, "intensity": 0.2},
    },
    "love": {
        "label": "愛を告げるように",
        "instruction": "大切な人に愛を告げるように、優しく穏やかに語りかける話し方",
        "target": {"volume": 0.5, "speed": 0.2, "intensity": 0.5},
    },
    "bright": {
        "label": "高らかに元気よく",
        "instruction": "明るく元気に、高いテンションで張りのある声で放つ話し方",
        "target": {"volume": 1.0, "speed": 0.8, "intensity": 0.85},
    },
}
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
    player_id: str = ""  # 永続プレイヤーID（セッション跨ぎの記憶・#83）
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
    prompt = f"""あなたは古代魔導書に宿る精霊。プレイヤーを見守る、頼れる師のような存在だ。今の詠唱に一言だけ返せ。

実測:
- 認識テキスト: 「{transcript}」
- 一致率: {match_rate:.0%}
- 声量: {vol_ja}
- 速度: {speed_wpm} wpm
- 詰まり: {hesitation_count}回
- 完了率: {completion_rate:.0%}
- 詠唱威力: {spell_power}

ルール:
- 上の実測のうち最も目立つ点を1つ具体的に引用し、まず良かった点を認めてから、次への軽い後押しを添える（例「よく声が通っていたぞ、その調子だ」「少し詰まったが、気迫は十分だった」）
- あくまで前向き・温かい励ましの口調。見下し・皮肉・挑発は禁止
- 日本語1文・40字以内
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


class DeliveryScore(BaseModel):
    score: int  # 0..100（お題への近さ）
    comment: str


def judge_delivery(wav_bytes: bytes, instruction: str) -> Optional[dict]:
    """Geminiに録音を"聴かせて"、お題（言い方）への近さを採点させる。
    返り値 {"match": 0..1, "comment": str}。失敗時 None（呼び出し側でルール保険に切替）。"""
    prompt = f"""あなたは声の演技を審査するAI。この音声の「話し方・声色・雰囲気」が、次のお題にどれくらい近いか評価せよ。
お題:「{instruction}」

ルール:
- 言葉の意味や発音の正確さではなく、声のトーン・勢い・抑揚・気だるさ/熱っぽさなど"言い方"だけで判断する
- score: 0〜100（お題への近さ。全然違えば低く、そっくりなら高く）
- comment: お題に沿って前向きに褒める/促す日本語20字以内（例「吐息の色気、見事」「もっと熱く叫べ」）
JSON で score, comment を返せ。"""
    try:
        audio_part = types.Part.from_bytes(data=wav_bytes, mime_type="audio/wav")
        res = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt, audio_part],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DeliveryScore,
            ),
        )
        data = json.loads(res.text)
        match = max(0.0, min(1.0, float(data.get("score", 0)) / 100.0))
        comment = str(data.get("comment") or "").strip()[:40]
        return {"match": round(match, 2), "comment": comment}
    except Exception as e:
        logger.warning(f"judge_delivery error: {e}")
        return None


@app.post("/evaluate")
async def evaluate(
    audio_file: UploadFile = File(...),
    spell_text: str = Form(""),
    session_id: str = Form(""),
    floor_id: str = Form(""),
    delivery_style: str = Form(""),
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
    base_power = calc_spell_power(match_rate, completion_rate, audio["intensity"])

    # お題（言い方）が指定されていれば、Geminiに音声を聴かせて演技マッチ度を採点。
    style = DELIVERY_STYLES.get(delivery_style)

    t2 = time.time()
    # GM講評 と お題採点(Gemini音声) を並列で投げてレイテンシを抑える。
    gm_comment, delivery_ai = await asyncio.gather(
        loop.run_in_executor(
            None,
            lambda: generate_gm_comment(
                transcript, match_rate, audio["volume"], speed_wpm,
                audio["hesitation_count"], completion_rate, base_power,
            ),
        ),
        loop.run_in_executor(None, lambda: judge_delivery(wav_bytes, style["instruction"]))
        if style else _none_coro(loop),
    )
    logger.info(f"[timing] gemini={time.time()-t2:.2f}s total={time.time()-t0:.2f}s")

    # お題採点：Gemini成功→AI判定 / 失敗→音響特徴でルール保険。指定なしは None。
    delivery_score = None
    delivery_comment = None
    delivery_source = None
    if style:
        if delivery_ai:
            delivery_score = delivery_ai["match"]
            delivery_comment = delivery_ai["comment"]
            delivery_source = "ai"
        else:
            delivery_score = rule_delivery_match(
                audio["volume"], speed_wpm, audio["intensity"], style["target"]
            )
            delivery_source = "rule"

    # お題マッチ度を威力倍率(0.8〜1.2)として上乗せ。発音・気迫の土台はそのまま。
    spell_power = base_power if delivery_score is None else round(base_power * delivery_bonus(delivery_score), 2)

    return {
        "transcript": transcript,
        "match_rate": round(match_rate, 2),
        "volume": audio["volume"],
        "speed_wpm": speed_wpm,
        "completion_rate": completion_rate,
        "hesitation_count": audio["hesitation_count"],
        "confidence": round(confidence, 2),
        "intensity": audio["intensity"],
        "gm_comment": gm_comment,
        "spell_power": spell_power,
        "delivery_style": delivery_style or None,
        "delivery_score": delivery_score,
        "delivery_comment": delivery_comment,
        "delivery_source": delivery_source,
    }


async def _none_coro(loop):
    """お題未指定時に asyncio.gather の第2要素へ渡す no-op（None を返す）。"""
    return None


def _parse_floor(floor_id: str) -> int:
    digits = "".join(c for c in (floor_id or "") if c.isdigit())
    return int(digits) if digits else 1


def generate_spell(
    profile: Optional[PlayerProfile],
    floor_num: int,
    force_type: Optional[str] = None,
    target_difficulty: Optional[int] = None,
) -> dict:
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
- difficulty は {("必ず " + str(target_difficulty) + "（1〜5）") if target_difficulty else "1〜5（フロア" + str(floor_num) + "相当）"}、spell_type は {("必ず「" + force_type + "」に固定") if force_type else (("/".join(SPELL_TYPES)) + " のいずれか")}
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
        stype = force_type if force_type in SPELL_TYPES else (data.get("spell_type") if data.get("spell_type") in SPELL_TYPES else "fire")
        diff = target_difficulty if target_difficulty else int(data.get("difficulty", 2))
        return {
            "spell_text": str(data.get("spell_text") or FALLBACK_SPELL["spell_text"]).strip(),
            "difficulty": max(1, min(5, diff)),
            "spell_type": stype,
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


# ===== 適応型AIゲームマスター（function calling エージェント・#81 / 低レイテンシ版 #87）=====
# 「観測 → ツールで方針(難易度・お題・理由)と3つの呪文を"一度に"決める」。
# plan と 3呪文生成を1回の function calling に統合し、Gemini往復を 2→1 に減らす。
_DELIVERY_KEYS = list(DELIVERY_STYLES.keys())

FORGE_ROUND_TOOL = types.Tool(function_declarations=[types.FunctionDeclaration(
    name="forge_round",
    description="プレイヤーの傾向を観測し、次ラウンドの方針と3つの呪文を一度に決める",
    parameters={
        "type": "object",
        "properties": {
            "difficulty": {"type": "integer", "description": "1〜5。易しすぎ/難しすぎを避けフロー領域を狙う"},
            "delivery_style": {"type": "string", "enum": _DELIVERY_KEYS, "description": "言い方のお題（前回までと変化をつける）"},
            "reason": {"type": "string", "description": "なぜこの方針か。プレイヤーの実測を必ず根拠に引用"},
            "coaching": {"type": "string", "description": "短い励まし/助言（任意・40字以内）"},
            "spells": {
                "type": "array",
                "description": "3つ。spell_type は互いに異なること",
                "items": {
                    "type": "object",
                    "properties": {
                        "spell_text": {"type": "string", "description": "声に出したくなる厨二病で格好いい日本語呪文（40字以内）"},
                        "spell_type": {"type": "string", "enum": SPELL_TYPES},
                    },
                    "required": ["spell_text", "spell_type"],
                },
            },
        },
        "required": ["difficulty", "delivery_style", "reason", "spells"],
    },
)])


def forge_round(profile: Optional[PlayerProfile], floor_num: int, memory: Optional[dict] = None) -> Optional[dict]:
    """GMエージェントが1回のfunction callingで方針＋3呪文を決める。失敗時 None（=従来出題にフォールバック）。
    memory があれば「魔導書が覚えている」＝過去の記録を観測に含め、reason で言及させる（#83）。"""
    if profile:
        vol_ja = {"loud": "大声", "normal": "普通の声", "quiet": "小声"}.get(profile.avg_volume, profile.avg_volume)
        obs = (
            f"- 平均一致率: {profile.avg_match_rate:.0%}\n"
            f"- 平均声量: {vol_ja}\n"
            f"- 得意: {profile.strong_pattern or '不明'}\n"
            f"- 苦手: {profile.weak_pattern or '不明'}"
        )
    else:
        obs = "（初回・傾向データなし）"

    mem_block = ""
    if memory:
        last_lv = memory.get("reached_level", "?")
        outcome_ja = {
            "victory": "全レベルを制覇（クリア）",
            "defeat": f"レベル{last_lv}で力尽きた",
        }.get(memory.get("last_outcome"), "不明")
        mem_block = (
            f"\n\n【この詠唱者の過去の記録＝お前は彼を覚えている】\n"
            f"- 来訪回数: {int(memory.get('play_count', 1))}回目\n"
            f"- 前回の詠唱型: {memory.get('last_type_name', '不明')}\n"
            f"- 過去の到達レベル: {last_lv}\n"
            f"- 前回の結末: {outcome_ja}\n"
            f"- 過去の苦手: {memory.get('weak_pattern') or '特になし'}\n"
            f"→ reason の冒頭で、常連の詠唱者として軽く再会に触れる。\n"
            f"→【難易度の自己補正・#84】前回クリアできたなら今回は少し難しく、"
            f"早々に力尽きたなら少し易しく、結末を踏まえて difficulty を調整し、その旨を reason に書け。"
        )

    prompt = f"""あなたはプレイヤーを見守る適応型AIゲームマスター（魔導書の精霊）。
直近の観測から、次フロア{floor_num}の方針と3つの呪文を forge_round ツールで一度に決めよ。

観測:
{obs}{mem_block}

指針:
- 苦手を少しだけ克服させ、得意も活かす。易しすぎ/難しすぎを避ける（フロー領域）
- delivery_style（言い方のお題）は変化をつけ表現の幅を広げさせる
- フロアが上がるほど挑戦的に
- 3つの呪文は spell_type を互いに変え、difficulty 相応の長さ・難度に
- reason にはプレイヤーの実測（と、あれば過去の記録）を必ず引用する
必ず forge_round を1回だけ呼ぶこと。"""
    try:
        res = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[FORGE_ROUND_TOOL],
                tool_config=types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(mode="ANY")
                ),
            ),
        )
        for c in (res.candidates or []):
            for p in (c.content.parts or []):
                fc = getattr(p, "function_call", None)
                if fc and fc.name == "forge_round":
                    a = dict(fc.args)
                    diff = max(1, min(5, int(a.get("difficulty", 2))))
                    ds = a.get("delivery_style")
                    spells, used = [], set()
                    for s in list(a.get("spells") or []):
                        st = s.get("spell_type")
                        txt = str(s.get("spell_text") or "").strip()
                        if st in SPELL_TYPES and txt and st not in used:
                            used.add(st)
                            spells.append({
                                "spell_text": txt[:60], "difficulty": diff,
                                "spell_type": st, "expected_length_sec": round(2.0 + diff * 0.6, 1),
                            })
                    # 3つに満たなければ残り属性で補完（体験維持）
                    for st in SPELL_TYPES:
                        if len(spells) >= 3:
                            break
                        if st not in used:
                            used.add(st)
                            spells.append({
                                "spell_text": FALLBACK_SPELL["spell_text"], "difficulty": diff,
                                "spell_type": st, "expected_length_sec": 3.0,
                            })
                    spells = spells[:3]
                    if len(spells) < 3:
                        return None
                    return {
                        "spells": spells,
                        "agent": {
                            "difficulty": diff,
                            "element_focus": spells[0]["spell_type"],
                            "delivery_style": ds if ds in DELIVERY_STYLES else random.choice(_DELIVERY_KEYS),
                            "reason": str(a.get("reason") or "").strip()[:120],
                            "coaching": str(a.get("coaching") or "").strip()[:60],
                        },
                    }
    except Exception as e:
        logger.warning(f"forge_round error: {e}")
    return None


@app.post("/generate-spell-choices")
async def generate_spell_choices_endpoint(req: GenerateSpellRequest):
    """GMエージェントが1回のfunction callingで方針＋3択を決める（#81 / 低レイテンシ #87）。
    フロア1と失敗時は従来のランダム並列生成にフォールバック。#74 アーチャー伝説風。"""
    t0 = time.time()
    floor_num = _parse_floor(req.floor_id)
    loop = asyncio.get_event_loop()

    # 記憶を読む（#83）。常連なら初回フロアでも「おかえり」でエージェントを走らせる。
    memory = await loop.run_in_executor(None, lambda: load_player_memory(req.player_id))

    # フロア2以降 or 記憶のある常連はエージェント（観測→ツールで方針＋3呪文を一括決定）。
    # まっさらな初回のフロア1のみ、ロード短縮で従来出題。
    forged = None
    if floor_num >= 2 or memory is not None:
        forged = await loop.run_in_executor(None, lambda: forge_round(req.player_profile, floor_num, memory))

    if forged:
        logger.info(f"[timing] generate-spell-choices={time.time()-t0:.2f}s floor={floor_num} agent=ai")
        return forged

    # フォールバック：属性違いの3呪文を並列生成
    types3 = random.sample(SPELL_TYPES, 3)
    spells = await asyncio.gather(*[
        loop.run_in_executor(None, (lambda ft: lambda: generate_spell(req.player_profile, floor_num, force_type=ft))(t))
        for t in types3
    ])
    logger.info(f"[timing] generate-spell-choices={time.time()-t0:.2f}s floor={floor_num} agent=fallback")
    return {"spells": spells, "agent": None}


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
    player_id: str = ""  # 永続プレイヤーID（記憶の保存先・#83）
    outcome: str = ""  # "victory" | "defeat"（難易度の自己補正シグナル・#84）
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
        "avg_speed_wpm": round(sum(f.speed_wpm for f in floors) / n, 1),
    }
    return type_key, stats


def build_verdict(type_name: str, stats: dict, best: dict, events: str) -> str:
    vol_ja = {"loud": "大声", "normal": "普通の声", "quiet": "小声"}.get(
        stats["avg_volume"], stats["avg_volume"]
    )
    prompt = f"""あなたは古代魔導書に宿る精霊。プレイヤーの詠唱の旅を、温かく見送るように総評する。
確定タイプ: {type_name}
実測: 平均音量={vol_ja} / 詰まり合計={stats['total_hesitation']} / 平均一致率={stats['avg_match_rate']:.0%}
ベスト詠唱: 「{best['spell_text']}」(威力{best['spell_power']})
観測事象: {events}
→ 上の観測事象と数値を必ず引用し、50〜80字の日本語で称え、労え。
前向きで温かい口調。見下し・皮肉・挑発は禁止。「確定タイプ」「平均音量」等のラベル名はそのまま書かず、自然な口語で。タイプ名は誇らしげに文へ織り込む。性格の捏造・改善アドバイスは禁止。"""
    try:
        res = gemini_client.models.generate_content(
            model="gemini-2.5-flash", contents=prompt
        )
        return res.text.strip()
    except Exception as e:
        logger.warning(f"build_verdict error: {e}")
        return f"見事な詠唱の旅だった。お前はまさに『{type_name}』だ。"


# ===== VTuber声質タイプ＋キャラ提案（Gemini 構造化出力）=====
class VtuberPersona(BaseModel):
    character_name: str
    attribute: str
    catchphrase: str
    character_setting: str
    portrait_prompt: str


class VoiceTypeResult(BaseModel):
    voice_type_name: str
    voice_type_desc: str
    vtuber_persona: VtuberPersona
    improvement_tip: str


FALLBACK_PERSONA = {
    "voice_type_name": "唯一無二の詠唱者",
    "voice_type_desc": "あなたの声には、あなたにしかない響きがある。",
    "vtuber_persona": {
        "character_name": "ミスティア",
        "attribute": "ミステリアス",
        "catchphrase": "さあ、声を響かせよう。",
        "character_setting": "古い魔導書から生まれた声の精。聴く者の心にそっと寄り添う。",
        "portrait_prompt": "anime vtuber character, mysterious mage girl, purple theme, glowing grimoire, soft lighting",
    },
    "improvement_tip": "抑揚を少し大きくすると、感情がもっと伝わる。",
}


def generate_vtuber_persona(stats: dict, best: dict, avg_speed: float) -> dict:
    """声の特徴から VTuber 声質タイプ＋キャラ像を提案（"診断"ではなく楽しい"提案"トーン）。"""
    vol_ja = {"loud": "大声", "normal": "普通の声", "quiet": "小声"}.get(
        stats["avg_volume"], stats["avg_volume"]
    )
    prompt = f"""あなたは声の個性から VTuber/配信者のキャラクター像を提案する AI。
プレイヤーの詠唱で観測された声の特徴から、声質タイプと、それを活かした VTuber キャラ案を作れ。

声の特徴（実測）:
- 声量: {vol_ja}
- 発音の正確さ(一致率): {stats['avg_match_rate']:.0%}
- つっかえ(詰まり合計): {stats['total_hesitation']}回
- 話す速さ: {avg_speed:.0f} wpm
- 最も強かった詠唱の威力: {best['spell_power']}

トーン: 楽しく前向き。医学的・専門的な断定はしない（"診断"ではなく"提案"）。
出力項目:
- voice_type_name: キャッチーな声質タイプ名（例「凛と通るクール系」「弾ける元気系」）
- voice_type_desc: その声の強み・魅力を前向きに1〜2文
- vtuber_persona.character_name: VTuberキャラ名の案
- vtuber_persona.attribute: キャラの方向性/属性（例: クールミステリアス / 元気応援系）
- vtuber_persona.catchphrase: 配信で使えそうな一言キャッチコピー
- vtuber_persona.character_setting: 2〜3文の短いキャラ設定
- vtuber_persona.portrait_prompt: 立ち絵をAI画像生成するための英語プロンプト（"anime vtuber character, " で始める）
- improvement_tip: 声をもっと活かすための具体的な改善ヒント1文"""
    try:
        res = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=VoiceTypeResult,
            ),
        )
        data = json.loads(res.text)
        persona = data.get("vtuber_persona") or {}
        fb = FALLBACK_PERSONA
        return {
            "voice_type_name": data.get("voice_type_name") or fb["voice_type_name"],
            "voice_type_desc": data.get("voice_type_desc") or fb["voice_type_desc"],
            "vtuber_persona": {
                "character_name": persona.get("character_name") or fb["vtuber_persona"]["character_name"],
                "attribute": persona.get("attribute") or fb["vtuber_persona"]["attribute"],
                "catchphrase": persona.get("catchphrase") or fb["vtuber_persona"]["catchphrase"],
                "character_setting": persona.get("character_setting") or fb["vtuber_persona"]["character_setting"],
                "portrait_prompt": persona.get("portrait_prompt") or fb["vtuber_persona"]["portrait_prompt"],
            },
            "improvement_tip": data.get("improvement_tip") or fb["improvement_tip"],
        }
    except Exception as e:
        logger.warning(f"generate_vtuber_persona error: {e}")
        return dict(FALLBACK_PERSONA)


@app.post("/result")
async def result_endpoint(req: ResultRequest):
    floors = req.floors
    if not floors:
        return {
            "session_id": req.session_id,
            "type_key": "unknown",
            "type_name": "詠唱なき者",
            "best_floor": {"floor_id": "", "spell_text": "", "spell_power": 0.0},
            "ai_verdict": "まだ一度も詠唱していないようだ。次はぜひ、その声を聞かせてくれ。",
            "stats": {"avg_volume": "normal", "total_hesitation": 0, "avg_match_rate": 0.0, "avg_speed_wpm": 0.0},
            **FALLBACK_PERSONA,
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
    # 総評とVTuberキャラ提案を並列生成（Gemini 2本を同時に投げてレイテンシを抑える）
    verdict, persona = await asyncio.gather(
        loop.run_in_executor(None, lambda: build_verdict(type_name, stats, best_floor, events_str)),
        loop.run_in_executor(None, lambda: generate_vtuber_persona(stats, best_floor, stats["avg_speed_wpm"])),
    )
    logger.info(f"[timing] result gemini={time.time()-t0:.2f}s floors={len(floors)}")

    # プレイヤーの記録を更新（次回の「魔導書が覚えている」用・#83）
    await loop.run_in_executor(None, lambda: save_player_memory(req.player_id, {
        "last_type_name": type_name,
        "last_outcome": req.outcome,  # #84: 次回の難易度自己補正シグナル
        "avg_match_rate": stats["avg_match_rate"],
        "avg_volume": stats["avg_volume"],
        "reached_level": len(floors),
        "best_power": best_floor["spell_power"],
        "weak_pattern": "詠唱が詰まりがち" if stats["total_hesitation"] > len(floors) else "",
        "strong_pattern": "大声" if stats["avg_volume"] == "loud" else ("囁き" if stats["avg_volume"] == "quiet" else "安定した声"),
    }))

    return {
        "session_id": req.session_id,
        "type_key": type_key,
        "type_name": type_name,
        "best_floor": best_floor,
        "ai_verdict": verdict,
        "stats": stats,
        **persona,
    }


# ===== 立ち絵の実画像生成（VTuberキャラ提案の portrait_prompt から）=====
class ImageRequest(BaseModel):
    prompt: str = ""


def _gen_image(prompt: str) -> Optional[str]:
    """gemini-2.5-flash-image で画像生成し data URL(base64) で返す。失敗時 None。"""
    res = image_client.models.generate_content(
        model=IMAGE_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
    )
    for cand in (res.candidates or []):
        for p in (cand.content.parts or []):
            inline = getattr(p, "inline_data", None)
            if inline and inline.data:
                b64 = base64.b64encode(inline.data).decode()
                return f"data:{inline.mime_type};base64,{b64}"
    return None


@app.post("/generate-image")
async def generate_image_endpoint(req: ImageRequest):
    if not req.prompt.strip():
        return {"image": None, "error": "empty prompt"}
    loop = asyncio.get_event_loop()
    t0 = time.time()
    try:
        # アニメ調の立ち絵になるよう軽く方向づけ
        prompt = f"anime-style character portrait, full body, clean background. {req.prompt}"
        img = await loop.run_in_executor(None, lambda: _gen_image(prompt))
        logger.info(f"[timing] generate-image={time.time()-t0:.2f}s ok={bool(img)}")
        return {"image": img, "error": None if img else "no image"}
    except Exception as e:
        logger.warning(f"generate-image error: {e}")
        return {"image": None, "error": "generation failed"}
