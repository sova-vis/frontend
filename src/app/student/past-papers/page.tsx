"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { apiCall, getApiUrl } from "@/lib/api";
import { LEVEL_LABEL, PaperLevel, usePaperLevel } from "@/lib/paperLevel";
import {
  PaperStatus, TrackedPaper, loadTrackedPapersForUser, saveTrackedPapersForUser, toggleTrackedStatus,
} from "@/lib/paperTracking";
import { Icon } from "@/components/propel/Icon";
import { SubjGlyph, EmptyState, ToastProvider, useToast } from "@/components/propel/primitives";
import { subjectStyle } from "@/components/propel/subjects";

interface FolderItem {
  id: string; name: string; isFolder: boolean; folderType?: string;
  mimeType?: string; size?: string; modifiedTime?: string;
  viewUrl?: string; downloadUrl?: string; embedUrl?: string;
}
interface CollectedFile { file: FolderItem; trail: string[] }

type FileKind = "qp" | "ms" | "er" | "gt" | "in";

interface Paper {
  key: string;
  year: string;
  session: string;       // May/Jun · Oct/Nov · Feb/Mar
  paperCode: string;     // P1, P2 …
  variant: string;       // 1, 2 …
  files: Partial<Record<FileKind, FolderItem>> & { others: FolderItem[] };
  primary: FolderItem;
}

const SESSION_LABEL = ["May/Jun", "Oct/Nov", "Feb/Mar"];
// folders that are not practice papers — skip while collecting
const SKIP_FOLDER = /examiner|grade[_\s-]?threshold|syllabus|reference|specimen[_\s-]?answer/i;

function detectSession(s: string): string {
  const t = s.toLowerCase();
  if (/\bm[\s/_-]?j\b|may|jun|summer/.test(t)) return "May/Jun";
  if (/\bo[\s/_-]?n\b|oct|nov|winter/.test(t)) return "Oct/Nov";
  if (/\bf[\s/_-]?m\b|feb|mar/.test(t)) return "Feb/Mar";
  return "";
}
function paperFromSeg(seg: string): string {
  const m = seg.match(/^paper[_\s-]?(\d+)/i) || seg.match(/^p[_\s-]?(\d+)$/i);
  return m ? "P" + m[1] : "";
}
function variantFromSeg(seg: string): string {
  const m = seg.match(/^variant[_\s-]?(\d+)/i) || seg.match(/^v[_\s-]?(\d+)$/i);
  return m ? m[1] : "";
}
// Exact file-kind from the Cambridge-style suffix (…_QP.pdf / …_MS.pdf / …_ER.pdf …).
function detectKind(name: string): FileKind {
  const t = name.toLowerCase().replace(/\.pdf$/i, "");
  if (/(_|\b)ms(_|\b)$|(_|\b)ms(_|\b)|mark[_\s-]?scheme/.test(t)) return "ms";
  if (/(_|\b)qp(_|\b)$|(_|\b)qp(_|\b)|question[_\s-]?paper/.test(t)) return "qp";
  if (/(_|\b)er(_|\b)|examiner/.test(t)) return "er";
  if (/(_|\b)gt(_|\b)|grade[_\s-]?threshold/.test(t)) return "gt";
  if (/(_|\b)in(_|\b)|insert/.test(t)) return "in";
  return "qp";
}

function buildPapers(items: CollectedFile[], year: string): Paper[] {
  const map = new Map<string, Paper>();
  for (const { file, trail } of items) {
    let paperCode = trail.map(paperFromSeg).find(Boolean) || paperFromSeg(file.name) || "";
    let variant = trail.map(variantFromSeg).find(Boolean) || variantFromSeg(file.name) || "";
    const session = trail.map(detectSession).find(Boolean) || detectSession(file.name) || "";
    // A-Level trees use combined 2-digit codes ("Variant 12" = Paper 1, Variant 2)
    if (!paperCode && variant.length === 2) {
      paperCode = "P" + variant[0];
      variant = variant[1];
    }
    const kind = detectKind(file.name);
    const groupKey = paperCode || variant ? `${year}|${session}|${paperCode}|${variant}` : file.id;
    let p = map.get(groupKey);
    if (!p) { p = { key: groupKey, year, session, paperCode, variant, files: { others: [] }, primary: file }; map.set(groupKey, p); }
    if (!p.files[kind]) p.files[kind] = file;
    else p.files.others.push(file);
    p.primary = p.files.qp || p.files.ms || p.primary;
  }
  return Array.from(map.values())
    // keep only real practice papers (a question paper or mark scheme); drop loose
    // grade-thresholds / inserts / examiner reports that live beside them
    .filter((p) => p.files.qp || p.files.ms)
    .sort((a, b) => a.paperCode.localeCompare(b.paperCode) || a.variant.localeCompare(b.variant) || a.session.localeCompare(b.session));
}

async function browse(folderId?: string, level?: PaperLevel): Promise<{ folderId: string; items: FolderItem[] }> {
  // level only matters for the root listing — subfolder ids are globally unique
  const res = await apiCall(folderId ? `/papers/browse/${folderId}` : `/papers/browse?level=${level ?? "olevel"}`);
  if (!res.ok) throw new Error("Failed to load papers");
  return res.json();
}

// Recursively collect files under a single YEAR folder (small subtree; levels fetched
// in parallel). Skips non-paper folders (Examiner_Report, Grade_Thresholds…).
async function collectYear(folderId: string, trail: string[], depth = 0): Promise<CollectedFile[]> {
  if (depth > 4) return [];
  const { items } = await browse(folderId);
  const files = items.filter((i) => !i.isFolder).map((file) => ({ file, trail }));
  const folders = items.filter((i) => i.isFolder && !SKIP_FOLDER.test(i.name));
  const nested = await Promise.all(folders.map((f) => collectYear(f.id, [...trail, f.name], depth + 1)));
  return files.concat(...nested);
}

function PapersInner() {
  const router = useRouter();
  const { getToken } = useAuth();
  const toast = useToast();
  const { level, ready: levelReady } = usePaperLevel();

  const [subjects, setSubjects] = useState<FolderItem[]>([]);
  const [loadingRoot, setLoadingRoot] = useState(true);
  const [rootError, setRootError] = useState<string | null>(null);

  const [activeSubject, setActiveSubject] = useState<FolderItem | null>(null);
  const [years, setYears] = useState<FolderItem[]>([]);
  const [loadingYears, setLoadingYears] = useState(false);
  const [activeYear, setActiveYear] = useState<FolderItem | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(false);

  const yearCache = useRef<Map<string, Paper[]>>(new Map()); // key: subjectId|yearId
  const subjToken = useRef(0);
  const yearToken = useRef(0);

  const [tracked, setTracked] = useState<TrackedPaper[]>([]);
  const [viewing, setViewing] = useState<{ file: FolderItem; kind: FileKind } | null>(null);
  const [mounted, setMounted] = useState(false);

  const [session, setSession] = useState("all");
  const [viewType, setViewType] = useState<"qp" | "ms">("qp");
  const [q, setQ] = useState("");

  useEffect(() => setMounted(true), []);

  // tracked papers (independent of the selected level)
  useEffect(() => {
    let active = true;
    loadTrackedPapersForUser(getToken).then((items) => active && setTracked(items));
    return () => { active = false; };
  }, [getToken]);

  // root subjects — reloads whenever the O/A Levels toggle changes
  useEffect(() => {
    if (!levelReady) return; // wait for the persisted level to restore
    let active = true;
    subjToken.current++; yearToken.current++;   // cancel in-flight subject/year loads
    yearCache.current.clear();
    setLoadingRoot(true); setRootError(null);
    setSubjects([]); setActiveSubject(null);
    setYears([]); setActiveYear(null); setPapers([]);
    setSession("all"); setQ("");
    (async () => {
      try {
        const root = await browse(undefined, level);
        let folders = root.items.filter((i) => i.isFolder);
        if (folders.length === 1 && folders[0].folderType === "category") {
          const inner = await browse(folders[0].id);
          folders = inner.items.filter((i) => i.isFolder);
        }
        if (active) setSubjects(folders);
      } catch (e) {
        if (active) setRootError(e instanceof Error ? e.message : "Failed to load papers");
      } finally {
        if (active) setLoadingRoot(false);
      }
    })();
    return () => { active = false; };
  }, [level, levelReady]);

  useEffect(() => {
    if (!activeSubject && subjects.length) selectSubject(subjects[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects]);

  async function selectSubject(folder: FolderItem) {
    setActiveSubject(folder);
    setSession("all"); setQ(""); setPapers([]); setActiveYear(null); setYears([]);
    const token = ++subjToken.current;
    setLoadingYears(true);
    try {
      // subject → (Past_Papers) → year folders
      const inside = await browse(folder.id);
      let container = inside;
      const pp = inside.items.find((i) => i.isFolder && /past[_\s-]?papers/i.test(i.name));
      if (pp) container = await browse(pp.id);
      const yearFolders = container.items
        .filter((i) => i.isFolder && /^\d{4}$/.test(i.name.trim()))
        .sort((a, b) => b.name.localeCompare(a.name));
      if (token !== subjToken.current) return;
      setYears(yearFolders);
      if (yearFolders.length) void selectYear(yearFolders[0], folder);
    } catch {
      if (token === subjToken.current) setYears([]);
    } finally {
      if (token === subjToken.current) setLoadingYears(false);
    }
  }

  async function selectYear(yearFolder: FolderItem, subjectOverride?: FolderItem) {
    const subject = subjectOverride || activeSubject;
    if (!subject) return;
    setActiveYear(yearFolder);
    setSession("all"); setQ("");
    const cacheKey = `${subject.id}|${yearFolder.id}`;
    const cached = yearCache.current.get(cacheKey);
    if (cached) { setPapers(cached); return; }
    const token = ++yearToken.current;
    setLoadingPapers(true);
    setPapers([]);
    try {
      const files = await collectYear(yearFolder.id, [subject.name, yearFolder.name]);
      if (token !== yearToken.current) return;
      const built = buildPapers(files, yearFolder.name);
      yearCache.current.set(cacheKey, built);
      setPapers(built);
    } catch {
      if (token === yearToken.current) setPapers([]);
    } finally {
      if (token === yearToken.current) setLoadingPapers(false);
    }
  }

  const list = papers.filter((p) =>
    (session === "all" || p.session === session) &&
    (!q || `${p.year} ${p.session} ${p.paperCode} ${p.variant} ${p.primary.name}`.toLowerCase().includes(q.toLowerCase()))
  );

  const hasStatus = (id: string, s: PaperStatus) => tracked.find((t) => t.id === id)?.statuses.includes(s) ?? false;
  const toggle = (p: Paper, status: PaperStatus) => {
    const was = hasStatus(p.primary.id, status);
    const next = toggleTrackedStatus(tracked, {
      id: p.primary.id,
      name: `${activeSubject?.name ?? ""} ${p.year} ${p.session} ${p.paperCode} V${p.variant}`.replace(/\s+/g, " ").trim() || p.primary.name,
      type: p.paperCode || "Paper",
      viewUrl: p.primary.viewUrl, downloadUrl: p.primary.downloadUrl, embedUrl: p.primary.embedUrl,
    }, status);
    setTracked(next);
    void saveTrackedPapersForUser(next, getToken);
    const labels: Record<PaperStatus, string> = { goal: "goals", in_progress: "in progress", completed: "completed", bookmarked: "bookmarks" };
    toast(was ? `Removed from ${labels[status]}` : `Added to ${labels[status]}`, status === "bookmarked" ? "bookmark" : status === "completed" ? "check_circle" : status === "goal" ? "target" : "clock");
  };

  const statusBadge = (p: Paper) => {
    if (hasStatus(p.primary.id, "completed")) return <span className="badge teal"><Icon name="check_circle" size={13} /> Completed</span>;
    if (hasStatus(p.primary.id, "in_progress")) return <span className="badge amber"><Icon name="clock" size={13} /> In progress</span>;
    if (hasStatus(p.primary.id, "goal")) return <span className="badge purple"><Icon name="target" size={13} /> Goal</span>;
    return <span className="badge neutral">Not started</span>;
  };

  const curSubj = subjectStyle(activeSubject?.name);
  const totalTracked = tracked.length;

  return (
    <div className="pr">
      <div className="main stagger flex-col gap-24">
        <div className="row-between wrap" style={{ gap: 12 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Library</div>
            <h1 style={{ fontSize: "clamp(26px,3.5vw,36px)" }}>{LEVEL_LABEL[level]} past papers</h1>
            <p className="muted mt-6">Pick a subject and year, then practise the question paper or open the mark scheme.</p>
          </div>
          {totalTracked > 0 && <span className="badge crimson" style={{ alignSelf: "center" }}><Icon name="bookmark" size={13} /> {totalTracked} tracked</span>}
        </div>

        {loadingRoot ? (
          <LoadingCard label="Loading library…" />
        ) : rootError ? (
          <div className="card"><EmptyState icon="alert" title="Couldn't load papers" body={rootError} cta="Retry" onCta={() => location.reload()} /></div>
        ) : subjects.length === 0 ? (
          <div className="card"><EmptyState icon="book" title="No subjects available yet" body="The paper library is empty or still syncing." /></div>
        ) : (
          <div className="papers-layout">
            {/* subject rail */}
            <aside className="card card-pad papers-rail" style={{ padding: 14, alignSelf: "start" }}>
              <div className="eyebrow" style={{ padding: "4px 8px 10px" }}>Subjects</div>
              <div className="flex-col" style={{ gap: 3 }}>
                {subjects.map((s) => {
                  const on = activeSubject?.id === s.id;
                  const st = subjectStyle(s.name);
                  return (
                    <button key={s.id} onClick={() => selectSubject(s)} className="flex items-center gap-10"
                      style={{ padding: "9px 10px", borderRadius: 11, textAlign: "left",
                        background: on ? st.color + "16" : "transparent", color: on ? st.color : "var(--ink-soft)", fontWeight: on ? 600 : 500 }}>
                      <Icon name={st.icon} size={18} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name.trim()}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* main */}
            <div className="flex-col gap-16">
              {/* year chips + filters */}
              <div className="card card-pad" style={{ padding: 14 }}>
                {loadingYears ? (
                  <div className="flex items-center gap-8 faint" style={{ fontSize: 13 }}><Icon name="refresh" size={15} className="spin" /> Loading years…</div>
                ) : years.length === 0 ? (
                  <div className="faint" style={{ fontSize: 13 }}>No years found for this subject.</div>
                ) : (
                  <div className="flex gap-10 wrap items-center">
                    <div className="search" style={{ flex: 1, minWidth: 170 }}>
                      <Icon name="search" size={17} className="faint" />
                      <input placeholder={`Search ${activeSubject?.name?.trim() ?? ""} papers…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search papers" />
                    </div>
                    <FilterSelect label="Year" value={activeYear?.id ?? ""}
                      onChange={(id) => { const y = years.find((f) => f.id === id); if (y) selectYear(y); }}
                      options={years.map((y) => [y.id, y.name] as [string, string])} />
                    <FilterSelect label="Session" value={session} onChange={setSession} options={[["all", "All sessions"], ...SESSION_LABEL.map((s) => [s, s] as [string, string])]} />
                    <FilterSelect label="View" value={viewType} onChange={(v) => setViewType(v as "qp" | "ms")} options={[["qp", "Question paper"], ["ms", "Mark scheme"]]} />
                    <span className="faint" style={{ fontSize: 12.5, alignSelf: "center" }}>{list.length} papers</span>
                  </div>
                )}
              </div>

              {/* results */}
              {loadingPapers ? (
                <LoadingCard label={`Loading ${activeYear?.name ?? ""} papers…`} />
              ) : list.length === 0 ? (
                <div className="card"><EmptyState icon="search" title="No papers here"
                  body={papers.length === 0 ? "No question papers found for this year." : "Try another session or clear your search."}
                  cta={papers.length === 0 ? undefined : "Clear filters"} onCta={() => { setSession("all"); setQ(""); }} /></div>
              ) : (
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
                  {list.map((p) => (
                    <PaperCard key={p.key} p={p} subj={curSubj} viewType={viewType}
                      bookmarked={hasStatus(p.primary.id, "bookmarked")}
                      onToggle={(s) => toggle(p, s)} statusBadge={statusBadge(p)} hasStatus={(s) => hasStatus(p.primary.id, s)}
                      onView={(file, kind) => setViewing({ file, kind })}
                      onPractice={() => router.push("/student/paper-practice")} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* viewer modal — portalled to <body> so it sits above the sticky navbar */}
      {mounted && viewing && createPortal(
        <div className="pr" onClick={() => setViewing(null)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "transparent", minHeight: 0, display: "grid", placeItems: "center", padding: 16 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,16,12,.6)", backdropFilter: "blur(3px)" }} />
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
            style={{ position: "relative", maxWidth: "min(96vw,1400px)", width: "100%", height: "min(92vh,1000px)", padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="row-between" style={{ padding: 16, borderBottom: "1px solid var(--line)", gap: 10 }}>
              <div className="flex items-center gap-8" style={{ minWidth: 0 }}>
                <span className={"badge " + (viewing.kind === "ms" ? "teal" : "crimson")} style={{ flex: "none" }}>{viewing.kind === "ms" ? "Mark scheme" : "Question paper"}</span>
                <h3 style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{viewing.file.name.replace(/\.pdf$/i, "")}</h3>
              </div>
              <div className="flex gap-8" style={{ flex: "none" }}>
                <a className="btn btn-secondary btn-sm" href={`${getApiUrl()}${viewing.file.downloadUrl}`} target="_blank" rel="noreferrer"><Icon name="download" size={15} /> <span className="hide-sm">Download</span></a>
                <button className="icon-btn" onClick={() => setViewing(null)} aria-label="Close" style={{ border: "1px solid var(--line-strong)" }}><Icon name="x" /></button>
              </div>
            </div>
            <iframe src={`${getApiUrl()}${viewing.file.embedUrl || viewing.file.viewUrl}`} title="Paper viewer" style={{ flex: 1, width: "100%", border: "none", minHeight: 0 }} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="card card-pad" style={{ display: "grid", placeItems: "center", padding: 60 }}>
      <div className="flex-col items-center gap-12" style={{ display: "flex" }}>
        <Icon name="refresh" size={28} className="spin" style={{ color: "var(--crimson)" }} />
        <span className="faint">{label}</span>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="chip" style={{ padding: "0 6px 0 13px", gap: 4, cursor: "pointer" }}>
      <span className="faint" style={{ fontSize: 12 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ border: "none", background: "transparent", padding: "8px 4px", fontWeight: 500, cursor: "pointer", outline: "none", color: "var(--ink)" }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function PaperCard({ p, subj, viewType, bookmarked, onToggle, statusBadge, hasStatus, onView, onPractice }: {
  p: Paper; subj: { color: string; icon: string }; viewType: "qp" | "ms"; bookmarked: boolean;
  onToggle: (s: PaperStatus) => void; statusBadge: React.ReactNode; hasStatus: (s: PaperStatus) => boolean;
  onView: (file: FolderItem, kind: FileKind) => void; onPractice: () => void;
}) {
  const title = [p.year, p.session].filter(Boolean).join(" · ") || p.primary.name.replace(/\.pdf$/i, "");
  const sub = [p.paperCode && p.paperCode.replace("P", "Paper "), p.variant && "Variant " + p.variant].filter(Boolean).join(" · ") || "Past paper";
  const qp = p.files.qp;
  const ms = p.files.ms;
  // eye opens the document chosen via the "View" dropdown, falling back to whatever exists
  const viewDoc = p.files[viewType] || qp || ms || p.primary;
  const viewKind: FileKind = p.files[viewType] ? viewType : qp ? "qp" : ms ? "ms" : "qp";
  const viewLabel = viewKind === "ms" ? "mark scheme" : "question paper";
  return (
    <div className="card card-pad card-hover" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="row-between">
        <div className="flex items-center gap-10" style={{ minWidth: 0 }}>
          <SubjGlyph subj={subj} size={38} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
            <div className="faint" style={{ fontSize: 12.5 }}>{sub}</div>
          </div>
        </div>
        <button className="icon-btn" style={{ width: 34, height: 34, color: bookmarked ? "var(--crimson)" : "var(--ink-faint)", flex: "none" }}
          onClick={() => onToggle("bookmarked")} aria-label="Bookmark">
          <Icon name="bookmark" size={18} fill={bookmarked ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="flex items-center gap-8 wrap" style={{ fontSize: 12.5 }}>
        {statusBadge}
        {qp && <span className="badge crimson" style={{ fontSize: 11 }}>QP</span>}
        {ms && <span className="badge teal" style={{ fontSize: 11 }}>MS</span>}
        {p.files.er && <span className="badge neutral" style={{ fontSize: 11 }}>ER</span>}
      </div>

      {/* status toggles (feed the dashboard) */}
      <div className="flex gap-6">
        {([["goal", "target"], ["in_progress", "clock"], ["completed", "check_circle"]] as [PaperStatus, string][]).map(([s, ic]) => {
          const on = hasStatus(s);
          const tone = s === "goal" ? "var(--purple)" : s === "in_progress" ? "var(--amber-deep)" : "var(--teal-deep)";
          const bg = s === "goal" ? "var(--purple-soft)" : s === "in_progress" ? "var(--amber-soft)" : "var(--teal-soft)";
          return (
            <button key={s} className="icon-btn" title={s.replace("_", " ")} onClick={() => onToggle(s)}
              style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--line)", color: on ? tone : "var(--ink-faint)", background: on ? bg : "var(--surface)" }}>
              <Icon name={ic} size={15} />
            </button>
          );
        })}
      </div>

      <div className="flex gap-8 items-center" style={{ marginTop: "auto" }}>
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={onPractice}>
          <Icon name="play" size={13} fill="#fff" stroke={0} /> Practice
        </button>
        <button className="icon-btn" title={`View ${viewLabel}`} aria-label={`View ${viewLabel}`} onClick={() => onView(viewDoc, viewKind)}
          style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--line-strong)", color: "var(--ink-soft)", flex: "none" }}>
          <Icon name="eye" size={16} />
        </button>
      </div>
    </div>
  );
}

export default function PastPapersPage() {
  return (
    <ToastProvider>
      <PapersInner />
    </ToastProvider>
  );
}
