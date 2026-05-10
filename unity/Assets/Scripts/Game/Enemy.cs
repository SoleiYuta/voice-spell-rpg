using UnityEngine;

public class Enemy : MonoBehaviour
{
    [SerializeField] private float maxHp = 100f;
    public float CurrentHp { get; private set; }

    private void Awake() => CurrentHp = maxHp;

    public void TakeDamage(float spellPower)
    {
        float damage = spellPower * 10f;
        CurrentHp = Mathf.Max(0f, CurrentHp - damage);
        Debug.Log($"敵HP: {CurrentHp}/{maxHp} (ダメージ: {damage})");
        if (CurrentHp <= 0f) Debug.Log("敵を倒した！");
    }
}
