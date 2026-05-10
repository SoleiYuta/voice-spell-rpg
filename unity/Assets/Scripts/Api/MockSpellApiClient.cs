using System;
using System.Collections;
using UnityEngine;

public class MockSpellApiClient : MonoBehaviour, ISpellApiClient
{
    public void Evaluate(byte[] wavBytes, string spellText, Action<EvaluationResult> onComplete)
    {
        StartCoroutine(SimulateRequest(onComplete));
    }

    private IEnumerator SimulateRequest(Action<EvaluationResult> onComplete)
    {
        yield return new WaitForSeconds(0.5f);
        onComplete?.Invoke(new EvaluationResult
        {
            transcript    = "闇よ、我が右手に宿れ！",
            match_rate    = 0.87f,
            volume        = "loud",
            speed_wpm     = 180.5f,
            completion_rate  = 1.0f,
            hesitation_count = 1,
            confidence    = 0.92f,
            gm_comment    = "大声が得意だな！だが速さはまだまだだ。",
            spell_power   = 1.42f,
        });
    }
}
