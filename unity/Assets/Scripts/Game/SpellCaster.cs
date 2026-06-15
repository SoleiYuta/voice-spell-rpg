using System;
using System.Collections;
using UnityEngine;

public class SpellCaster : MonoBehaviour
{
    [SerializeField] private ApiConfig apiConfig;
    [SerializeField] private MockSpellApiClient mockClient;
    [SerializeField] private RealSpellApiClient realClient;

    public event Action<EvaluationResult> OnEvaluationComplete;

    public void CastSpell(byte[] wavBytes = null, string spellText = "テスト呪文")
    {
        ISpellApiClient client = apiConfig.useMock ? mockClient : realClient;
        if (client == null)
        {
            Debug.LogError("クライアントが未設定です");
            return;
        }
        StartCoroutine(EvaluateCoroutine(client, wavBytes ?? Array.Empty<byte>(), spellText));
    }

    private IEnumerator EvaluateCoroutine(ISpellApiClient client, byte[] wavBytes, string spellText)
    {
        EvaluationResult result = null;
        client.Evaluate(wavBytes, spellText, r => result = r);
        yield return new WaitUntil(() => result != null);
        Debug.Log($"transcript: {result.transcript} / match_rate: {result.match_rate} / spell_power: {result.spell_power}");
        OnEvaluationComplete?.Invoke(result);
    }
}
