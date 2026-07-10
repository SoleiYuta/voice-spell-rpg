"""評価ロジック(scoring.py)のユニットテスト。CIで pytest により実行される（GCP認証不要）。"""
import io

import numpy as np
import soundfile as sf

from scoring import (
    analyze_audio,
    calc_match_rate,
    calc_spell_power,
    delivery_bonus,
    rule_delivery_match,
)


def _tone_wav(amp, sr=16000, sec=1.0, gap_at=None, gap_sec=0.0):
    """振幅 amp の正弦波 WAV を生成。gap_at 秒の位置に gap_sec 秒の無音を挟める。"""
    t = np.linspace(0, sec, int(sr * sec), endpoint=False)
    y = (amp * np.sin(2 * np.pi * 200 * t)).astype(np.float32)
    if gap_at is not None and gap_sec > 0:
        a, b = int(gap_at * sr), int((gap_at + gap_sec) * sr)
        y[a:b] = 0.0
    buf = io.BytesIO()
    sf.write(buf, y, sr, format="WAV")
    return buf.getvalue()


# ---- calc_match_rate ----
def test_match_rate_exact():
    assert calc_match_rate("紅蓮の焔よ", "紅蓮の焔よ") == 1.0


def test_match_rate_empty_is_zero():
    assert calc_match_rate("", "あ") == 0.0
    assert calc_match_rate("あ", "") == 0.0


def test_match_rate_partial_between_0_and_1():
    r = calc_match_rate("紅蓮の焔よ", "紅蓮の炎")
    assert 0.0 < r < 1.0


# ---- calc_spell_power ----
def test_power_scales_with_intensity():
    weak = calc_spell_power(0.9, 1.0, 0.0)
    strong = calc_spell_power(0.9, 1.0, 1.0)
    assert strong > weak  # 気迫が高いほど強い


def test_power_needs_accuracy():
    # 発音も完了もゼロなら威力ゼロ（気迫MAXでも）
    assert calc_spell_power(0.0, 0.0, 1.0) == 0.0


def test_power_formula():
    # accuracy=(0.5+0.9)*1.0=1.4, mult=0.7+1.1*1=1.8 → 2.52
    assert calc_spell_power(0.9, 1.0, 1.0) == 2.52


# ---- analyze_audio ----
def test_silence_is_quiet():
    r = analyze_audio(_tone_wav(0.0))
    assert r["volume"] == "quiet"
    assert r["hesitation_count"] == 0
    assert r["intensity"] == 0.0


def test_loud_tone():
    r = analyze_audio(_tone_wav(0.2))
    assert r["volume"] == "loud"
    assert 0.0 <= r["intensity"] <= 1.0


def test_no_hesitation_for_continuous_speech():
    # 間の無い連続音 → 詰まり 0
    assert analyze_audio(_tone_wav(0.1, sec=2.0))["hesitation_count"] == 0


def test_counts_long_pause_as_hesitation():
    # 中央に 0.5 秒の無音 → 詰まり 1
    r = analyze_audio(_tone_wav(0.1, sec=2.0, gap_at=0.7, gap_sec=0.5))
    assert r["hesitation_count"] == 1


# ---- rule_delivery_match（お題マッチのルール保険）----
_SEXY = {"volume": 0.0, "speed": 0.15, "intensity": 0.4}
_ANGRY = {"volume": 1.0, "speed": 0.85, "intensity": 0.9}


def test_delivery_match_in_range():
    m = rule_delivery_match("normal", 150, 0.5, _SEXY)
    assert 0.0 <= m <= 1.0


def test_delivery_match_rewards_closeness():
    # 「色っぽく＝静か・遅い・弱め」に近い声ほど高スコア
    close = rule_delivery_match("quiet", 110, 0.3, _SEXY)
    far = rule_delivery_match("loud", 210, 1.0, _SEXY)
    assert close > far


def test_delivery_match_style_specific():
    # 大声・速い・気迫MAX は「怒り」に高く、「色っぽく」に低い
    voice = ("loud", 205, 0.95)
    assert rule_delivery_match(*voice, _ANGRY) > rule_delivery_match(*voice, _SEXY)


# ---- delivery_bonus ----
def test_delivery_bonus_range():
    assert delivery_bonus(0.0) == 0.8
    assert delivery_bonus(1.0) == 1.2
    assert delivery_bonus(0.5) == 1.0


def test_delivery_bonus_monotonic():
    assert delivery_bonus(0.9) > delivery_bonus(0.2)
