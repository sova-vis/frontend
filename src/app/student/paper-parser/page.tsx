"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  FileCheck,
  FileUp,
  FolderOpen,
  Loader2,
  Sparkles,
  Trash2,
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

interface ParsedPracticePaper extends ParseResponse {
  id: string;
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

function isQuestionPaperName(name: string): boolean {
  const value = name.toLowerCase();
  return /\bqp\b|_qp\b|\bquestion\s*paper\b/.test(value);
}

function isMarkSchemeName(name: string): boolean {
  const value = name.toLowerCase();
  return /\bms\b|_ms\b|mark\s*scheme|marking\s*scheme/.test(value);
}

function isPastPapersFolderName(name: string): boolean {
  return /past\s*papers?|pastpapers?|papers?/i.test(name);
}

function isExcludedFolderName(name: string): boolean {
  return /syllabus|reference|topical|notes?|mark\s*scheme|examiner/i.test(name);
}

function looksLikeMcq(text: string, hint: string): boolean {
  const value = `${text}\n${hint}`.toLowerCase();
  if (value.includes("multiple choice") || value.includes("circle the letter")) return true;
  return /\bA[.)]\s+[\s\S]+\bB[.)]\s+[\s\S]+\bC[.)]\s+[\s\S]+\bD[.)]\s+/.test(text);
}

function normalizeFolderName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function folderNameMatchesSubject(folderName: string, subjectName: string): boolean {
  const folder = normalizeFolderName(folderName);
  const subject = normalizeFolderName(subjectName);
  return !!folder && !!subject && (folder === subject || folder.includes(subject) || subject.includes(folder));
}

export default function PaperParserPage() {
  const { profile } = useClerkAuth();
  const [sourceMode, setSourceMode] = useState<"library" | "upload">("library");
  const [file, setFile] = useState<File | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<FolderItem | null>(null);
  const [parsedPapers, setParsedPapers] = useState<ParsedPracticePaper[]>([]);
  const [answerUploads, setAnswerUploads] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [folderCache, setFolderCache] = useState<FolderCache>({});
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [selectedSubjects, setSelectedSubjects] = useState<StudentSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    const next = hydrateSubjectsFromProfile(profile);
    setSelectedSubjects(next);
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

  const loadFolder = useCallback(async (folderId: string) => {
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
  }, [folderCache]);

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

      const parsedPayload = payload as ParseResponse;
      setParsedPapers((current) => [
        ...current,
        {
          ...parsedPayload,
          id: `${Date.now()}-${parsedPayload.filename || "paper"}-${current.length}`,
        },
      ]);
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
      const children =
        rootPastPapersFolder?.id === item.id && selectedSubject
          ? (folderCache[item.id] ?? []).filter(
              (child) =>
                child.isFolder &&
                (child.id === selectedSubject.id || folderNameMatchesSubject(child.name, selectedSubject.name))
            )
          : folderCache[item.id] ?? [];

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
              {children.map((child) => renderLibraryItem(child, depth + 1))}
              {children.length === 0 && (
                <div className="p-3 text-sm text-gray-500" style={{ paddingLeft: paddingLeft + 26 }}>
                  No matching folders found here.
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    const isQp = isQuestionPaperName(item.name);
    const isMs = isMarkSchemeName(item.name);
    if (!item.mimeType?.includes("pdf") || (!isQp && !isMs)) return null;

    return (
      <button
        key={item.id}
        onClick={() => {
          if (!isQp) return;
          setSelectedPaper(item);
          setFile(null);
          setError(null);
        }}
        disabled={!isQp}
        className={`w-full flex items-start gap-2 p-3 text-left border-b border-gray-100 last:border-b-0 transition-colors ${
          selected
            ? "bg-primary/5 text-primary"
            : isQp
              ? "hover:bg-gray-50 text-gray-700"
              : "bg-gray-50 text-gray-400 cursor-not-allowed"
        }`}
        style={{ paddingLeft }}
      >
        {isMs ? <FileCheck size={16} className="mt-0.5 flex-shrink-0" /> : <FileText size={16} className="mt-0.5 flex-shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium truncate">{item.name}</span>
          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
            isQp ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
          }`}>
            {isQp ? "Question Paper - selectable" : "Mark Scheme - view only"}
          </span>
        </span>
      </button>
    );
  };

  const selectedSubject = useMemo(
    () => selectedSubjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, selectedSubjects]
  );

  const selectedSubjectFolder = useMemo(() => {
    if (!rootFolderId || !selectedSubject) return null;
    return (folderCache[rootFolderId] ?? []).find(
      (item) =>
        item.isFolder &&
        (item.id === selectedSubject.id ||
          folderNameMatchesSubject(item.name, selectedSubject.name))
    ) ?? null;
  }, [folderCache, rootFolderId, selectedSubject]);

  const rootPastPapersFolder = useMemo(() => {
    if (!rootFolderId) return null;
    return (folderCache[rootFolderId] ?? []).find(
      (item) => item.isFolder && isPastPapersFolderName(item.name)
    ) ?? null;
  }, [folderCache, rootFolderId]);

  useEffect(() => {
    if (!selectedSubjectFolder || folderCache[selectedSubjectFolder.id]) return;
    void loadFolder(selectedSubjectFolder.id);
  }, [folderCache, loadFolder, selectedSubjectFolder]);

  useEffect(() => {
    if (!rootPastPapersFolder || folderCache[rootPastPapersFolder.id]) return;
    void loadFolder(rootPastPapersFolder.id);
  }, [folderCache, loadFolder, rootPastPapersFolder]);

  const rootLibraryItems = useMemo(() => {
    if (selectedSubjectFolder) return [selectedSubjectFolder];
    if (rootPastPapersFolder) return [rootPastPapersFolder];
    return [];
  }, [rootPastPapersFolder, selectedSubjectFolder]);

  const topPastPaperFolders = useMemo(() => {
    if (!selectedSubjectFolder) return rootPastPapersFolder ? [rootPastPapersFolder] : [];
    const subjectChildren = folderCache[selectedSubjectFolder.id] ?? [];
    const directPastPapers = subjectChildren.filter(
      (item) => item.isFolder && isPastPapersFolderName(item.name)
    );
    if (directPastPapers.length > 0) return directPastPapers;
    return rootPastPapersFolder ? [rootPastPapersFolder] : [];
  }, [folderCache, rootPastPapersFolder, selectedSubjectFolder]);

  const activeLibraryFolder = selectedSubjectFolder ?? rootPastPapersFolder;

  const removeParsedPaper = (paperId: string) => {
    setParsedPapers((current) => current.filter((paper) => paper.id !== paperId));
    setAnswerUploads((current) => {
      const next = { ...current };
      delete next[paperId];
      return next;
    });
  };

  const renderAnswerBox = (id: string, text: string, hint: string) => {
    const isMcq = looksLikeMcq(text, hint);
    if (isMcq) {
      return (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-xs font-bold text-gray-500 mb-2">Solve on device</p>
          <div className="grid grid-cols-4 gap-2">
            {["A", "B", "C", "D"].map((option) => (
              <button
                key={option}
                onClick={() => setAnswers((current) => ({ ...current, [id]: option }))}
                className={`rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                  answers[id] === option
                    ? "border-primary bg-primary text-white"
                    : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-bold text-gray-500">Your answer</p>
          <span className="text-[11px] text-gray-400">{hint || "Answer space"}</span>
        </div>
        <textarea
          value={answers[id] ?? ""}
          onChange={(event) => setAnswers((current) => ({ ...current, [id]: event.target.value }))}
          placeholder="Type your answer here..."
          className="min-h-24 w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-primary/40 focus:bg-white focus:ring-2 focus:ring-primary/10"
        />
      </div>
    );
  };

  const renderParsedPaper = (practicePaper: ParsedPracticePaper) => {
    const result = practicePaper;

    return (
      <section key={practicePaper.id} className="rounded-3xl border border-gray-200 bg-gray-50/70 p-3 md:p-4 shadow-sm">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 p-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-gray-900">{result.paper.title}</h2>
              <p className="mt-1 text-sm text-gray-500">
                Ready with {result.paper.questions.length} question{result.paper.questions.length === 1 ? "" : "s"} from {result.filename}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5">
                <FileUp size={14} />
                {answerUploads[practicePaper.id] ? "Answer uploaded" : "Upload answer"}
                <input
                  type="file"
                  accept="application/pdf,.pdf,image/*"
                  className="hidden"
                  onChange={(event) => {
                    const uploadedFile = event.target.files?.[0];
                    if (!uploadedFile) return;
                    setAnswerUploads((current) => ({ ...current, [practicePaper.id]: uploadedFile.name }));
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => removeParsedPaper(practicePaper.id)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
              >
                <Trash2 size={14} />
                Remove
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 size={13} />
                Parsed
              </span>
            </div>
            {answerUploads[practicePaper.id] && (
              <p className="text-xs font-medium text-gray-500 md:basis-full">
                Handwritten answer attached: {answerUploads[practicePaper.id]}
              </p>
            )}
          </div>

          <div className="space-y-5 p-4 md:p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
                <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="truncate text-sm font-semibold text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            {result.paper.instructions.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h3 className="mb-3 font-bold text-gray-900">Instructions</h3>
                <ul className="space-y-2">
                  {result.paper.instructions.map((instruction, index) => (
                    <li key={`${instruction}-${index}`} className="flex gap-2 text-sm text-gray-600">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.paper.source_materials.length > 0 && (
              <div className="space-y-4">
                {result.paper.source_materials.map((source) => (
                  <section key={source.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                    <div className="border-b border-sky-100 bg-sky-50 px-5 py-4">
                      <h3 className="font-bold text-sky-950">{source.title}</h3>
                      {source.used_by_question_ids.length > 0 && (
                        <p className="mt-1 text-xs text-sky-800/70">Used by {source.used_by_question_ids.join(", ")}</p>
                      )}
                    </div>
                    <div className="p-5">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-gray-800 md:text-base">{source.text}</p>
                    </div>
                  </section>
                ))}
              </div>
            )}

            <div className="space-y-4">
              {result.paper.questions.map((question) => (
                <article key={question.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-gray-950 px-2.5 py-1 text-xs font-bold text-white">Q{question.number}</span>
                        {question.marks !== null && (
                          <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                            {question.marks} mark{question.marks === 1 ? "" : "s"}
                          </span>
                        )}
                        {question.topic && (
                          <span className="rounded-lg bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">{question.topic}</span>
                        )}
                      </div>
                      {question.stimulus && !result.paper.source_materials.some((source) => source.text === question.stimulus) && (
                        <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 p-4">
                          <p className="mb-2 text-xs font-bold text-sky-800">Scenario / source material</p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-sky-950/80">{question.stimulus}</p>
                        </div>
                      )}
                      <div className="mt-4">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900 md:text-base">
                          {question.text || "Question text placeholder"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {question.diagrams_or_sources.length > 0 && (
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
                      <p className="mb-1 text-xs font-bold text-blue-800">Referenced material</p>
                      {question.diagrams_or_sources.map((item, index) => (
                        <p key={`${item}-${index}`} className="text-sm text-blue-900/80">{item}</p>
                      ))}
                    </div>
                  )}

                  {question.subquestions.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {question.subquestions.map((subquestion) => (
                        <div key={subquestion.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-600">({subquestion.label})</span>
                            {subquestion.marks !== null && (
                              <span className="text-xs font-semibold text-amber-800">
                                {subquestion.marks} mark{subquestion.marks === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                          {subquestion.stimulus && (
                            <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 p-3">
                              <p className="mb-1 text-xs font-bold text-sky-800">Subquestion context</p>
                              <p className="whitespace-pre-wrap text-sm text-sky-950/80">{subquestion.stimulus}</p>
                            </div>
                          )}
                          <p className="whitespace-pre-wrap text-sm text-gray-800">{subquestion.text}</p>
                          {renderAnswerBox(`${practicePaper.id}:${subquestion.id}`, subquestion.text, subquestion.answer_space_hint)}
                        </div>
                      ))}
                    </div>
                  )}

                  {question.subquestions.length === 0 &&
                    renderAnswerBox(`${practicePaper.id}:${question.id}`, question.text, question.answer_space_hint)}
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/5 text-primary text-xs font-semibold mb-3">
            <Braces size={13} />
            Practise
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-gray-900">Practise Question Papers</h1>
          <p className="text-gray-500 mt-1 max-w-2xl">
            Pick a selected-subject question paper, parse it into a clean paper view, then practise MCQs or type theory answers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-fit">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Upload size={18} className="text-primary" />
              Choose Question Paper
            </h2>
            <p className="text-sm text-gray-500 mt-1">Only QP/question-paper PDFs from your selected subjects are shown.</p>
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
              <>
                {selectedSubjects.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2">Subject</label>
                    <select
                      value={selectedSubject?.id ?? ""}
                      onChange={(event) => {
                        setSelectedSubjectId(event.target.value);
                        setSelectedPaper(null);
                        setExpandedFolders(new Set());
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    >
                      <option value="">Select a subject...</option>
                      {selectedSubjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="rounded-2xl border border-gray-200 overflow-hidden max-h-[430px] overflow-y-auto">
                  {libraryLoading ? (
                    <div className="p-8 text-center text-gray-500">
                      <Loader2 className="mx-auto mb-3 animate-spin text-primary" size={24} />
                      Loading library...
                    </div>
                  ) : selectedSubjects.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      Choose your subjects first to see matching question papers here.
                    </div>
                  ) : !selectedSubject ? (
                    <div className="p-8 text-center text-gray-500">
                      Select a subject to browse its Past Papers folder.
                    </div>
                  ) : rootFolderId && rootLibraryItems.length > 0 && activeLibraryFolder ? (
                    loadingFolders.has(activeLibraryFolder.id) && !folderCache[activeLibraryFolder.id] ? (
                      <div className="p-8 text-center text-gray-500">
                        <Loader2 className="mx-auto mb-3 animate-spin text-primary" size={24} />
                        Loading {activeLibraryFolder.name}...
                      </div>
                    ) : topPastPaperFolders.length > 0 ? (
                      <div>
                        {topPastPaperFolders.map((item) => renderLibraryItem(item))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-gray-500">No Past Papers folder found for this subject.</div>
                    )
                  ) : (
                    <div className="p-8 text-center text-gray-500">No question papers found for this subject.</div>
                  )}
                </div>
              </>
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
              {loading ? "Preparing practise sheet..." : "Start Practise"}
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
          {parsedPapers.length === 0 && (
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

          {parsedPapers.map((practicePaper) => renderParsedPaper(practicePaper))}
        </section>
      </div>
    </div>
  );
}
