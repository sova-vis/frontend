"use client";

import { useState } from "react";
import { Copy, Download, Printer, X } from "lucide-react";
import {
  ProvisionedCredential,
  addExistingStudent,
  provisionStudents,
} from "@/lib/teacherClasses";

interface Props {
  classId: string;
  className: string;
  onClose: () => void;
  onChanged: () => void; // refetch roster
}

type Mode = "provision" | "existing";

// Add students to a class: provision new accounts (§4.3) or add an existing
// student by email (§4.5). Provisioning returns a one-time credential sheet.
export default function AddStudentsModal({ classId, className, onClose, onChanged }: Props) {
  const [mode, setMode] = useState<Mode>("provision");
  const [names, setNames] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState<ProvisionedCredential[] | null>(null);

  const parseRoster = (): { name: string; email?: string }[] =>
    names
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        // Accept "Name" or CSV "Name, email@x".
        const [name, maybeEmail] = line.split(/,|\t/).map((s) => s.trim());
        return { name, email: maybeEmail || undefined };
      })
      .filter((s) => s.name);

  const handleProvision = async () => {
    const roster = parseRoster();
    if (roster.length === 0) {
      setError("Add at least one student name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { created } = await provisionStudents(classId, roster);
      setCredentials(created);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to provision students");
    } finally {
      setBusy(false);
    }
  };

  const handleAddExisting = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      await addExistingStudent(classId, email.trim());
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add student");
      setBusy(false);
    }
  };

  if (credentials) {
    return <CredentialSheet className={className} credentials={credentials} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="ed-card w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-[1.25rem] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-semibold tracking-tight">Add students</h2>
          <button onClick={onClose} className="ed-btn-ghost p-2" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            onClick={() => setMode("provision")}
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
              mode === "provision" ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted"
            }`}
          >
            Provision new
          </button>
          <button
            onClick={() => setMode("existing")}
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
              mode === "existing" ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted"
            }`}
          >
            Add by email
          </button>
        </div>

        {mode === "provision" ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              One student per line. Add an email after a comma if you have one — it&apos;s optional. We generate a username
              and one-time password for each, shown once on the next screen.
            </p>
            <textarea
              value={names}
              onChange={(e) => setNames(e.target.value)}
              rows={7}
              placeholder={"Ayesha Khan\nBilal Ahmed, bilal@example.com\nZara Malik"}
              className="ed-input px-3 py-2.5 text-sm font-mono resize-none"
            />
            {error && <p className="text-sm text-crimson">{error}</p>}
            <button onClick={() => void handleProvision()} disabled={busy} className="ed-btn-primary w-full justify-center py-2.5">
              {busy ? "Creating accounts…" : "Create accounts"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">Add a student who already has a Propel account by their email.</p>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              className="ed-input px-3 py-2.5 text-sm"
            />
            {error && <p className="text-sm text-crimson">{error}</p>}
            <button onClick={() => void handleAddExisting()} disabled={busy} className="ed-btn-primary w-full justify-center py-2.5">
              {busy ? "Adding…" : "Add student"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CredentialSheet({
  className,
  credentials,
  onClose,
}: {
  className: string;
  credentials: ProvisionedCredential[];
  onClose: () => void;
}) {
  const copyAll = async () => {
    const text = credentials.map((c) => `${c.name}\t${c.username}\t${c.password}`).join("\n");
    await navigator.clipboard.writeText(`Name\tUsername\tPassword\n${text}`);
  };

  const downloadCsv = () => {
    const rows = [["Name", "Username", "Password"], ...credentials.map((c) => [c.name, c.username, c.password])];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${className.replace(/\s+/g, "-")}-credentials.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 print:static print:bg-transparent print:p-0">
      <div className="ed-card w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 print:shadow-none print:border-0">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <h2 className="font-display text-xl font-semibold tracking-tight">Credential sheet</h2>
          <button onClick={onClose} className="ed-btn-ghost p-2" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="ed-card-soft p-3 mb-4 text-sm text-ink-muted print:hidden">
          These one-time passwords are shown <span className="font-semibold text-ink">only now</span>. Print or download
          before closing — students set a new password on first login.
        </div>

        <div className="hidden print:block mb-4">
          <h1 className="font-display text-2xl font-semibold">{className} — student logins</h1>
        </div>

        <table className="w-full text-sm border border-line rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-surface-soft text-left">
              <th className="px-4 py-2.5 font-semibold">Name</th>
              <th className="px-4 py-2.5 font-semibold">Username</th>
              <th className="px-4 py-2.5 font-semibold">Password</th>
            </tr>
          </thead>
          <tbody>
            {credentials.map((c) => (
              <tr key={c.username} className="border-t border-line">
                <td className="px-4 py-2.5">{c.name}</td>
                <td className="px-4 py-2.5 font-mono">{c.username}</td>
                <td className="px-4 py-2.5 font-mono">{c.password}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-wrap gap-2 mt-5 print:hidden">
          <button onClick={() => window.print()} className="ed-btn-primary px-4 py-2.5">
            <Printer size={15} /> Print
          </button>
          <button onClick={downloadCsv} className="ed-btn-ghost px-4 py-2.5">
            <Download size={15} /> Download CSV
          </button>
          <button onClick={() => void copyAll()} className="ed-btn-ghost px-4 py-2.5">
            <Copy size={15} /> Copy
          </button>
          <button onClick={onClose} className="ed-btn-ghost px-4 py-2.5 ml-auto">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
