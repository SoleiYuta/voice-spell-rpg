// マイク録音（getUserMedia + MediaRecorder）。#22 / 担当: kazuma660
// 録音した音声を webm/opus の Blob で返すだけ。WAV変換は backend 側（設計書§6）なので
// フロントは webm のまま /evaluate に渡す。useGame の cast(blob) にそのまま流せる。

export interface Recorder {
  /** 録音を止める。onDone コールバックが Blob を受け取る。 */
  stop: () => void;
  /** 途中キャンセル（Blob を作らずマイクだけ解放）。 */
  cancel: () => void;
}

/** ブラウザが録音に対応しているか（未対応環境ではボタンを出さない用）。 */
export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

/**
 * 録音を開始する。返り値の stop() を呼ぶと onDone(blob) が発火する。
 * マイク不許可・非対応時は reject するので、呼び側で try/catch してエラー表示する。
 */
export async function startRecording(
  onDone: (blob: Blob) => void,
): Promise<Recorder> {
  if (!isRecordingSupported()) {
    throw new Error("このブラウザは録音に対応していません");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // 対応している最良の webm/opus を選ぶ（Safari など未対応なら既定に任せる）。
  const preferred = "audio/webm;codecs=opus";
  const mimeType = MediaRecorder.isTypeSupported(preferred) ? preferred : undefined;
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  const chunks: BlobPart[] = [];
  let cancelled = false;

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop()); // マイクを必ず解放
    if (cancelled) return;
    onDone(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
  };

  recorder.start();

  return {
    stop: () => {
      if (recorder.state !== "inactive") recorder.stop();
    },
    cancel: () => {
      cancelled = true;
      if (recorder.state !== "inactive") recorder.stop();
    },
  };
}
