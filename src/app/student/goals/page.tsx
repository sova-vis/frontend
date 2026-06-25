"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileCheck,
  FileText,
  FolderOpen,
  Loader2,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { apiCall, getApiUrl } from "@/lib/api";
import {
  loadTrackedPapersForUser,
  PaperStatus,
  saveTrackedPapersForUser,
  toggleTrackedStatus,
  TrackedPaper,
} from "@/lib/paperTracking";
import { hydrateSubjectsFromProfile, StudentSubject } from "@/lib/studentPersonalization";
import { useAuth, useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import StudentPageLoading from "@/components/student/StudentPageLoading";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/Motion";

interface FolderItem {
  id: string;
  name: string;
  isFolder: boolean;
  mimeType: string;
  viewUrl?: string;
  downloadUrl?: string;
  embedUrl?: string;
  folderType?: string;
}

interface FolderCache {
  [folderId: string]: FolderItem[];
}

function getFileBadgeLabel(name: string): string {
  const value = name.toLowerCase();
  if (value.includes("qp") || value.includes("question")) return "Question Paper";
  if (value.includes("ms") || value.includes("mark") || value.includes("answer")) return "Mark Scheme";
  if (value.includes("er") || value.includes("examiner")) return "Examiner Report";
  return "Document";
}

export default function GoalsPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { profile } = useClerkAuth();
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [folderCache, setFolderCache] = useState<FolderCache>({});
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [trackedPapers, setTrackedPapers] = useState<TrackedPaper[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<StudentSubject[]>([]);
  const [viewingPaper, setViewingPaper] = useState<TrackedPaper | FolderItem | null>(null);
  const [mounted, setMounted] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setSelectedSubjects(hydrateSubjectsFromProfile(profile));
  }, [profile]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setInitialLoading(true);
        setError(null);
        const [trackingResponse, browseResponse] = await Promise.all([
          loadTrackedPapersForUser(getToken),
          apiCall("/papers/browse"),
        ]);

        if (!browseResponse.ok) throw new Error("Failed to load past paper folders.");
        const data = (await browseResponse.json()) as { folderId: string; items: FolderItem[] };
        if (!active) return;
        setTrackedPapers(trackingResponse);
        setRootFolderId(data.folderId);
        setFolderCache({ [data.folderId]: data.items });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load goals.");
      } finally {
        if (active) setInitialLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [getToken]);

  const updateTracked = (next: TrackedPaper[]) => {
    setTrackedPapers(next);
    void saveTrackedPapersForUser(next, getToken);
  };

  const hasStatus = (itemId: string, status: PaperStatus) => {
    const item = trackedPapers.find((paper) => paper.id === itemId);
    return item?.statuses.includes(status) ?? false;
  };

  const toggleStatus = (item: FolderItem, status: PaperStatus) => {
    if (!user) return;
    const next = toggleTrackedStatus(
      trackedPapers,
      {
        id: item.id,
        name: item.name,
        type: getFileBadgeLabel(item.name),
        viewUrl: item.viewUrl,
        downloadUrl: item.downloadUrl,
        embedUrl: item.embedUrl,
      },
      status
    );
    updateTracked(next);
  };

  const toggleTrackedPaperStatus = (paper: TrackedPaper, status: PaperStatus) => {
    const next = toggleTrackedStatus(
      trackedPapers,
      {
        id: paper.id,
        name: paper.name,
        type: paper.type,
        viewUrl: paper.viewUrl,
        downloadUrl: paper.downloadUrl,
        embedUrl: paper.embedUrl,
      },
      status
    );
    updateTracked(next);
    if (viewingPaper?.id === paper.id && status === "goal") {
      setViewingPaper(null);
    }
  };

  const removeGoal = (paper: TrackedPaper) => {
    if (paper.statuses.includes("goal")) {
      toggleTrackedPaperStatus(paper, "goal");
    }
  };

  const openPaper = (paper: TrackedPaper | FolderItem) => {
    if (!paper.embedUrl) return;
    setViewingPaper(paper);
  };

  const handleDownload = (paper: TrackedPaper | FolderItem) => {
    if (!paper.downloadUrl) return;
    const link = document.createElement("a");
    link.href = `${getApiUrl()}${paper.downloadUrl}`;
    link.download = paper.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadFolder = async (folderId: string) => {
    if (folderCache[folderId]) return;
    try {
      setLoadingFolders((current) => new Set(current).add(folderId));
      const response = await apiCall(`/papers/browse/${folderId}`);
      if (!response.ok) throw new Error("Failed to load folder.");
      const data = (await response.json()) as { items: FolderItem[] };
      setFolderCache((current) => ({ ...current, [folderId]: data.items }));
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

  const visibleSubjects = useMemo(() => {
    if (!rootFolderId) return [];
    const rootItems = folderCache[rootFolderId] ?? [];
    const selectedIds = new Set(selectedSubjects.map((subject) => subject.id));
    const selectedNames = new Set(selectedSubjects.map((subject) => subject.name.toLowerCase()));

    return rootItems.filter((item) => {
      if (!item.isFolder) return false;
      if (selectedSubjects.length === 0) return false;
      return selectedIds.has(item.id) || selectedNames.has(item.name.toLowerCase());
    });
  }, [folderCache, rootFolderId, selectedSubjects]);

  const goalPapers = trackedPapers.filter((paper) => paper.statuses.includes("goal"));
  const completedGoals = goalPapers.filter((paper) => paper.statuses.includes("completed"));
  const progressPercent = goalPapers.length === 0 ? 0 : Math.round((completedGoals.length / goalPapers.length) * 100);

  const renderFolder = (item: FolderItem, depth = 0) => {
    const expanded = expandedFolders.has(item.id);
    const loading = loadingFolders.has(item.id);
    const children = folderCache[item.id] ?? [];
    const paddingLeft = depth * 22 + 12;
    const folderLabel = item.folderType === "year" ? "Year" : item.folderType === "month" ? "Session" : item.folderType === "category" ? "Folder" : "Subject";

    return (
      <div key={item.id} className="border-b border-line last:border-b-0">
        <button
          onClick={() => toggleFolder(item.id)}
          className="w-full p-3 flex items-center gap-3 hover:bg-surface-soft transition-colors"
          style={{ paddingLeft }}
        >
          {loading ? <Loader2 size={18} className="animate-spin text-ink-faint" /> : expanded ? <ChevronDown size={20} className="text-ink-muted" /> : <ChevronRight size={20} className="text-ink-muted" />}
          <div className="p-2.5 rounded-xl border border-line bg-surface-soft text-ink-muted">
            {item.folderType === "year" || item.folderType === "month" ? <Calendar size={18} /> : <FolderOpen size={18} />}
          </div>
          <div className="flex-1 text-left min-w-0">
            <span className="font-semibold text-ink truncate block">{item.name}</span>
            <span className="text-xs text-ink-faint">{folderLabel}</span>
          </div>
        </button>

        {expanded && !loading && (
          <div>
            {children.map((child) => child.isFolder ? renderFolder(child, depth + 1) : renderFile(child, depth + 1))}
            {children.length === 0 && (
              <div className="px-4 py-3 text-sm text-ink-faint italic" style={{ paddingLeft: paddingLeft + 42 }}>
                Empty folder
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderFile = (item: FolderItem, depth = 0) => {
    const isGoal = hasStatus(item.id, "goal");
    const isDone = hasStatus(item.id, "completed");

    return (
      <div
        key={item.id}
        className="p-3 flex items-center justify-between gap-3 hover:bg-surface-soft transition-colors border-b border-line last:border-b-0"
        style={{ paddingLeft: depth * 22 + 12 }}
      >
        <button
          onClick={() => openPaper(item)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
          disabled={!item.embedUrl}
        >
          <div className={`p-2 rounded-lg border ${isDone ? "bg-mint-soft text-mint-ink border-mint/20" : "bg-surface text-ink-muted border-line"}`}>
            {isDone ? <FileCheck size={16} /> : <FileText size={16} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate hover:text-crimson">{item.name}</p>
            <p className="text-xs text-ink-faint">{getFileBadgeLabel(item.name)}</p>
          </div>
        </button>
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <button
            onClick={() => toggleStatus(item, "goal")}
            className={`p-2 rounded-lg border transition-colors ${isGoal ? "text-gold-ink bg-gold-soft border-gold/20" : "text-ink-faint bg-surface border-line hover:text-gold-ink hover:bg-gold-soft hover:border-gold/20"}`}
            title={isGoal ? "Remove from goals" : "Add to goals"}
          >
            <Target size={15} />
          </button>
          <button
            onClick={() => toggleStatus(item, "completed")}
            className={`p-2 rounded-lg border transition-colors ${isDone ? "text-mint-ink bg-mint-soft border-mint/20" : "text-ink-faint bg-surface border-line hover:text-mint-ink hover:bg-mint-soft hover:border-mint/20"}`}
            title={isDone ? "Mark not done" : "Mark completed"}
          >
            <CheckCircle2 size={15} />
          </button>
          {item.embedUrl && (
            <button
              onClick={() => openPaper(item)}
              className="p-2 text-paper bg-ink hover:bg-crimson rounded-lg transition-colors"
              title="View"
            >
              <Eye size={15} />
            </button>
          )}
          {item.downloadUrl && (
            <a
              href={`${getApiUrl()}${item.downloadUrl}`}
              className="p-2 text-ink bg-surface hover:bg-surface-soft border border-line rounded-lg transition-colors"
              title="Download"
            >
              <Download size={15} />
            </a>
          )}
        </div>
      </div>
    );
  };

  if (initialLoading) {
    return <StudentPageLoading label="Loading goals..." />;
  }

  if (error) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="bg-crimson-soft border border-crimson/20 rounded-xl p-6 text-center text-crimson-ink font-medium">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-transparent p-4 md:p-8 max-w-7xl mx-auto">
      {mounted && viewingPaper && viewingPaper.embedUrl && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6">
          <div className="bg-surface w-[min(96vw,1500px)] h-[min(94dvh,1100px)] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-line">
            <div className="p-4 sm:p-5 border-b border-line bg-surface-soft flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink-muted">Past paper</p>
                <h3 className="font-display font-semibold text-ink text-base sm:text-lg break-words leading-snug">
                  {viewingPaper.name}
                </h3>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                {"statuses" in viewingPaper && (
                  <>
                    <button
                      onClick={() => toggleTrackedPaperStatus(viewingPaper, "completed")}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold ${
                        viewingPaper.statuses.includes("completed")
                          ? "bg-mint-soft border-mint/20 text-mint-ink"
                          : "bg-surface border-line text-ink-muted hover:bg-surface-soft"
                      }`}
                    >
                      <CheckCircle2 size={15} />
                      {viewingPaper.statuses.includes("completed") ? "Done" : "Mark done"}
                    </button>
                    <button
                      onClick={() => removeGoal(viewingPaper)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-crimson/20 bg-crimson-soft text-sm font-semibold text-crimson-ink hover:bg-crimson/10"
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  </>
                )}
                {viewingPaper.downloadUrl && (
                  <button
                    onClick={() => handleDownload(viewingPaper)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-ink text-paper text-sm font-semibold hover:bg-crimson"
                  >
                    <Download size={15} />
                    Download
                  </button>
                )}
                <button
                  onClick={() => setViewingPaper(null)}
                  className="p-2 rounded-lg border border-line bg-surface text-ink-muted hover:bg-surface-soft"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              src={`${getApiUrl()}${viewingPaper.embedUrl}`}
              className="flex-1 w-full min-h-0"
              title="Goal paper viewer"
            />
          </div>
        </div>,
        document.body
      )}

      <Reveal>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-soft text-gold-ink text-xs font-bold uppercase tracking-[.12em] mb-3">
              <Target size={13} />
              Past paper goals
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-ink">
              Set Your <span className="italic text-crimson">Paper</span> Goals
            </h1>
            <p className="text-ink-muted mt-1 max-w-2xl">
              Add papers from your selected subjects, then mark them complete as you finish.
            </p>
          </div>
          <Link
            href="/student/subjects"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-muted hover:bg-surface-soft transition"
          >
            Edit subjects
          </Link>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
          <section className="ed-card overflow-hidden">
            {selectedSubjects.length === 0 ? (
              <div className="p-12 text-center">
                <Target className="w-12 h-12 text-ink-faint mx-auto mb-4" />
                <h3 className="text-lg font-display font-semibold text-ink mb-1">Choose subjects first</h3>
                <p className="text-sm text-ink-muted mb-6">Goals are created from the papers inside your selected subjects.</p>
                <Link href="/student/subjects" className="ed-btn-primary px-5 py-2.5">
                  Select subjects
                </Link>
              </div>
            ) : visibleSubjects.length === 0 ? (
              <div className="p-12 text-center text-ink-muted">No selected subjects were found in the past papers library.</div>
            ) : (
              visibleSubjects.map((subject) => renderFolder(subject))
            )}
          </section>

          <aside className="space-y-4">
            <div className="ed-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-ink">Goal Progress</h2>
                <span className="text-sm font-semibold text-gold-ink">{progressPercent}%</span>
              </div>
              <div className="h-3 bg-surface-soft rounded-full overflow-hidden">
                <div className="h-full bg-gold rounded-full" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl bg-gold-soft border border-gold/15 p-3">
                  <p className="text-xs text-gold-ink font-semibold">Goals</p>
                  <p className="text-2xl font-display font-bold text-ink">{goalPapers.length}</p>
                </div>
                <div className="rounded-xl bg-mint-soft border border-mint/15 p-3">
                  <p className="text-xs text-mint-ink font-semibold">Done</p>
                  <p className="text-2xl font-display font-bold text-ink">{completedGoals.length}</p>
                </div>
              </div>
            </div>

            <div className="ed-card p-5">
              <h2 className="font-display font-semibold text-ink mb-3">Current Goals</h2>
              {goalPapers.length === 0 ? (
                <p className="text-sm text-ink-muted">Use the target icon beside any paper to add it here.</p>
              ) : (
                <Stagger className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                  {goalPapers.map((paper) => (
                    <StaggerItem
                      key={paper.id}
                      className="rounded-xl border border-line bg-surface shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
                    >
                      <button
                        onClick={() => openPaper(paper)}
                        disabled={!paper.embedUrl}
                        className="w-full text-left p-3 flex items-start gap-3 disabled:cursor-default"
                      >
                        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${paper.statuses.includes("completed") ? "bg-mint" : "bg-gold"}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${paper.statuses.includes("completed") ? "text-ink-faint line-through" : "text-ink"}`}>{paper.name}</p>
                          <p className="text-xs text-ink-faint">{paper.type}</p>
                        </div>
                      </button>
                      <div className="px-3 pb-3 flex gap-2 justify-end">
                        <button
                          onClick={() => toggleTrackedPaperStatus(paper, "completed")}
                          className={`p-2 rounded-lg border transition-colors ${
                            paper.statuses.includes("completed")
                              ? "text-mint-ink bg-mint-soft border-mint/20"
                              : "text-ink-faint bg-surface border-line hover:text-mint-ink hover:bg-mint-soft hover:border-mint/20"
                          }`}
                          title={paper.statuses.includes("completed") ? "Mark not done" : "Mark completed"}
                        >
                          <CheckCircle2 size={15} />
                        </button>
                        {paper.embedUrl && (
                          <button
                            onClick={() => openPaper(paper)}
                            className="p-2 text-paper bg-ink hover:bg-crimson rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => removeGoal(paper)}
                          className="p-2 text-crimson bg-crimson-soft hover:bg-crimson/10 border border-crimson/15 rounded-lg transition-colors"
                          title="Remove from goals"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </div>
          </aside>
        </div>
      </Reveal>
    </div>
  );
}
