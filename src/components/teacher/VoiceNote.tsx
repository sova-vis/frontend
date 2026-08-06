"use client";

import { useRef, useState } from "react";
import { Mic, Play, Square, Trash2 } from "lucide-react";

// Per-question voice note. Records via MediaRecorder, stores as a base64 data
// URL. In read-only mode (student), only playback is shown.
export default function VoiceNote({
  value,
  onChange,
  readOnly,
}: {
  value: string | null;
  onChange?: (audio: string | null) => void;
  readOnly?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => onChange?.(String(reader.result || ""));
        reader.readAsDataURL(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      // Safety cap at 30s.
      setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 30000);
    } catch {
      setError("Microphone unavailable");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  if (readOnly) {
    return value ? (
      <div className="mt-1 flex items-center gap-2">
        <Play size={12} className="text-crimson" />
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio src={value} controls className="h-7 max-w-[220px]" />
      </div>
    ) : null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {recording ? (
        <button onClick={stop} className="inline-flex items-center gap-1.5 rounded-full bg-crimson text-paper px-3 py-1.5 text-xs font-semibold animate-pulse">
          <Square size={12} /> Stop
        </button>
      ) : (
        <button onClick={() => void start()} className="ed-btn-ghost px-3 py-1.5 text-xs">
          <Mic size={13} /> {value ? "Re-record" : "Voice note"}
        </button>
      )}
      {value && !recording && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={value} controls className="h-7 max-w-[200px]" />
          <button onClick={() => onChange?.(null)} className="text-ink-faint hover:text-crimson" title="Delete voice note"><Trash2 size={13} /></button>
        </>
      )}
      {error && <span className="text-xs text-crimson">{error}</span>}
    </div>
  );
}
