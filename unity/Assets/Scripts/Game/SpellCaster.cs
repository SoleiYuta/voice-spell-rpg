using System;
using System.Collections;
using UnityEngine;

public class SpellCaster : MonoBehaviour
{
    [SerializeField] private ApiConfig apiConfig;
    [SerializeField] private MockSpellApiClient mockClient;

    public event Action<EvaluationResult> OnEvaluationComplete;

    public void CastSpell(byte[] wavBytes = null, string spellText = "テスト呪文")
    {
        ISpellApiClient client = apiConfig.useMock ? mockClient : null;
        if (client == null)
        {
            Debug.LogError("useMock=false ですが実クライアントが未実装です");
            return;
        }
        StartCoroutine(EvaluateCoroutine(client, wavBytes ?? Array.Empty<byte>(), spellText));
    }

    private IEnumerator EvaluateCoroutine(ISpellApiClient client, byte[] wavBytes, string spellText)
    {
        EvaluationResult result = null;
        client.Evaluate(wavBytes, spellText, r => result = r);
        yield return new WaitUntil(() => result != null);
        OnEvaluationComplete?.Invoke(result);
    }
}
