"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Atom,
  BookMarked,
  BookOpen,
  Calculator,
  Check,
  Dna,
  FlaskConical,
  Globe,
  Languages,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { apiCall } from "@/lib/api";
import {
  hydrateSubjectsFromProfile,
  saveSelectedSubjectsForUser,
  StudentSubject,
} from "@/lib/studentPersonalization";
import { useAuth, useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import StudentPageLoading from "@/components/student/StudentPageLoading";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/Motion";

interface FolderItem {
  id: string;
  name: string;
  isFolder: boolean;
  folderType?: string;
}

function SubjectIcon({ name }: { name: string }) {
  const value = name.toLowerCase();
  if (value.includes("chemistry") || value.includes("5070")) return <FlaskConical size={20} />;
  if (value.includes("physics") || value.includes("5054")) return <Atom size={20} />;
  if (value.includes("math") || value.includes("4037")) return <Calculator size={20} />;
  if (value.includes("biology") || value.includes("5090")) return <Dna size={20} />;
  if (value.includes("english") || value.includes("1123")) return <Languages size={20} />;
  if (value.includes("islamiyat") || value.includes("2058")) return <BookOpen size={20} />;
  if (value.includes("pakistan") || value.includes("2059")) return <Globe size={20} />;
  return <BookMarked size={20} />;
}

export default function StudentSubjectsPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { profile } = useClerkAuth();
  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const [selected, setSelected] = useState<StudentSubject[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(hydrateSubjectsFromProfile(profile));
  }, [profile]);

  useEffect(() => {
    let active = true;

    const loadSubjects = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiCall("/papers/browse");
        if (!response.ok) throw new Error("Failed to load subjects from past papers.");
        const data = (await response.json()) as { items?: FolderItem[] };
        const available = (data.items ?? [])
          .filter((item) => item.isFolder && (!item.folderType || item.folderType === "subject"))
          .map((item) => ({ id: item.id, name: item.name }));
        if (!active) return;
        setSubjects(available);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load subjects.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadSubjects();

    return () => {
      active = false;
    };
  }, []);

  const selectedIds = useMemo(() => new Set(selected.map((subject) => subject.id)), [selected]);
  const selectedNames = useMemo(
    () => new Set(selected.map((subject) => subject.name.toLowerCase())),
    [selected]
  );

  const filteredSubjects = subjects.filter((subject) =>
    subject.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSubject = (subject: StudentSubject) => {
    setSelected((current) => {
      if (current.some((item) => item.id === subject.id || item.name.toLowerCase() === subject.name.toLowerCase())) {
        return current.filter((item) => item.id !== subject.id && item.name.toLowerCase() !== subject.name.toLowerCase());
      }
      return [...current, subject];
    });
  };

  const save = async () => {
    setSaving(true);
    const next = await saveSelectedSubjectsForUser(selected, getToken, user?.id);
    setSelected(next);
    setSaving(false);
  };

  const selectAll = () => setSelected(subjects);
  const clearAll = () => setSelected([]);

  return (
    <div className="min-h-full bg-transparent p-4 md:p-8 max-w-6xl mx-auto">
      <Reveal>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
          <div>
            <div className="ed-eyebrow inline-flex px-3 py-1 rounded-lg bg-crimson/5 text-crimson mb-3 normal-case tracking-normal text-xs">
              <Sparkles size={13} />
              Personalization
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-ink">
              Choose Your <span className="italic text-crimson">Subjects</span>
            </h1>
            <p className="text-ink-muted mt-1 max-w-2xl">
              Pick the subjects you study. Past papers and goal planning will focus on these choices.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={selectAll}
              className="ed-btn-ghost px-4 py-2.5"
            >
              Select all
            </button>
            <button
              onClick={clearAll}
              className="ed-btn-ghost px-4 py-2.5"
            >
              Clear
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="ed-btn-ink px-5 py-2.5"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Save subjects
            </button>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <Reveal delay={0.05} className="ed-card overflow-hidden">
          <section>
            <div className="p-4 border-b border-line">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" size={18} />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search available subjects..."
                  className="ed-input pl-10"
                />
              </div>
            </div>

            {loading && (
              <StudentPageLoading label="Loading subjects..." />
            )}

            {!loading && error && (
              <div className="p-12 text-center">
                <p className="text-crimson font-medium">{error}</p>
              </div>
            )}

            {!loading && !error && (
              <Stagger className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                {filteredSubjects.map((subject) => {
                  const active = selectedIds.has(subject.id) || selectedNames.has(subject.name.toLowerCase());
                  return (
                    <StaggerItem key={subject.id}>
                      <button
                        onClick={() => toggleSubject(subject)}
                        className={`w-full h-full text-left rounded-xl border p-4 transition-all ${
                          active
                            ? "border-crimson/30 bg-crimson/5 shadow-card"
                            : "border-line bg-surface hover:border-ink/20 hover:bg-surface-soft"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className={`p-2.5 rounded-lg border ${active ? "text-crimson border-crimson/20 bg-surface" : "text-ink-muted border-line bg-surface-soft"}`}>
                            <SubjectIcon name={subject.name} />
                          </div>
                          <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${active ? "bg-crimson border-crimson text-white" : "border-line text-transparent"}`}>
                            <Check size={14} />
                          </div>
                        </div>
                        <h3 className="font-semibold text-ink mt-4 leading-snug">{subject.name}</h3>
                      </button>
                    </StaggerItem>
                  );
                })}
                {filteredSubjects.length === 0 && (
                  <div className="sm:col-span-2 xl:col-span-3 p-10 text-center text-ink-muted">
                    No subjects found.
                  </div>
                )}
              </Stagger>
            )}
          </section>
        </Reveal>

        <Reveal delay={0.1} className="h-fit">
          <aside className="ed-card p-5">
            <p className="ed-label mb-2">Selected</p>
            <p className="font-display text-4xl font-semibold tracking-tight text-ink">{selected.length}</p>
            <div className="mt-4 space-y-2">
              {selected.slice(0, 8).map((subject) => (
                <div key={subject.id} className="flex items-center gap-2 text-sm text-ink-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-crimson" />
                  <span className="truncate">{subject.name}</span>
                </div>
              ))}
              {selected.length > 8 && (
                <p className="text-xs text-ink-faint">+{selected.length - 8} more</p>
              )}
            </div>
            <Link
              href="/student/past-papers"
              className="ed-btn-ghost mt-6 w-full px-4 py-2.5"
            >
              View filtered papers
            </Link>
          </aside>
        </Reveal>
      </div>
    </div>
  );
}
