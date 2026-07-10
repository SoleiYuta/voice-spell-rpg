"""純粋な評価ロジック（GCPクライアント非依存＝ユニットテスト可能）。

main.py はここから import して使う。google-cloud 系に依存しないので、
CI では numpy / soundfile / rapidfuzz + pytest だけで実行できる（認証不要）。
"""
import io

import numpy as np
import soundfile as sf
from rapidfuzz import fuzz


def calc_match_rate(spell_text: str, transcript: str) -> float:
    if not spell_text or not transcript:
        return 0.0
    return fuzz.ratio(spell_text, transcript) / 100.0


def analyze_audio(wav_bytes: bytes) -> dict:
    # soundfile + numpy のみ（librosa/numba 不使用＝コールドスタートが速い）
    y, sr = sf.read(io.BytesIO(wav_bytes), dtype="float32")
    if getattr(y, "ndim", 1) > 1:  # ステレオ→モノラル
        y = y.mean(axis=1)
    y = np.asarray(y, dtype=np.float32)
    if y.size == 0:
        return {"volume": "quiet", "hesitation_count": 0, "intensity": 0.0}

    # フレームRMS（25ms窓・10msホップ）を numpy で算出
    win = max(1, int(sr * 0.025))
    hop = max(1, int(sr * 0.010))
    if y.size < win:
        frames = np.array([np.sqrt(np.mean(y ** 2))], dtype=np.float32)
    else:
        n = 1 + (y.size - win) // hop
        idx = (np.arange(n) * hop)[:, None] + np.arange(win)[None, :]
        frames = np.sqrt(np.mean(y[idx] ** 2, axis=1))

    peak = float(frames.max())
    if peak <= 0:
        return {"volume": "quiet", "hesitation_count": 0, "intensity": 0.0}

    # 無音判定：ピークの top_db=30 相当（10^(-30/20) ≒ 0.0316倍）を閾値に
    voiced = frames > peak * (10 ** (-30 / 20))

    # 音量（発話フレームのRMS）
    speech_rms = float(np.sqrt(np.mean(frames[voiced] ** 2))) if voiced.any() else 0.0
    if speech_rms > 0.05:
        volume = "loud"
    elif speech_rms > 0.01:
        volume = "normal"
    else:
        volume = "quiet"

    # 詰まり回数 = 発話の途中に入る「一定以上の無音(=はっきりした間)」の数。
    # 音節・単語間の自然な微小な無音(数十ms)まで数えると過大になるため、
    # 前後の無音を除いた発話区間内で、MIN_PAUSE_SEC 以上続く無音ブロックだけを1回と数える。
    MIN_PAUSE_SEC = 0.35
    min_pause = max(1, int(MIN_PAUSE_SEC * sr / hop))
    voiced_idx = np.flatnonzero(voiced)
    hesitation_count = 0
    if voiced_idx.size:
        inner = voiced[voiced_idx[0] : voiced_idx[-1] + 1]  # 前後の無音を除いた発話区間
        run = 0
        for v in inner:
            if v:
                if run >= min_pause:  # 直前の無音が閾値以上なら「詰まり」1回
                    hesitation_count += 1
                run = 0
            else:
                run += 1

    # 詠唱の強さ intensity(0..1)：声量 + 抑揚(発話フレームRMSの変動係数)。
    # 棒読み=抑揚が小さく低め、気迫のこもった詠唱=大きく張り・抑揚があり高くなる。
    voiced_rms = frames[voiced]
    if voiced_rms.size and speech_rms > 0:
        loud_norm = min(1.0, speech_rms / 0.06)  # RMS 0.06 で最大
        mean_v = float(voiced_rms.mean())
        cv = float(voiced_rms.std() / mean_v) if mean_v > 0 else 0.0  # 抑揚(変動係数)
        dyn_norm = min(1.0, cv / 0.5)
        intensity = round(0.55 * loud_norm + 0.45 * dyn_norm, 3)
    else:
        intensity = 0.0

    return {
        "volume": volume,
        "hesitation_count": hesitation_count,
        "intensity": intensity,
    }


_VOL_NUM = {"quiet": 0.0, "normal": 0.5, "loud": 1.0}


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def rule_delivery_match(volume: str, speed_wpm: float, intensity: float, target: dict) -> float:
    """お題（言い方）への近さをルールで採点する保険。Gemini音声判定が失敗した時のフォールバック。
    target は {"volume":0..1, "speed":0..1(遅い..速い), "intensity":0..1} の目標プロファイル。
    実測（声量カテゴリ・速度・気迫）との重み付き距離から 0..1 の近さを返す。"""
    v = _VOL_NUM.get(volume, 0.5)
    # 速度正規化: 120wpm以下=遅い(0)、200wpm以上=速い(1)。測定不能(0)は中庸扱い。
    s = 0.5 if speed_wpm <= 0 else _clamp01((speed_wpm - 120.0) / 80.0)
    i = _clamp01(intensity)
    dist = (
        0.4 * abs(v - target.get("volume", 0.5))
        + 0.3 * abs(s - target.get("speed", 0.5))
        + 0.3 * abs(i - target.get("intensity", 0.5))
    )
    return round(_clamp01(1.0 - dist), 2)


def delivery_bonus(delivery_match: float) -> float:
    """お題マッチ度(0..1) を威力倍率(0.8..1.2)に変換。お題に近いほど威力が上がる。"""
    return round(0.8 + 0.4 * _clamp01(delivery_match), 3)


def calc_spell_power(match_rate: float, completion_rate: float, intensity: float) -> float:
    """威力 = 詠唱の強さ(intensity) に比例。ただし呪文を正しく言えていること(発音一致率×完了率)が前提のゲート。
    - accuracy(0.5〜1.5): 呪文をどれだけ正確に最後まで言えたか。言えていないと伸びない。
    - power_mult(0.7〜1.8): 気迫(声量＋抑揚)。棒読み・弱い声だと低く、張りのある詠唱で高くなる。
    → 正しく＋気迫を込めて唱えるほど威力が上がる（棒読み最適を解消）。"""
    accuracy = (0.5 + match_rate) * completion_rate
    power_mult = 0.7 + 1.1 * max(0.0, min(1.0, intensity))
    return round(accuracy * power_mult, 2)
