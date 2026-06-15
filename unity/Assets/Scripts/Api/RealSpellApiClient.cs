using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

public class RealSpellApiClient : MonoBehaviour, ISpellApiClient
{
    [SerializeField] private ApiConfig apiConfig;

    public void Evaluate(byte[] wavBytes, string spellText, Action<EvaluationResult> onComplete)
    {
        StartCoroutine(PostEvaluate(wavBytes, spellText, onComplete));
    }

    private IEnumerator PostEvaluate(byte[] wavBytes, string spellText, Action<EvaluationResult> onComplete)
    {
        string url = apiConfig.apiBaseUrl + "/evaluate";

        var form = new List<IMultipartFormSection>
        {
            new MultipartFormFileSection("audio_file", wavBytes, "recording.wav", "audio/wav"),
            new MultipartFormDataSection("spell_text", spellText),
            new MultipartFormDataSection("session_id", "session-1"),
            new MultipartFormDataSection("floor_id", "floor-1"),
        };

        using var req = UnityWebRequest.Post(url, form);
        yield return req.SendWebRequest();

        if (req.result != UnityWebRequest.Result.Success)
        {
            Debug.LogError($"[RealSpellApiClient] {req.error}");
            yield break;
        }

        var result = JsonUtility.FromJson<EvaluationResult>(req.downloadHandler.text);
        onComplete?.Invoke(result);
    }
}
