using System;

public interface ISpellApiClient
{
    void Evaluate(byte[] wavBytes, string spellText, Action<EvaluationResult> onComplete);
}
