using UnityEngine;
using UnityEngine.EventSystems;

public class RecordingButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler
{
    [SerializeField] private SpellCaster spellCaster;
    [SerializeField] private MicrophoneRecorder recorder;

    public void OnPointerDown(PointerEventData _)
    {
        recorder.StartRecording();
    }

    public void OnPointerUp(PointerEventData _)
    {
        var clip = recorder.StopRecording();
        if (clip == null) return;

        byte[] wavBytes = WavConverter.ToWav(clip);
        spellCaster.CastSpell(wavBytes);
    }
}
