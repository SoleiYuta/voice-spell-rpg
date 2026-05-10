using UnityEngine;

public class RecordingButton : MonoBehaviour
{
    [SerializeField] private SpellCaster spellCaster;

    public void OnButtonPressed()
    {
        spellCaster.CastSpell();
    }
}
