using System;
using System.IO;
using UnityEngine;

public static class WavConverter
{
    public static byte[] ToWav(AudioClip clip)
    {
        float[] samples = new float[clip.samples * clip.channels];
        clip.GetData(samples, 0);

        using var ms = new MemoryStream();
        using var writer = new BinaryWriter(ms);

        int sampleRate = clip.frequency;
        int channels = clip.channels;
        int sampleCount = samples.Length;
        int byteRate = sampleRate * channels * 2;

        // RIFF header
        writer.Write(System.Text.Encoding.ASCII.GetBytes("RIFF"));
        writer.Write(36 + sampleCount * 2);
        writer.Write(System.Text.Encoding.ASCII.GetBytes("WAVE"));

        // fmt chunk
        writer.Write(System.Text.Encoding.ASCII.GetBytes("fmt "));
        writer.Write(16);
        writer.Write((short)1);       // PCM
        writer.Write((short)channels);
        writer.Write(sampleRate);
        writer.Write(byteRate);
        writer.Write((short)(channels * 2)); // block align
        writer.Write((short)16);      // bits per sample

        // data chunk
        writer.Write(System.Text.Encoding.ASCII.GetBytes("data"));
        writer.Write(sampleCount * 2);
        foreach (float s in samples)
        {
            short pcm = (short)Mathf.Clamp(s * 32767f, short.MinValue, short.MaxValue);
            writer.Write(pcm);
        }

        return ms.ToArray();
    }
}
