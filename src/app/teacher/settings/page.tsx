"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Save, Trash2 } from "lucide-react";
import { Reveal } from "@/components/ui/Motion";
import DeleteAccountModal from "@/components/DeleteAccountModal";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { TeacherSettings, getSettings, patchSettings } from "@/lib/portalAdmin";
import { VISIBILITY_LABELS } from "@/lib/assignments";

const RELEASE_KEYS: { key: string; label: string }[] = [
  { key: "marks", label: "Marks" },
  { key: "breakdown", label: "Per-criterion breakdown" },
  { key: "comments", label: "Teacher comments" },
  { key: "scheme_missed", label: "Mark scheme for missed criteria" },
  { key: "ai_reasoning", label: "AI reasoning" },
];

const NOTIF_KEYS: { key: string; label: string }[] = [
  { key: "new_submissions", label: "New submissions" },
  { key: "deadline_reached", label: "Deadline reached" },
  { key: "review_backlog", label: "Review backlog" },
  { key: "moderator_flag", label: "Moderator flags" },
  { key: "enrolment_request", label: "Enrolment requests" },
];

export default function SettingsPage() {
  const { profile } = useClerkAuth();
  const [s, setS] = useState<TeacherSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    void getSettings().then(setS).catch((e) => setError(e.message));
  }, []);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    setSaved(false);
    try {
      await patchSettings(s);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!s) {
    return <div className="px-4 md:px-8 py-8 max-w-2xl mx-auto"><div className="h-64 rounded-[1.25rem] bg-surface-soft animate-pulse" /></div>;
  }

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Reveal>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">Settings</h1>
        </Reveal>

        {error && <p className="text-sm text-crimson">{error}</p>}

        {profile?.role === "admin" && (
          <Link href="/teacher/institution" className="ed-card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-crimson-soft text-crimson-ink"><Building2 size={18} /></span>
            <div>
              <p className="font-semibold text-ink">Institution administration</p>
              <p className="text-xs text-ink-faint">Teachers, seats, oversight grants, school performance, activity log</p>
            </div>
          </Link>
        )}

        {/* Grading defaults (§17.2) */}
        <section className="ed-card p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold">Grading defaults</h2>
          <div>
            <label className="ed-label">Auto-approve confidence threshold</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number" min={0} max={100}
                value={Math.round(s.auto_approve_threshold * 100)}
                onChange={(e) => setS({ ...s, auto_approve_threshold: Math.max(0, Math.min(100, Number(e.target.value))) / 100 })}
                className="ed-input px-3 py-2 text-sm w-24"
              />
              <span className="text-sm text-ink-muted">%</span>
              {s.auto_approve_floor != null && <span className="text-xs text-ink-faint">Institution floor: {Math.round(s.auto_approve_floor * 100)}%</span>}
            </div>
          </div>
          <div>
            <label className="ed-label">Default mark-scheme visibility</label>
            <select value={s.default_mark_scheme_visibility} onChange={(e) => setS({ ...s, default_mark_scheme_visibility: e.target.value })} className="ed-input mt-1 px-3 py-2.5 text-sm">
              {Object.entries(VISIBILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="ed-label mb-2 block">Default release content</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {RELEASE_KEYS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-ink-muted">
                  <input type="checkbox" checked={Boolean(s.default_release_content[key])} onChange={(e) => setS({ ...s, default_release_content: { ...s.default_release_content, [key]: e.target.checked } })} className="accent-crimson" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Notifications (§17.1) */}
        <section className="ed-card p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold">Notifications</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {NOTIF_KEYS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm text-ink-muted">
                <input type="checkbox" checked={Boolean(s.notif_prefs[key])} onChange={(e) => setS({ ...s, notif_prefs: { ...s.notif_prefs, [key]: e.target.checked } })} className="accent-crimson" />
                {label}
              </label>
            ))}
          </div>
          <div>
            <label className="ed-label">Email digest</label>
            <select value={s.digest_frequency} onChange={(e) => setS({ ...s, digest_frequency: e.target.value })} className="ed-input mt-1 px-3 py-2.5 text-sm w-40">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="off">Off</option>
            </select>
          </div>
        </section>

        {/* Timezone (§17.3) */}
        <section className="ed-card p-6">
          <h2 className="font-display text-lg font-semibold mb-3">Timezone</h2>
          <input value={s.timezone || ""} onChange={(e) => setS({ ...s, timezone: e.target.value })} placeholder="e.g. Asia/Karachi" className="ed-input px-3 py-2.5 text-sm" />
          <p className="text-xs text-ink-faint mt-1">Deadlines are stored in UTC and shown in your timezone.</p>
        </section>

        <div className="flex items-center gap-3">
          <button onClick={() => void save()} disabled={saving} className="ed-btn-primary px-5 py-2.5">
            <Save size={15} /> {saving ? "Saving…" : "Save settings"}
          </button>
          {saved && <span className="text-sm text-mint-ink">Saved</span>}
        </div>

        {/* Danger zone */}
        <section className="ed-card p-6 border border-crimson/30">
          <h2 className="font-display text-lg font-semibold text-crimson">Danger zone</h2>
          <p className="text-sm text-ink-muted mt-1">Permanently delete your account and all your Propel data.</p>
          <button onClick={() => setShowDelete(true)} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-crimson/40 text-crimson px-4 py-2.5 text-sm font-semibold hover:bg-crimson-soft">
            <Trash2 size={15} /> Delete account
          </button>
        </section>
      </div>

      {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} />}
    </div>
  );
}
