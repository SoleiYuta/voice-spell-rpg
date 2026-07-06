"use client";

// 録音ボタン（押して詠唱 → 離して送信）。#3 / 担当: kazuma660
// lib/audio.ts の startRecording と useGame の beginRecord / cast を繋ぐ。
// - pointerdown: onBegin() + 録音開始
// - pointerup / pointercancel: 録音停止 → onDone(blob) が cast(blob) を呼ぶ

import { useCallback, useRef, useState } from "react";
import { startRecording, isRecordingSupported, type Recorder } from "@/lib/audio";
import styles from "./RecordButton.module.css";

export interface RecordButtonProps {
  /** 録音開始時（useGame.beginRecord）。 */
  onBegin: () => void;
  /** 録音停止で得た Blob を渡す（useGame.cast）。 */
  onCast: (blob: Blob) => void;
  /** マイク不許可などのエラー通知。 */
  onError?: (message: string) => void;
  /** 録音中フラグ（useGame の phase === "recording"）。 */
  recording: boolean;
  disabled?: boolean;
}

export default function RecordButton({
  onBegin,
  onCast,
  onError,
  recording,
  disabled,
}: RecordButtonProps) {
  const recorderRef = useRef<Recorder | null>(null);
  const [starting, setStarting] = useState(false);
  const supported = isRecordingSupported();

  const begin = useCallback(async () => {
    if (recorderRef.current || starting) return;
    setStarting(true);
    try {
      // 先に Blob を受け取るコールバックを渡して録音開始
      const rec = await startRecording((blob) => {
        recorderRef.current = null;
        onCast(blob);
      });
      recorderRef.current = rec;
      onBegin();
    } catch (e) {
      onError?.(
        e instanceof Error && e.name === "NotAllowedError"
          ? "マイクの使用が許可されていません（ブラウザの許可が必要です）"
          : "マイクを使えませんでした",
      );
    } finally {
      setStarting(false);
    }
  }, [onBegin, onCast, onError, starting]);

  const end = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  if (!supported) {
    return <p className={styles.unsupported}>このブラウザは録音に対応していません</p>;
  }

  return (
    <button
      className={`${styles.btn} ${recording ? styles.recording : ""}`}
      // push-to-talk: 押している間だけ録音
      onPointerDown={(e) => {
        e.preventDefault();
        begin();
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={() => recording && end()}
      disabled={disabled || starting}
    >
      {recording ? "● 詠唱中… 離して発動" : starting ? "起動中…" : "🎤 押して詠唱"}
    </button>
  );
}
