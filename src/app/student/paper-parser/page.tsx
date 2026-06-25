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
import { Reveal } from "@/components/ui/Motion";

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
        <div key={item.id} className="border-b border-line last:border-b-0">
          <button
            onClick={() => toggleFolder(item.id)}
            className="w-full flex items-center gap-2 p-3 text-left hover:bg-surface-soft transition-colors"
            style={{ paddingLeft }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin text-ink-faint" />
            ) : expanded ? (
              <ChevronDown size={17} className="text-ink-muted" />
            ) : (
              <ChevronRight size={17} className="text-ink-muted" />
            )}
            <FolderOpen size={16} className="text-ink-muted" />
            <span className="text-sm font-semibold text-ink truncate">{item.name}</span>
          </button>
          {expanded && (
            <div>
              {children.map((child) => renderLibraryItem(child, depth + 1))}
              {children.length === 0 && (
                <div className="p-3 text-sm text-ink-muted" style={{ paddingLeft: paddingLeft + 26 }}>
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
        className={`w-full flex items-start gap-2 p-3 text-left border-b border-line last:border-b-0 transition-colors ${
          selected
            ? "bg-crimson/5 text-crimson"
            : isQp
              ? "hover:bg-surface-soft text-ink-muted"
              : "bg-surface-soft text-ink-faint cursor-not-allowed"
        }`}
        style={{ paddingLeft }}
      >
        {isMs ? <FileCheck size={16} className="mt-0.5 flex-shrink-0" /> : <FileText size={16} className="mt-0.5 flex-shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium truncate">{item.name}</span>
          <span className={`mt-1 ${isQp ? "ed-pill-mint" : "ed-pill bg-surface-soft text-ink-muted"}`}>
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
        <div className="mt-3 rounded-xl border border-line bg-surface p-3">
          <p className="ed-label mb-2">Solve on device</p>
          <div className="grid grid-cols-4 gap-2">
            {["A", "B", "C", "D"].map((option) => (
              <button
                key={option}
                onClick={() => setAnswers((current) => ({ ...current, [id]: option }))}
                className={`rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                  answers[id] === option
                    ? "border-crimson bg-crimson text-white"
                    : "border-line bg-surface-soft text-ink-muted hover:bg-paper-soft"
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
      <div className="mt-3 rounded-xl border border-line bg-surface p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="ed-label">Your answer</p>
          <span className="text-[11px] text-ink-faint">{hint || "Answer space"}</span>
        </div>
        <textarea
          value={answers[id] ?? ""}
          onChange={(event) => setAnswers((current) => ({ ...current, [id]: event.target.value }))}
          placeholder="Type your answer here..."
          className="ed-input min-h-24 w-full resize-y"
        />
      </div>
    );
  };

  const renderParsedPaper = (practicePaper: ParsedPracticePaper) => {
    const result = practicePaper;

    return (
      <Reveal key={practicePaper.id}>
        <section className="rounded-3xl border border-line bg-surface-soft p-3 md:p-4 shadow-card">
        <div className="ed-card overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-line p-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold tracking-tight text-ink">{result.paper.title}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Ready with {result.paper.questions.length} question{result.paper.questions.length === 1 ? "" : "s"} from {result.filename}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink-muted shadow-card transition-colors hover:border-crimson/30 hover:bg-crimson/5">
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
                className="inline-flex items-center gap-2 rounded-xl border border-crimson/20 bg-crimson-soft px-3 py-2 text-xs font-bold text-crimson-ink transition-colors hover:bg-crimson/10"
              >
                <Trash2 size={14} />
                Remove
              </button>
              <span className="ed-pill-mint inline-flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                Parsed
              </span>
            </div>
            {answerUploads[practicePaper.id] && (
              <p className="text-xs font-medium text-ink-muted md:basis-full">
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
                <div key={label} className="rounded-xl border border-line bg-surface-soft p-3">
                  <p className="text-xs text-ink-faint">{label}</p>
                  <p className="truncate text-sm font-semibold text-ink">{value}</p>
                </div>
              ))}
            </div>

            {result.paper.instructions.length > 0 && (
              <div className="ed-card p-5">
                <h3 className="mb-3 font-display font-semibold tracking-tight text-ink">Instructions</h3>
                <ul className="space-y-2">
                  {result.paper.instructions.map((instruction, index) => (
                    <li key={`${instruction}-${index}`} className="flex gap-2 text-sm text-ink-muted">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-crimson" />
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.paper.source_materials.length > 0 && (
              <div className="space-y-4">
                {result.paper.source_materials.map((source) => (
                  <section key={source.id} className="ed-card overflow-hidden p-0">
                    <div className="border-b border-mint/20 bg-mint-soft px-5 py-4">
                      <h3 className="font-display font-semibold tracking-tight text-mint-ink">{source.title}</h3>
                      {source.used_by_question_ids.length > 0 && (
                        <p className="mt-1 text-xs text-mint-ink/70">Used by {source.used_by_question_ids.join(", ")}</p>
                      )}
                    </div>
                    <div className="p-5">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-ink-muted md:text-base">{source.text}</p>
                    </div>
                  </section>
                ))}
              </div>
            )}

            <div className="space-y-4">
              {result.paper.questions.map((question) => (
                <article key={question.id} className="ed-card p-5">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-ink px-2.5 py-1 text-xs font-bold text-paper">Q{question.number}</span>
                        {question.marks !== null && (
                          <span className="rounded-lg bg-gold-soft px-2.5 py-1 text-xs font-bold text-gold-ink">
                            {question.marks} mark{question.marks === 1 ? "" : "s"}
                          </span>
                        )}
                        {question.topic && (
                          <span className="rounded-lg bg-crimson/5 px-2.5 py-1 text-xs font-semibold text-crimson">{question.topic}</span>
                        )}
                      </div>
                      {question.stimulus && !result.paper.source_materials.some((source) => source.text === question.stimulus) && (
                        <div className="mt-4 rounded-xl border border-mint/20 bg-mint-soft p-4">
                          <p className="mb-2 text-xs font-bold text-mint-ink">Scenario / source material</p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-mint-ink/80">{question.stimulus}</p>
                        </div>
                      )}
                      <div className="mt-4">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink md:text-base">
                          {question.text || "Question text placeholder"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {question.diagrams_or_sources.length > 0 && (
                    <div className="mt-4 rounded-xl border border-mint/20 bg-mint-soft p-3">
                      <p className="mb-1 text-xs font-bold text-mint-ink">Referenced material</p>
                      {question.diagrams_or_sources.map((item, index) => (
                        <p key={`${item}-${index}`} className="text-sm text-mint-ink/80">{item}</p>
                      ))}
                    </div>
                  )}

                  {question.subquestions.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {question.subquestions.map((subquestion) => (
                        <div key={subquestion.id} className="rounded-xl border border-line bg-surface-soft p-4">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="text-xs font-bold text-ink-muted">({subquestion.label})</span>
                            {subquestion.marks !== null && (
                              <span className="text-xs font-semibold text-gold-ink">
                                {subquestion.marks} mark{subquestion.marks === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                          {subquestion.stimulus && (
                            <div className="mb-3 rounded-lg border border-mint/20 bg-mint-soft p-3">
                              <p className="mb-1 text-xs font-bold text-mint-ink">Subquestion context</p>
                              <p className="whitespace-pre-wrap text-sm text-mint-ink/80">{subquestion.stimulus}</p>
                            </div>
                          )}
                          <p className="whitespace-pre-wrap text-sm text-ink-muted">{subquestion.text}</p>
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
      </Reveal>
    );
  };

  return (
    <div className="min-h-full bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-5">
      <Reveal>
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <div className="ed-eyebrow inline-flex items-center gap-2 mb-3 text-crimson">
              <Braces size={13} />
              Practise
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-ink">
              Practise <span className="italic text-crimson">Question Papers</span>
            </h1>
            <p className="text-ink-muted mt-1 max-w-2xl text-sm leading-6">
              Pick a selected-subject question paper, parse it into a clean paper view, then practise MCQs or type theory answers.
            </p>
          </div>
        </header>
      </Reveal>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <Reveal className="h-fit">
        <section className="ed-card overflow-hidden p-0 h-fit">
          <div className="p-5 border-b border-line">
            <h2 className="font-display font-semibold tracking-tight text-ink flex items-center gap-2">
              <Upload size={18} className="text-crimson" />
              Choose Question Paper
            </h2>
            <p className="text-sm text-ink-muted mt-1">Only QP/question-paper PDFs from your selected subjects are shown.</p>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-soft p-1">
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
                    sourceMode === option.key ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
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
                    <label className="ed-label block mb-2">Subject</label>
                    <select
                      value={selectedSubject?.id ?? ""}
                      onChange={(event) => {
                        setSelectedSubjectId(event.target.value);
                        setSelectedPaper(null);
                        setExpandedFolders(new Set());
                      }}
                      className="ed-input w-full font-semibold"
                    >
                      <option value="">Select a subject...</option>
                      {selectedSubjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="rounded-2xl border border-line overflow-hidden max-h-[430px] overflow-y-auto custom-scrollbar">
                  {libraryLoading ? (
                    <div className="p-8 text-center text-ink-muted">
                      <Loader2 className="mx-auto mb-3 animate-spin text-crimson" size={24} />
                      Loading library...
                    </div>
                  ) : selectedSubjects.length === 0 ? (
                    <div className="p-8 text-center text-ink-muted">
                      Choose your subjects first to see matching question papers here.
                    </div>
                  ) : !selectedSubject ? (
                    <div className="p-8 text-center text-ink-muted">
                      Select a subject to browse its Past Papers folder.
                    </div>
                  ) : rootFolderId && rootLibraryItems.length > 0 && activeLibraryFolder ? (
                    loadingFolders.has(activeLibraryFolder.id) && !folderCache[activeLibraryFolder.id] ? (
                      <div className="p-8 text-center text-ink-muted">
                        <Loader2 className="mx-auto mb-3 animate-spin text-crimson" size={24} />
                        Loading {activeLibraryFolder.name}...
                      </div>
                    ) : topPastPaperFolders.length > 0 ? (
                      <div>
                        {topPastPaperFolders.map((item) => renderLibraryItem(item))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-ink-muted">No Past Papers folder found for this subject.</div>
                    )
                  ) : (
                    <div className="p-8 text-center text-ink-muted">No question papers found for this subject.</div>
                  )}
                </div>
              </>
            ) : (
              <label className="block rounded-2xl border border-dashed border-line bg-surface-soft p-6 text-center hover:border-crimson/40 hover:bg-crimson/5 transition-colors cursor-pointer">
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
                <FileText className="mx-auto mb-3 text-ink-faint" size={34} />
                <p className="text-sm font-semibold text-ink">
                  {file ? file.name : "Choose a past paper PDF"}
                </p>
                <p className="text-xs text-ink-faint mt-1">
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Click to browse from your device"}
                </p>
              </label>
            )}

            {sourceMode === "library" && selectedPaper && (
              <div className="rounded-xl border border-crimson/20 bg-crimson/5 p-3">
                <p className="text-xs font-semibold text-crimson mb-1">Selected paper</p>
                <p className="text-sm font-semibold text-ink truncate">{selectedPaper.name}</p>
              </div>
            )}

            <button
              onClick={parsePaper}
              disabled={loading || (sourceMode === "upload" ? !file : !selectedPaper)}
              className="ed-btn-ink w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              {loading ? "Preparing practise sheet..." : "Start Practise"}
            </button>

            {error && (
              <div className="rounded-xl border border-crimson/20 bg-crimson-soft p-3 text-sm text-crimson-ink flex gap-2">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </section>
        </Reveal>

        <section className="space-y-6">
          {parsedPapers.length === 0 && (
            <Reveal>
              <div className="ed-card p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="rounded-xl border border-dashed border-line p-4">
                      <div className="h-3 w-24 bg-surface-soft rounded-full mb-3" />
                      <div className="h-3 w-full bg-surface-soft rounded-full mb-2" />
                      <div className="h-3 w-3/4 bg-surface-soft rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          )}

          {parsedPapers.map((practicePaper) => renderParsedPaper(practicePaper))}
        </section>
      </div>
      </div>
    </div>
  );
}
