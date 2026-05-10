using TMPro;
using UnityEngine;

public class SpellUI : MonoBehaviour
{
    [SerializeField] private SpellCaster spellCaster;
    [SerializeField] private TMP_Text transcriptText;
    [SerializeField] private TMP_Text spellPowerText;
    [SerializeField] private TMP_Text gmCommentText;

    private void OnEnable()  => spellCaster.OnEvaluationComplete += ShowResult;
    private void OnDisable() => spellCaster.OnEvaluationComplete -= ShowResult;

    private void ShowResult(EvaluationResult result)
    {
        transcriptText.text  = result.transcript;
        spellPowerText.text  = $"呪文力: {result.spell_power:F2}";
        gmCommentText.text   = result.gm_comment;
    }
}
