import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Trash2 } from "lucide-react";

interface Props { onRecordingComplete: (blob: Blob, durationMs: number) => void; disabled?: boolean; }

export function VoiceRecorder({ onRecordingComplete, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  // Refs to avoid stale closures in the onstop callback
  const durationRef = useRef(0);
  const cancelledRef = useRef(false);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
      chunksRef.current = [];
      cancelledRef.current = false;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        if (cancelledRef.current) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        onRecordingComplete(blob, durationRef.current * 1000);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setDuration(0);
      durationRef.current = 0;
      timerRef.current = setInterval(() => {
        setDuration((d) => {
          const next = d + 1;
          durationRef.current = next;
          return next;
        });
      }, 1000);
    } catch (err) { console.error("[VoiceRecorder] Failed to start:", err); }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    chunksRef.current = [];
    setRecording(false);
    setDuration(0);
    durationRef.current = 0;
  }, []);

  const formatTime = (s: number) => { const m = Math.floor(s / 60); return `${m}:${(s % 60).toString().padStart(2, "0")}`; };

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 border border-red-800/50 rounded-full">
          <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-mono text-red-300">{formatTime(duration)}</span></div>
        <button onClick={stopRecording} className="p-2 rounded-full bg-red-600 hover:bg-red-500" title="Stop"><MicOff size={16} className="text-white" /></button>
        <button onClick={cancelRecording} className="p-2 rounded-full hover:bg-slate-700 text-slate-400" title="Cancel"><Trash2 size={16} /></button>
      </div>
    );
  }

  return (
    <button onClick={startRecording} disabled={disabled}
      className="p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed" title="Record voice">
      <Mic size={18} /></button>
  );
}
