using UnityEngine;

public class CombatManager : MonoBehaviour
{
    [SerializeField] private SpellCaster spellCaster;
    [SerializeField] private Enemy enemy;

    private void OnEnable()  => spellCaster.OnEvaluationComplete += HandleEvaluation;
    private void OnDisable() => spellCaster.OnEvaluationComplete -= HandleEvaluation;

    private void HandleEvaluation(EvaluationResult result)
    {
        enemy.TakeDamage(result.spell_power);
    }
}
