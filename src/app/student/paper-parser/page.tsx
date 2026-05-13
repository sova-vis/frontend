"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { apiCall } from "@/lib/api";
import { hydrateSubjectsFromProfile, StudentSubject } from "@/lib/studentPersonalization";
import { useClerkAuth } from "@/lib/useClerkAuth";

interface ParsedPaperQuestion {
  id: string;
  number: string;
  stimulus: string | null;
  text: string;
  marks: number | null;
  topic: string | null;
  subquestions: Array<{
    id: string;
    label: string;
    stimulus: string | null;
    text: string;
    marks: number | null;
    answer_space_hint: string;
  }>;
  answer_space_hint: string;
  diagrams_or_sources: string[];
}

interface ParsedPaper {
  title: string;
  subject: string | null;
  syllabus_code: string | null;
  year: number | null;
  session: string | null;
  paper: string | null;
  variant: string | null;
  duration: string | null;
  total_marks: number | null;
  instructions: string[];
  source_materials: Array<{
    id: string;
    title: string;
    text: string;
    used_by_question_ids: string[];
  }>;
  sections: Array<{
    title: string;
    instructions: string[];
    question_ids: string[];
  }>;
  questions: ParsedPaperQuestion[];
}

interface ParseResponse {
  paper: ParsedPaper;
  raw_json: ParsedPaper;
  model: string;
  filename: string;
  parsed_at: string;
}

interface FolderItem {
  id: string;
  name: string;
  isFolder: boolean;
  mimeType: string;
  folderType?: string;
  embedUrl?: string;
  downloadUrl?: string;
}

interface FolderCache {
  [folderId: string]: FolderItem[];
}

function metaValue(value: string | number | null): string {
  if (value === null || value === "") return "Not detected";
  return String(value);
}

export default function PaperParserPage() {
  const { profile } = useClerkAuth();
  const [sourceMode, setSourceMode] = useState<"library" | "upload">("library");
  const [file, setFile] = useState<File | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<FolderItem | null>(null);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [folderCache, setFolderCache] = useState<FolderCache>({});
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [selectedSubjects, setSelectedSubjects] = useState<StudentSubject[]>([]);

  useEffect(() => {
    setSelectedSubjects(hydrateSubjectsFromProfile(profile));
  }, [profile]);

  useEffect(() => {
    let active = true;

    const loadRoot = async () => {
      try {
        setLibraryLoading(true);
        const response = await apiCall("/papers/browse");
        if (!response.ok) throw new Error("Failed to load past paper library.");
        const data = (await response.json()) as { folderId: string; items: FolderItem[] };
        if (!active) return;
        setRootFolderId(data.folderId);
        setFolderCache({ [data.folderId]: data.items });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load past paper library.");
      } finally {
        if (active) setLibraryLoading(false);
      }
    };

    void loadRoot();

    return () => {
      active = false;
    };
  }, []);

  const loadFolder = async (folderId: string) => {
    if (folderCache[folderId]) return;
    try {
      setLoadingFolders((current) => new Set(current).add(folderId));
      const response = await apiCall(`/papers/browse/${folderId}`);
      if (!response.ok) throw new Error("Failed to load folder.");
      const data = (await response.json()) as { items: FolderItem[] };
      setFolderCache((current) => ({ ...current, [folderId]: data.items }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folder.");
    } finally {
      setLoadingFolders((current) => {
        const next = new Set(current);
        next.delete(folderId);
        return next;
      });
    }
  };

  const toggleFolder = async (folderId: string) => {
    if (expandedFolders.has(folderId)) {
      setExpandedFolders((current) => {
        const next = new Set(current);
        next.delete(folderId);
        return next;
      });
      return;
    }

    if (!folderCache[folderId]) await loadFolder(folderId);
    setExpandedFolders((current) => new Set(current).add(folderId));
  };

  const parsePaper = async () => {
    if (sourceMode === "upload" && !file) {
      setError("Choose a PDF past paper first.");
      return;
    }

    if (sourceMode === "library" && !selectedPaper) {
      setError("Choose a past paper from the library first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response =
        sourceMode === "upload"
          ? await (async () => {
              const formData = new FormData();
              formData.append("file", file as File);
              return apiCall("/paper-parser/parse", {
                method: "POST",
                body: formData,
              });
            })()
          : await apiCall("/paper-parser/parse-drive", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileId: selectedPaper?.id }),
            });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" && payload.error.trim()
            ? payload.error
            : "Failed to parse paper."
        );
      }

      setResult(payload as ParseResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse paper.");
    } finally {
      setLoading(false);
    }
  };

  const renderLibraryItem = (item: FolderItem, depth = 0) => {
    const expanded = expandedFolders.has(item.id);
    const loading = loadingFolders.has(item.id);
    const selected = selectedPaper?.id === item.id;
    const paddingLeft = depth * 18 + 12;

    if (item.isFolder) {
      return (
        <div key={item.id} className="border-b border-gray-100 last:border-b-0">
          <button
            onClick={() => toggleFolder(item.id)}
            className="w-full flex items-center gap-2 p-3 text-left hover:bg-gray-50 transition-colors"
            style={{ paddingLeft }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin text-gray-400" />
            ) : expanded ? (
              <ChevronDown size={17} className="text-gray-500" />
            ) : (
              <ChevronRight size={17} className="text-gray-500" />
            )}
            <FolderOpen size={16} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-800 truncate">{item.name}</span>
          </button>
          {expanded && (
            <div>
              {(folderCache[item.id] ?? []).map((child) => renderLibraryItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    if (!item.mimeType?.includes("pdf")) return null;

    return (
      <button
        key={item.id}
        onClick={() => {
          setSelectedPaper(item);
          setFile(null);
          setResult(null);
          setError(null);
        }}
        className={`w-full flex items-start gap-2 p-3 text-left border-b border-gray-100 last:border-b-0 transition-colors ${
          selected ? "bg-primary/5 text-primary" : "hover:bg-gray-50 text-gray-700"
        }`}
        style={{ paddingLeft }}
      >
        <FileText size={16} className="mt-0.5 flex-shrink-0" />
        <span className="text-sm font-medium truncate">{item.name}</span>
      </button>
    );
  };

  const rootLibraryItems = useMemo(() => {
    if (!rootFolderId) return [];
    const items = folderCache[rootFolderId] ?? [];
    if (selectedSubjects.length === 0) return [];

    const selectedIds = new Set(selectedSubjects.map((subject) => subject.id));
    const selectedNames = new Set(selectedSubjects.map((subject) => subject.name.toLowerCase()));

    return items.filter((item) => {
      if (!item.isFolder) return false;
      return selectedIds.has(item.id) || selectedNames.has(item.name.toLowerCase());
    });
  }, [folderCache, rootFolderId, selectedSubjects]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/5 text-primary text-xs font-semibold mb-3">
            <Braces size={13} />
            Structured extraction
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-gray-900">Past Paper Parser</h1>
          <p className="text-gray-500 mt-1 max-w-2xl">
            Select a paper from your past-paper library or upload a PDF, then convert it into clean structured JSON.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-fit">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Upload size={18} className="text-primary" />
              Choose Paper
            </h2>
            <p className="text-sm text-gray-500 mt-1">Use an existing past paper or upload your own PDF.</p>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
              {[
                { key: "library", label: "Past papers" },
                { key: "upload", label: "Upload PDF" },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => {
                    setSourceMode(option.key as "library" | "upload");
                    setError(null);
                    setResult(null);
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    sourceMode === option.key ? "bg-white text-gray-950 shadow-sm" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {sourceMode === "library" ? (
              <div className="rounded-2xl border border-gray-200 overflow-hidden max-h-[430px] overflow-y-auto">
                {libraryLoading ? (
                  <div className="p-8 text-center text-gray-500">
                    <Loader2 className="mx-auto mb-3 animate-spin text-primary" size={24} />
                    Loading library...
                  </div>
                ) : selectedSubjects.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Choose your subjects first to see matching past papers here.
                  </div>
                ) : rootFolderId && rootLibraryItems.length > 0 ? (
                  rootLibraryItems.map((item) => renderLibraryItem(item))
                ) : (
                  <div className="p-8 text-center text-gray-500">No selected subjects found in the library.</div>
                )}
              </div>
            ) : (
              <label className="block rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setSelectedPaper(null);
                    setError(null);
                    setResult(null);
                  }}
                />
                <FileText className="mx-auto mb-3 text-gray-400" size={34} />
                <p className="text-sm font-semibold text-gray-800">
                  {file ? file.name : "Choose a past paper PDF"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Click to browse from your device"}
                </p>
              </label>
            )}

            {sourceMode === "library" && selectedPaper && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-semibold text-primary mb-1">Selected paper</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{selectedPaper.name}</p>
              </div>
            )}

            <button
              onClick={parsePaper}
              disabled={loading || (sourceMode === "upload" ? !file : !selectedPaper)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              {loading ? "Structuring paper..." : "Parse to JSON"}
            </button>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex gap-2">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          {!result && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="rounded-xl border border-dashed border-gray-200 p-4">
                    <div className="h-3 w-24 bg-gray-100 rounded-full mb-3" />
                    <div className="h-3 w-full bg-gray-100 rounded-full mb-2" />
                    <div className="h-3 w-3/4 bg-gray-100 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{result.paper.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Structured {result.paper.questions.length} question{result.paper.questions.length === 1 ? "" : "s"} from {result.filename}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={13} />
                    Parsed
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    ["Subject", metaValue(result.paper.subject)],
                    ["Code", metaValue(result.paper.syllabus_code)],
                    ["Year", metaValue(result.paper.year)],
                    ["Marks", metaValue(result.paper.total_marks)],
                    ["Session", metaValue(result.paper.session)],
                    ["Paper", metaValue(result.paper.paper)],
                    ["Variant", metaValue(result.paper.variant)],
                    ["Duration", metaValue(result.paper.duration)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {result.paper.instructions.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 mb-3">Instructions</h3>
                  <ul className="space-y-2">
                    {result.paper.instructions.map((instruction, index) => (
                      <li key={`${instruction}-${index}`} className="text-sm text-gray-600 flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                        <span>{instruction}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.paper.source_materials.length > 0 && (
                <div className="space-y-4">
                  {result.paper.source_materials.map((source) => (
                    <section key={source.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-100 bg-sky-50">
                        <h3 className="font-bold text-sky-950">{source.title}</h3>
                        {source.used_by_question_ids.length > 0 && (
                          <p className="text-xs text-sky-800/70 mt-1">
                            Used by {source.used_by_question_ids.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="p-5">
                        <p className="text-sm md:text-base text-gray-800 whitespace-pre-wrap leading-7">
                          {source.text}
                        </p>
                      </div>
                    </section>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                {result.paper.questions.map((question) => (
                  <article key={question.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="rounded-lg bg-gray-950 text-white px-2.5 py-1 text-xs font-bold">
                            Q{question.number}
                          </span>
                          {question.marks !== null && (
                            <span className="rounded-lg bg-amber-50 text-amber-800 px-2.5 py-1 text-xs font-bold">
                              {question.marks} mark{question.marks === 1 ? "" : "s"}
                            </span>
                          )}
                          {question.topic && (
                            <span className="rounded-lg bg-primary/5 text-primary px-2.5 py-1 text-xs font-semibold">
                              {question.topic}
                            </span>
                          )}
                        </div>
                      {question.stimulus && !result.paper.source_materials.some((source) => source.text === question.stimulus) && (
                        <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 p-4">
                          <p className="text-xs font-bold text-sky-800 mb-2">Scenario / source material</p>
                          <p className="text-sm text-sky-950/80 whitespace-pre-wrap leading-relaxed">
                            {question.stimulus}
                          </p>
                        </div>
                      )}
                      <div className="mt-4">
                        <p className="text-sm md:text-base text-gray-900 whitespace-pre-wrap leading-relaxed">
                          {question.text || "Question text placeholder"}
                        </p>
                      </div>
                    </div>
                    </div>

                    {question.diagrams_or_sources.length > 0 && (
                      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
                        <p className="text-xs font-bold text-blue-800 mb-1">Referenced material</p>
                        {question.diagrams_or_sources.map((item, index) => (
                          <p key={`${item}-${index}`} className="text-sm text-blue-900/80">{item}</p>
                        ))}
                      </div>
                    )}

                    {question.subquestions.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {question.subquestions.map((subquestion) => (
                          <div key={subquestion.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-bold text-gray-600">({subquestion.label})</span>
                              {subquestion.marks !== null && (
                                <span className="text-xs font-semibold text-amber-800">
                                  {subquestion.marks} mark{subquestion.marks === 1 ? "" : "s"}
                                </span>
                              )}
                            </div>
                            {subquestion.stimulus && (
                              <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 p-3">
                                <p className="text-xs font-bold text-sky-800 mb-1">Subquestion context</p>
                                <p className="text-sm text-sky-950/80 whitespace-pre-wrap">{subquestion.stimulus}</p>
                              </div>
                            )}
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{subquestion.text}</p>
                            <div className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white p-3 text-xs text-gray-400">
                              {subquestion.answer_space_hint || "Answer placeholder"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-400">
                      {question.answer_space_hint || "Student answer placeholder"}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
