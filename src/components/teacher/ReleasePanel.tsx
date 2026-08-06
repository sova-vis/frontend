"use client";

import { useEffect, useState } from "react";
import { Check, Send } from "lucide-react";
import {
  ReleaseContent,
  ReleaseStatus,
  getReleaseStatus,
  releaseAll,
  releaseOne,
  setReleaseConfig,
} from "@/lib/feedbackRelease";

const CONTENT_LABELS: { key: keyof ReleaseContent; label: string }[] = [
  { key: "marks", label: "Marks" },
  { key: "breakdown", label: "Per-criterion breakdown" },
  { key: "comments", label: "Teacher comments" },
  { key: "scheme_missed", label: "Mark scheme for missed criteria" },
  { key: "ai_reasoning", label: "AI reasoning" },
];

// Result release (spec §11): mode, content control, batch release, status.
export default function ReleasePanel({ assignmentId }: { assignmentId: string }) {
  const [status, setStatus] = useState<ReleaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setStatus(await getReleaseStatus(assignmentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load release status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const toggleContent = async (key: keyof ReleaseContent) => {
    if (!status) return;
    const next = { ...status.release_content, [key]: !status.release_content[key] };
    setStatus({ ...status, release_content: next });
    try {
      await setReleaseConfig(assignmentId, { release_content: { [key]: next[key] } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
      void load();
    }
  };

  const toggleAuto = async () => {
    if (!status) return;
    const v = !status.auto_release;
    setStatus({ ...status, auto_release: v });
    try {
      await setReleaseConfig(assignmentId, { auto_release: v });
    } catch {
      void load();
    }
  };

  const release = async () => {
    const outstanding = (status?.total ?? 0) - (status?.released_count ?? 0);
    if (!window.confirm(`Release results to ${outstanding} student${outstanding === 1 ? "" : "s"} whose marking is complete?`)) return;
    setBusy(true);
    try {
      const { released } = await releaseAll(assignmentId, "reviewed");
      window.alert(`Released ${released} result${released === 1 ? "" : "s"}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="h-40 rounded-[1.25rem] bg-surface-soft animate-pulse" />;
  if (!status) return null;

  return (
    <section className="ed-card p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Results</h2>
          <p className="text-sm text-ink-muted">{status.released_count}/{status.total} released</p>
        </div>
        <button onClick={() => void release()} disabled={busy} className="ed-btn-primary px-4 py-2.5">
          <Send size={15} /> Release reviewed
        </button>
      </div>

      {error && <p className="text-sm text-crimson">{error}</p>}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={status.auto_release} onChange={() => void toggleAuto()} className="accent-crimson" />
        <span className="text-ink">Release automatically once every answer is reviewed</span>
      </label>

      <div>
        <p className="ed-label mb-2">Students receive</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {CONTENT_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
              <input type="checkbox" checked={status.release_content[key]} onChange={() => void toggleContent(key)} className="accent-crimson" />
              {label}
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-faint mt-2">Examiner report notes are never shown to students.</p>
      </div>

      {status.rows.length > 0 && (
        <div>
          <p className="ed-label mb-2">Release status</p>
          <div className="grid sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto">
            {status.rows.map((r) => (
              <div key={r.submission_id} className="flex items-center gap-2 text-sm">
                {r.released ? (
                  <Check size={14} className="text-mint-ink" />
                ) : r.withdrawn ? (
                  <span className="ed-pill-clay text-[0.6rem]">Withdrawn</span>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-ink-faint" />
                )}
                <span className="text-ink truncate flex-1">{r.student_name}</span>
                {!r.released && (
                  <button
                    onClick={async () => {
                      await releaseOne(r.submission_id);
                      void load();
                    }}
                    className="text-[0.7rem] text-crimson hover:underline shrink-0"
                  >
                    Release
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
