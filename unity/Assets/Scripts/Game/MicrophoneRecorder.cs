using UnityEngine;

public class MicrophoneRecorder : MonoBehaviour
{
    private const int MaxDurationSec = 15;
    private const int SampleRate = 16000;

    private AudioClip _clip;

    public void StartRecording()
    {
        _clip = Microphone.Start(null, false, MaxDurationSec, SampleRate);
    }

    public AudioClip StopRecording()
    {
        Microphone.End(null);
        return _clip;
    }
}
