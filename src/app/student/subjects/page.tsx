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
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/5 text-primary text-xs font-semibold mb-3">
            <Sparkles size={13} />
            Personalization
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-gray-900">Choose Your Subjects</h1>
          <p className="text-gray-500 mt-1 max-w-2xl">
            Pick the subjects you study. Past papers and goal planning will focus on these choices.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={selectAll}
            className="px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Select all
          </button>
          <button
            onClick={clearAll}
            className="px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Save subjects
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search available subjects..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              />
            </div>
          </div>

          {loading && (
            <StudentPageLoading label="Loading subjects..." />
          )}

          {!loading && error && (
            <div className="p-12 text-center">
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
              {filteredSubjects.map((subject) => {
                const active = selectedIds.has(subject.id) || selectedNames.has(subject.name.toLowerCase());
                return (
                  <button
                    key={subject.id}
                    onClick={() => toggleSubject(subject)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      active
                        ? "border-primary/30 bg-primary/5 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={`p-2.5 rounded-lg border ${active ? "text-primary border-primary/20 bg-white" : "text-gray-600 border-gray-200 bg-gray-50"}`}>
                        <SubjectIcon name={subject.name} />
                      </div>
                      <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${active ? "bg-primary border-primary text-white" : "border-gray-300 text-transparent"}`}>
                        <Check size={14} />
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 mt-4 leading-snug">{subject.name}</h3>
                  </button>
                );
              })}
              {filteredSubjects.length === 0 && (
                <div className="sm:col-span-2 xl:col-span-3 p-10 text-center text-gray-500">
                  No subjects found.
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 h-fit">
          <p className="text-sm font-semibold text-gray-500 mb-2">Selected</p>
          <p className="text-4xl font-bold text-gray-900">{selected.length}</p>
          <div className="mt-4 space-y-2">
            {selected.slice(0, 8).map((subject) => (
              <div key={subject.id} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="truncate">{subject.name}</span>
              </div>
            ))}
            {selected.length > 8 && (
              <p className="text-xs text-gray-400">+{selected.length - 8} more</p>
            )}
          </div>
          <Link
            href="/student/past-papers"
            className="mt-6 inline-flex w-full items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            View filtered papers
          </Link>
        </aside>
      </div>
    </div>
  );
}
