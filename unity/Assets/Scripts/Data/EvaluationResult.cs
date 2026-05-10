using System;

[Serializable]
public class EvaluationResult
{
    public string transcript;
    public float match_rate;
    public string volume;
    public float speed_wpm;
    public float completion_rate;
    public int hesitation_count;
    public float confidence;
    public string gm_comment;
    public float spell_power;
}
