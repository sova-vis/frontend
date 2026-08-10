"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { SyllabusLevel, syllabusesForLevel } from "@/lib/syllabus";
import { CreateClassInput, TeacherClass, createClass } from "@/lib/teacherClasses";
import { apiCall } from "@/lib/api";

// Normalise a subject/folder name so "Mathematics (Syllabus D)" ≈ "Mathematics".
function normSubject(s: string): string {
  return s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\d+/g, " ").replace(/[^a-z]+/g, " ").trim();
}

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
  const [syllabusQuery, setSyllabusQuery] = useState("");
  const [syllabusOpen, setSyllabusOpen] = useState(false);
  const [librarySubjects, setLibrarySubjects] = useState<string[] | null>(null); // null = not loaded yet

  // Load the subjects that actually exist in the past-paper library for this
  // level, so the picker only offers subjects we have papers for.
  useEffect(() => {
    let active = true;
    setLibrarySubjects(null);
    type Folder = { id: string; name: string; isFolder: boolean; folderType?: string };
    const browse = async (path: string): Promise<Folder[]> => {
      const res = await apiCall(path);
      if (!res.ok) throw new Error("browse failed");
      const data = (await res.json()) as { items?: Folder[] };
      return (data.items ?? []).filter((i) => i.isFolder);
    };
    void (async () => {
      try {
        let folders = await browse(`/papers/browse?level=${level === "A" ? "alevel" : "olevel"}`);
        // Some libraries wrap everything in one category folder.
        if (folders.length === 1 && folders[0].folderType === "category") {
          folders = await browse(`/papers/browse/${folders[0].id}`);
        }
        if (active) setLibrarySubjects(folders.map((f) => normSubject(f.name)).filter(Boolean));
      } catch {
        if (active) setLibrarySubjects([]); // fall back to the full catalogue
      }
    })();
    return () => { active = false; };
  }, [level]);

  const options = useMemo(() => {
    const all = syllabusesForLevel(level);
    // Before the library loads, or if it's unavailable, show the full catalogue.
    if (!librarySubjects || librarySubjects.length === 0) return all;
    const mine = all.filter((o) => {
      const n = normSubject(o.subject);
      return librarySubjects.some((f) => f === n || f.startsWith(`${n} `) || n.startsWith(`${f} `));
    });
    return mine.length ? mine : all;
  }, [level, librarySubjects]);
  const selectedSyllabus = options.find((o) => o.code === syllabusCode) || null;
  const filteredSyllabuses = useMemo(() => {
    const q = syllabusQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.subject} ${o.code} ${o.board}`.toLowerCase().includes(q));
  }, [options, syllabusQuery]);

  const handleSyllabus = (code: string) => {
    setSyllabusCode(code);
    // Always adopt the canonical catalog subject so the question bank resolves it.
    const found = options.find((o) => o.code === code);
    if (found) setSubject(found.subject);
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

          <div className="relative">
            <label className="ed-label">Syllabus code</label>
            <input
              value={syllabusOpen ? syllabusQuery : (selectedSyllabus ? `${selectedSyllabus.subject} — ${selectedSyllabus.code} (${selectedSyllabus.board})` : "")}
              onChange={(e) => { setSyllabusQuery(e.target.value); setSyllabusOpen(true); }}
              onFocus={() => { setSyllabusOpen(true); setSyllabusQuery(""); }}
              onBlur={() => window.setTimeout(() => setSyllabusOpen(false), 150)}
              placeholder="Search subject or code…"
              className="ed-input mt-1 px-3 py-2.5 text-sm"
            />
            {syllabusOpen && (
              <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-line bg-paper shadow-lg">
                {filteredSyllabuses.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-ink-faint">No syllabus matches “{syllabusQuery}”.</div>
                ) : filteredSyllabuses.map((o) => (
                  <button
                    key={o.code}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { handleSyllabus(o.code); setSyllabusOpen(false); setSyllabusQuery(""); }}
                    className={`block w-full text-left px-3 py-2 text-sm hover:bg-surface-soft ${o.code === syllabusCode ? "bg-crimson-soft text-crimson-ink" : "text-ink"}`}
                  >
                    {o.subject} — {o.code} <span className="text-ink-faint">({o.board})</span>
                  </button>
                ))}
              </div>
            )}
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
