"use client";

/**
 * Teacher Students tab — everyone enrolled across the teacher's classes, plus the
 * join requests waiting for approval. Reuses the stable class APIs (listClasses +
 * listEnrollments per class) and the approve/reject/remove actions, so there's no
 * new backend. On the `.pr` design.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/propel/Icon";
import { Segmented, EmptyState, useToast } from "@/components/propel/primitives";
import { listClasses, listEnrollments, decideEnrollments, removeStudent, type TeacherClass, type Enrollment } from "@/lib/teacherClasses";
import { resolveName } from "@/lib/displayName";

type Row = { classId: string; className: string; e: Enrollment };

export default function StudentsPage() {
  const toast = useToast();
  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [enr, setEnr] = useState<Record<string, Enrollment[]>>({});
  const [classFilter, setClassFilter] = useState("");
  const [tab, setTab] = useState<"students" | "requests">("students");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = async () => {
    try {
      const cs = (await listClasses()).filter((c) => !c.archived && (c.can_grade ?? c.is_owner ?? true));
      setClasses(cs);
      const entries = await Promise.all(cs.map(async (c) => [c.id, await listEnrollments(c.id).catch(() => [] as Enrollment[])] as const));
      setEnr(Object.fromEntries(entries));
    } catch (e) { toast((e as Error).message, "alert"); setClasses([]); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  const classMap = useMemo(() => new Map((classes ?? []).map((c) => [c.id, c.name])), [classes]);
  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const [cid, list] of Object.entries(enr)) for (const e of list) out.push({ classId: cid, className: classMap.get(cid) ?? "Class", e });
    return out;
  }, [enr, classMap]);

  const nameOf = (e: Enrollment) => resolveName({ full_name: e.full_name, email: e.email });
  const pending = useMemo(() => rows.filter((r) => r.e.status === "pending" && (!classFilter || r.classId === classFilter)), [rows, classFilter]);
  const active = useMemo(() => rows.filter((r) => r.e.status === "active" && (!classFilter || r.classId === classFilter)).sort((a, b) => nameOf(a.e).localeCompare(nameOf(b.e))), [rows, classFilter]);
  const pendingCount = useMemo(() => rows.filter((r) => r.e.status === "pending").length, [rows]);

  const decide = async (classId: string, ids: string[], decision: "approve" | "reject") => {
    try { await decideEnrollments(classId, ids, decision); toast(decision === "approve" ? "Approved" : "Rejected", "check_circle"); load(); }
    catch (e) { toast((e as Error).message, "alert"); }
  };
  const remove = async (classId: string, clerkId: string) => {
    try { await removeStudent(classId, clerkId); toast("Removed", "check_circle"); setConfirmRemove(null); load(); }
    catch (e) { toast((e as Error).message, "alert"); }
  };

  return (
    <>
      <div className="row-between wrap gap-16" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="big-num" style={{ fontSize: 28 }}>Students</h1>
          <p className="faint" style={{ fontSize: 13.5, marginTop: 4 }}>Everyone across your classes, and requests waiting to join.</p>
        </div>
        {classes && classes.length > 0 && (
          <select className="input" style={{ width: "auto", minWidth: 180 }} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <Segmented<"students" | "requests">
          options={[{ value: "students", label: `Students (${active.length})` }, { value: "requests", label: `Requests${pendingCount ? ` (${pendingCount})` : ""}` }]}
          value={tab} onChange={setTab}
        />
      </div>

      {classes === null ? (
        <div className="grid" style={{ gap: 10 }}>{[0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 64, borderRadius: 14 }} />)}</div>
      ) : classes.length === 0 ? (
        <EmptyState icon="users" title="No classes yet" body="Create a class and share its join code — students appear here once they join." />
      ) : tab === "requests" ? (
        pending.length === 0
          ? <EmptyState icon="check_circle" title="No pending requests" body="When a student enters a join code, their request shows up here to approve." />
          : <div className="grid" style={{ gap: 10 }}>
              {pending.map((r) => (
                <StudentRow key={r.e.id} r={r} sub={`Requested ${new Date(r.e.requested_at).toLocaleDateString()}`}>
                  <button className="btn btn-soft btn-sm" onClick={() => decide(r.classId, [r.e.student_clerk_id], "approve")}><Icon name="check_circle" size={14} /> Approve</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => decide(r.classId, [r.e.student_clerk_id], "reject")} style={{ color: "var(--coral)" }}><Icon name="x" size={14} /></button>
                </StudentRow>
              ))}
            </div>
      ) : (
        active.length === 0
          ? <EmptyState icon="users" title="No students yet" body="Approved students across your classes show up here." />
          : <div className="grid" style={{ gap: 10 }}>
              {active.map((r) => (
                <StudentRow key={r.e.id} r={r} sub={r.e.approved_at ? `Joined ${new Date(r.e.approved_at).toLocaleDateString()}` : "Active"}>
                  <Link href={`/teacher/classes/${r.classId}/students/${r.e.student_clerk_id}`} className="btn btn-ghost btn-sm">View</Link>
                  {confirmRemove === r.e.id
                    ? <>
                        <button className="btn btn-sm" style={{ background: "var(--coral)", color: "#fff" }} onClick={() => remove(r.classId, r.e.student_clerk_id)}>Remove</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRemove(null)}>Cancel</button>
                      </>
                    : <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRemove(r.e.id)} style={{ color: "var(--ink-soft)" }}><Icon name="trash" size={14} /></button>}
                </StudentRow>
              ))}
            </div>
      )}
    </>
  );
}

function StudentRow({ r, sub, children }: { r: Row; sub: string; children: React.ReactNode }) {
  const name = resolveName({ full_name: r.e.full_name, email: r.e.email });
  return (
    <div className="card card-pad flex items-center gap-12" style={{ justifyContent: "space-between" }}>
      <div className="flex items-center gap-12" style={{ minWidth: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, flex: "none", display: "grid", placeItems: "center", background: "linear-gradient(140deg, var(--purple), #4b32a8)", color: "#fff", fontWeight: 600, fontSize: 14 }}>{(name[0] || "S").toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
          <div className="faint flex items-center gap-6 wrap" style={{ fontSize: 12, marginTop: 2 }}>
            <span className="chip-tag" style={{ background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>{r.className}</span>{sub}
          </div>
        </div>
      </div>
      <div className="flex gap-8 items-center" style={{ flex: "none" }}>{children}</div>
    </div>
  );
}
