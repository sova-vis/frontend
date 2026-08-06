"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { SyllabusLevel, syllabusesForLevel } from "@/lib/syllabus";
import { CreateClassInput, TeacherClass, createClass } from "@/lib/teacherClasses";

interface Props {
  onClose: () => void;
  onCreated: (created: TeacherClass) => void;
}

// Create class (spec §3.1). A class belongs to exactly one syllabus code —
// a teacher teaching two syllabuses creates two classes.
export default function CreateClassModal({ onClose, onCreated }: Props) {
  const [level, setLevel] = useState<SyllabusLevel>("O");
  const [syllabusCode, setSyllabusCode] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [yearGroup, setYearGroup] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const options = useMemo(() => syllabusesForLevel(level), [level]);

  const handleSyllabus = (code: string) => {
    setSyllabusCode(code);
    const found = options.find((o) => o.code === code);
    if (found && !subject) setSubject(found.subject);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !subject.trim() || !syllabusCode) {
      setError("Class name, subject and syllabus code are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input: CreateClassInput = {
        name: name.trim(),
        subject: subject.trim(),
        syllabus_code: syllabusCode,
        level,
        year_group: yearGroup.trim() || undefined,
        description: description.trim() || undefined,
      };
      const created = await createClass(input);
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create class");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="ed-card w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-[1.25rem] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            New <span className="italic text-crimson">Class</span>
          </h2>
          <button onClick={onClose} className="ed-btn-ghost p-2" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="ed-label">Level</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["O", "A"] as SyllabusLevel[]).map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    setLevel(l);
                    setSyllabusCode("");
                  }}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    level === l ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted hover:bg-surface-soft"
                  }`}
                >
                  {l} Level
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="ed-label">Syllabus code</label>
            <select
              value={syllabusCode}
              onChange={(e) => handleSyllabus(e.target.value)}
              className="ed-input mt-1 px-3 py-2.5 text-sm"
            >
              <option value="">Select a syllabus…</option>
              {options.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.subject} — {o.code} ({o.board})
                </option>
              ))}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="ed-label">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Chemistry"
                className="ed-input mt-1 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="ed-label">Year group (optional)</label>
              <input
                value={yearGroup}
                onChange={(e) => setYearGroup(e.target.value)}
                placeholder="e.g. Year 11"
                className="ed-input mt-1 px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="ed-label">Class name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 11-B Chemistry"
              className="ed-input mt-1 px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="ed-label">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="ed-input mt-1 px-3 py-2.5 text-sm resize-none"
            />
          </div>

          {error && <p className="text-sm text-crimson">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="ed-btn-ghost flex-1 justify-center py-2.5">
              Cancel
            </button>
            <button onClick={() => void handleSubmit()} disabled={saving} className="ed-btn-primary flex-1 justify-center py-2.5">
              {saving ? "Creating…" : "Create class"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
