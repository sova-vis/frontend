"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { AlertTriangle, X } from "lucide-react";
import { apiCall } from "@/lib/api";
import { useClerkAuth } from "@/lib/useClerkAuth";

// Self-service account deletion. Requires re-typing the account email; warns
// that all Propel data is removed; then deletes and signs out.
export default function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { user } = useUser();
  const { signOut } = useClerkAuth();
  const email = (user?.primaryEmailAddress?.emailAddress || "").toLowerCase();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const matches = typed.trim().toLowerCase() === email && !!email;

  const confirm = async () => {
    if (!matches) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiCall("/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_confirmation: typed.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not delete account");
      }
      if (typeof window !== "undefined" && user?.id) window.localStorage.removeItem(`propel_profile_${user.id}`);
      await signOut().catch(() => {});
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
      <div className="ed-card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-semibold text-crimson">Delete account</h2>
          <button onClick={onClose} className="ed-btn-ghost p-2"><X size={16} /></button>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-crimson-soft p-3 mb-4">
          <AlertTriangle size={18} className="text-crimson-ink shrink-0 mt-0.5" />
          <p className="text-sm text-crimson-ink">
            This permanently deletes your account and <b>all your Propel data</b> — your subjects, classes, assignments,
            submissions, marks and feedback. This cannot be undone.
          </p>
        </div>

        <label className="ed-label">Type your email to confirm</label>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={email}
          className="ed-input mt-1 px-3 py-2.5 text-sm"
          autoFocus
        />
        {error && <p className="text-sm text-crimson mt-2">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="ed-btn-ghost flex-1 justify-center py-2.5">Cancel</button>
          <button
            onClick={() => void confirm()}
            disabled={!matches || busy}
            className="flex-1 justify-center py-2.5 rounded-xl bg-crimson text-paper font-semibold disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      </div>
    </div>
  );
}
