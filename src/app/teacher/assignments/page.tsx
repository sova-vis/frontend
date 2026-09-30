"use client";

/**
 * Assignments list (spec §5.2) — the teacher's assignments across all their
 * classes, on the shared `.pr` design system. Filter by class + status, jump
 * into any assignment, or start a new one. Reuses the stable listAssignments API.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/propel/Icon";
import { Segmented, EmptyState } from "@/components/propel/primitives";
import { Assignment, AssignmentStatus, listAssignments } from "@/lib/assignments";
import { TeacherClass, listClasses } from "@/lib/teacherClasses";

type Filter = "all" | "review" | "published" | "draft" | "closed";

const STATUS_META: Record<AssignmentStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "var(--surface-2)", fg: "var(--ink-soft)" },
  scheduled: { label: "Scheduled", bg: "var(--amber-soft, var(--surface-2))", fg: "var(--amber, var(--ink-soft))" },
  published: { label: "Live", bg: "var(--teal-soft, var(--surface-2))", fg: "var(--teal, var(--ink))" },
  closed: { label: "Closed", bg: "var(--surface-2)", fg: "var(--ink-faint)" },
};

export default function AssignmentsListPage() {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [classId, setClassId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [err, setErr] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [a, c] = await Promise.all([listAssignments(), listClasses()]);
        setAssignments(a);
        setClasses(c);
      } catch (e) { setErr((e as Error).message); setAssignments([]); }
    })();
  }, []);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const shown = useMemo(() => {
    let rows = assignments ?? [];
    if (classId) rows = rows.filter((a) => a.class_id === classId);
    if (filter === "review") rows = rows.filter((a) => (a.pending_reviews ?? 0) > 0);
    else if (filter !== "all") rows = rows.filter((a) => a.status === filter);
    return rows;
  }, [assignments, classId, filter]);

  const counts = useMemo(() => {
    const rows = assignments ?? [];
    return {
      all: rows.length,
      review: rows.filter((a) => (a.pending_reviews ?? 0) > 0).length,
      published: rows.filter((a) => a.status === "published").length,
      draft: rows.filter((a) => a.status === "draft").length,
      closed: rows.filter((a) => a.status === "closed").length,
    };
  }, [assignments]);

  return (
    <>
      <div className="row-between wrap gap-16" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="big-num" style={{ fontSize: 28 }}>Assignments</h1>
          <p className="faint" style={{ fontSize: 13.5, marginTop: 4 }}>Set past papers or custom questions, then mark and release.</p>
        </div>
        <div className="flex gap-8 wrap">
          <Link href="/teacher/questions" className="btn btn-secondary"><Icon name="edit" size={16} /> Custom questions</Link>
          <Link href="/teacher/assignments/new" className="btn btn-primary"><Icon name="plus" size={16} /> New assignment</Link>
        </div>
      </div>

      <div className="row-between wrap gap-12" style={{ marginBottom: 18 }}>
        <Segmented<Filter>
          options={[
            { value: "all", label: `All${counts.all ? ` (${counts.all})` : ""}` },
            { value: "review", label: `Needs review${counts.review ? ` (${counts.review})` : ""}` },
            { value: "published", label: "Live" },
            { value: "draft", label: "Drafts" },
            { value: "closed", label: "Closed" },
          ]}
          value={filter} onChange={setFilter}
        />
        {classes.length > 0 && (
          <select className="input" style={{ width: "auto", minWidth: 180 }} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {err && <p style={{ color: "var(--coral)", fontSize: 13, marginBottom: 12 }}>{err}</p>}

      {assignments === null ? (
        <div className="grid" style={{ gap: 12 }}>{[0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 92, borderRadius: 16 }} />)}</div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon="file_text"
          title={filter === "all" && !classId ? "No assignments yet" : "Nothing here"}
          body={filter === "all" && !classId ? "Create your first assignment from a past paper or your own questions." : "Try a different filter or class."}
          cta={filter === "all" && !classId ? "New assignment" : undefined}
          onCta={filter === "all" && !classId ? () => { window.location.href = "/teacher/assignments/new"; } : undefined}
        />
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {shown.map((a) => <AssignmentCard key={a.id} a={a} className={classMap.get(a.class_id)?.name} />)}
        </div>
      )}
    </>
  );
}

function AssignmentCard({ a, className }: { a: Assignment; className?: string }) {
  const st = STATUS_META[a.status];
  const due = a.deadline_at ? new Date(a.deadline_at) : null;
  const overdue = due && due < new Date() && a.status === "published";
  return (
    <Link href={`/teacher/assignments/${a.id}`} className="card card-pad" style={{ display: "block", transition: "border-color .15s, box-shadow .15s" }}>
      <div className="row-between wrap gap-12">
        <div style={{ minWidth: 0 }}>
          <div className="flex items-center gap-8 wrap" style={{ marginBottom: 6 }}>
            <span className="chip-tag" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
            {(a.pending_reviews ?? 0) > 0 && (
              <span className="chip-tag" style={{ background: "var(--crimson-soft)", color: "var(--crimson)" }}>
                <Icon name="flag" size={12} /> {a.pending_reviews} to review
              </span>
            )}
          </div>
          <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
          <div className="flex items-center gap-8 wrap faint" style={{ fontSize: 12.5, marginTop: 5 }}>
            {className && <span className="flex items-center gap-4"><Icon name="users" size={13} /> {className}</span>}
            <span>·</span>
            <span>{a.question_count ?? a.questions?.length ?? 0} questions</span>
            <span>·</span>
            <span>{a.total_marks} marks</span>
            {due && <><span>·</span><span style={{ color: overdue ? "var(--coral)" : undefined }}>Due {due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span></>}
          </div>
        </div>
        <Icon name="chevron_right" size={18} style={{ color: "var(--ink-faint)", flex: "none" }} />
      </div>
    </Link>
  );
}
