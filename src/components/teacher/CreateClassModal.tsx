"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { SyllabusLevel, syllabusesForLevel } from "@/lib/syllabus";
import { CreateClassInput, TeacherClass, createClass } from "@/lib/teacherClasses";
import { subjectSlug } from "@/lib/studentSubjects";

// Normalise a subject/folder name so "Mathematics (Syllabus D)" ≈ "Mathematics".
function normSubject(s: string): string {
  return s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\d+/g, " ").replace(/[^a-z]+/g, " ").trim();
}

interface Props {
  onClose: () => void;
  onCreated: (created: TeacherClass) => void;
}

// Create class (spec §3.1). The subject list comes from the actual question bank
// for the chosen level (the same source that drives student Practice and the
// assignment builder), so EVERY subject we have questions for is offered — not a
// hardcoded catalogue. A syllabus code is attached automatically when a standard
// one exists for the subject.
export default function CreateClassModal({ onClose, onCreated }: Props) {
  const [level, setLevel] = useState<SyllabusLevel>("O");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [syllabusCode, setSyllabusCode] = useState("");
  const [yearGroup, setYearGroup] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [bankSubjects, setBankSubjects] = useState<string[] | null>(null); // null = loading
  const [subjectQuery, setSubjectQuery] = useState("");
  const [subjectOpen, setSubjectOpen] = useState(false);

  // Load the subjects that actually have questions in the bank for this level.
  useEffect(() => {
    let active = true;
    setBankSubjects(null);
    const lvl = level === "A" ? "alevel" : "olevel";
    fetch(`/api/paper-practice?level=${lvl}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        const names = ((d?.subjects ?? []) as { name?: string }[])
          .map((s) => (s.name || "").trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setBankSubjects(names);
      })
      .catch(() => { if (active) setBankSubjects([]); });
    return () => { active = false; };
  }, [level]);

  // Standard syllabus codes for the chosen subject (Physics → 5054, 0625…).
  const codeMatches = useMemo(() => {
    if (!subject) return [];
    const n = normSubject(subject);
    return syllabusesForLevel(level).filter((s) => {
      const f = normSubject(s.subject);
      return f === n || f.startsWith(`${n} `) || n.startsWith(`${f} `);
    });
  }, [subject, level]);

  const chooseSubject = (name: string) => {
    setSubject(name);
    setSubjectOpen(false);
    setSubjectQuery("");
    const n = normSubject(name);
    const matches = syllabusesForLevel(level).filter((s) => {
      const f = normSubject(s.subject);
      return f === n || f.startsWith(`${n} `) || n.startsWith(`${f} `);
    });
    // Attach a standard code when one exists; otherwise derive a stable id so the
    // class still has a code (required) without blocking non-catalogue subjects.
    setSyllabusCode(matches[0]?.code || subjectSlug(name));
  };

  const filteredSubjects = useMemo(() => {
    const list = bankSubjects ?? [];
    const q = subjectQuery.trim().toLowerCase();
    return q ? list.filter((s) => s.toLowerCase().includes(q)) : list;
  }, [bankSubjects, subjectQuery]);

  const handleSubmit = async () => {
    if (!name.trim() || !subject.trim()) {
      setError("Class name and subject are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input: CreateClassInput = {
        name: name.trim(),
        subject: subject.trim(),
        syllabus_code: (syllabusCode || subjectSlug(subject)).trim(),
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
                    setSubject("");
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

          {/* Subject — sourced from the question bank for this level. */}
          <div className="relative">
            <label className="ed-label">Subject</label>
            <button
              type="button"
              onClick={() => { setSubjectOpen((o) => !o); setSubjectQuery(""); }}
              className="ed-input mt-1 px-3 py-2.5 text-sm w-full flex items-center justify-between text-left"
            >
              <span className={subject ? "text-ink" : "text-ink-faint"}>{subject || "Select a subject…"}</span>
              <ChevronDown size={15} className={`text-ink-faint transition-transform ${subjectOpen ? "rotate-180" : ""}`} />
            </button>
            {subjectOpen && (
              <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-line bg-paper shadow-lg">
                <div className="p-2 border-b border-line sticky top-0 bg-paper">
                  <input
                    autoFocus
                    value={subjectQuery}
                    onChange={(e) => setSubjectQuery(e.target.value)}
                    placeholder="Search subjects…"
                    className="ed-input px-3 py-2 text-sm w-full"
                  />
                </div>
                {bankSubjects === null ? (
                  <div className="px-3 py-3 text-sm text-ink-faint">Loading subjects…</div>
                ) : filteredSubjects.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-ink-faint">
                    {bankSubjects.length === 0 ? "No subjects found for this level yet." : `No subject matches “${subjectQuery}”.`}
                  </div>
                ) : (
                  filteredSubjects.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => chooseSubject(s)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-sm text-left hover:bg-surface-soft ${
                        s === subject ? "bg-crimson-soft text-crimson-ink" : "text-ink"
                      }`}
                    >
                      {s}
                      {s === subject && <Check size={14} />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Optional syllabus code — only when a standard one exists. */}
          {subject && codeMatches.length > 0 && (
            <div>
              <label className="ed-label">Syllabus code</label>
              <select
                value={syllabusCode}
                onChange={(e) => setSyllabusCode(e.target.value)}
                className="ed-input mt-1 px-3 py-2.5 text-sm"
              >
                {codeMatches.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.subject} — {o.code} ({o.board})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
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
