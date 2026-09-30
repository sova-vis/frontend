"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/propel/Icon";
import { Segmented, EmptyState, useToast } from "@/components/propel/primitives";
import {
  getClass, listEnrollments, decideEnrollments, regenerateJoinCode, setJoinEnabled,
  removeStudent, archiveClass, joinLink, type TeacherClass, type Enrollment,
} from "@/lib/teacherClasses";
import { resolveName } from "@/lib/displayName";

export default function ClassDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const toast = useToast();
  const [cls, setCls] = useState<TeacherClass | null>(null);
  const [enr, setEnr] = useState<Enrollment[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"requests" | "roster">("requests");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const loadClass = () => getClass(id).then(setCls).catch((e) => setErr(e.message));
  const loadEnr = () => listEnrollments(id).then(setEnr).catch((e) => setErr(e.message));
  useEffect(() => { if (id) { loadClass(); loadEnr(); } /* eslint-disable-next-line */ }, [id]);

  const pending = useMemo(() => (enr ?? []).filter((e) => e.status === "pending"), [enr]);
  const active = useMemo(() => (enr ?? []).filter((e) => e.status === "active"), [enr]);

  const decide = async (ids: string[], decision: "approve" | "reject") => {
    if (!ids.length) return;
    try { await decideEnrollments(id, ids, decision); toast(decision === "approve" ? "Approved" : "Rejected", "check_circle"); loadEnr(); loadClass(); }
    catch (e) { toast((e as Error).message, "alert"); }
  };
  const remove = async (studentClerkId: string) => {
    try { await removeStudent(id, studentClerkId); toast("Removed", "check_circle"); setConfirmRemove(null); loadEnr(); loadClass(); }
    catch (e) { toast((e as Error).message, "alert"); }
  };
  const regen = async () => { try { setCls(await regenerateJoinCode(id)); toast("New code generated", "refresh"); } catch (e) { toast((e as Error).message, "alert"); } };
  const toggleJoin = async () => { if (!cls) return; try { setCls(await setJoinEnabled(id, !cls.join_enabled)); } catch (e) { toast((e as Error).message, "alert"); } };
  const archive = async () => { try { await archiveClass(id, true); toast("Class archived", "check_circle"); window.location.href = "/teacher/classes"; } catch (e) { toast((e as Error).message, "alert"); } };

  if (err && !cls) return <p style={{ color: "var(--coral)" }}>{err}</p>;
  if (!cls) return <div className="sk" style={{ height: 320, borderRadius: 18 }} />;

  return (
    <>
      <Link href="/teacher/classes" className="chip" style={{ marginBottom: 18 }}><Icon name="chevron_left" size={15} /> All classes</Link>

      <div className="row-between wrap gap-16" style={{ marginBottom: 24 }}>
        <div className="flex items-center gap-16" style={{ minWidth: 0 }}>
          <div style={{ width: 56, height: 56, borderRadius: 15, flex: "none", display: "grid", placeItems: "center", background: "linear-gradient(140deg, var(--crimson), var(--crimson-deep))", color: "#fff", fontFamily: "var(--font-fraunces), serif", fontWeight: 600, fontSize: 24 }}>{(cls.name[0] || "C").toUpperCase()}</div>
          <div style={{ minWidth: 0 }}>
            <h1 className="big-num" style={{ fontSize: 28 }}>{cls.name}</h1>
            <div className="flex items-center gap-6 wrap mt-6">
              <span className="chip-tag" style={{ background: "var(--crimson-soft)", color: "var(--crimson)" }}>{cls.subject}</span>
              {cls.syllabus_code && <span className="chip-tag mono" style={{ background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>{cls.syllabus_code}</span>}
              <span className="chip-tag" style={{ background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>{cls.level === "A" ? "A Level" : "O Level"}</span>
              {cls.year_group && <span className="chip-tag" style={{ background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>{cls.year_group}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-8 wrap" style={{ flex: "none" }}>
          <Link href={`/teacher/assignments/new?class_id=${cls.id}`} className="btn btn-primary"><Icon name="plus" size={16} /> New assignment</Link>
          <button className="btn btn-ghost" onClick={archive} style={{ color: "var(--ink-soft)" }}><Icon name="layers" size={16} /> Archive</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.6fr)", alignItems: "start" }}>
        {/* Join code */}
        <div className="card card-pad">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <span className="eyebrow">Join code</span>
            <button type="button" onClick={toggleJoin} title={cls.join_enabled ? "Joining is on" : "Joining is off"}>
              <span style={{ display: "inline-block", width: 44, height: 26, borderRadius: 99, background: cls.join_enabled ? "var(--teal)" : "var(--line-strong)", position: "relative", transition: "background .2s" }}>
                <span style={{ position: "absolute", top: 3, left: cls.join_enabled ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "var(--shadow-sm)" }} />
              </span>
            </button>
          </div>
          <div className="big-num" style={{ fontSize: 34, letterSpacing: "0.14em", color: cls.join_enabled ? "var(--ink)" : "var(--ink-faint)" }}>{cls.join_code || "not set"}</div>
          <p className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>{cls.join_enabled ? "Students enter this code, then wait for your approval." : "Joining is off; no new requests can be made."}</p>
          <div className="flex gap-8 wrap mt-16">
            <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard?.writeText(cls.join_code || ""); toast("Code copied", "check_circle"); }}><Icon name="file_text" size={14} /> Copy code</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard?.writeText(joinLink(cls.join_code || "")); toast("Invite link copied", "check_circle"); }}><Icon name="send" size={14} /> Copy link</button>
          </div>
          <div className="hr" style={{ margin: "14px 0" }} />
          <button className="btn btn-ghost btn-sm" onClick={regen} style={{ color: "var(--ink-soft)" }}><Icon name="refresh" size={14} /> Regenerate (invalidates old)</button>
        </div>

        {/* Requests + roster */}
        <div className="card card-pad">
          <div className="row-between wrap gap-12" style={{ marginBottom: 16 }}>
            <Segmented
              options={[{ value: "requests", label: `Requests${pending.length ? ` (${pending.length})` : ""}` }, { value: "roster", label: `Roster (${active.length})` }]}
              value={tab} onChange={setTab}
            />
            {tab === "requests" && pending.length > 0 && (
              <div className="flex gap-8">
                <button className="btn btn-soft btn-sm" onClick={() => decide(pending.map((p) => p.student_clerk_id), "approve")}><Icon name="check_circle" size={14} /> Approve all</button>
                <button className="btn btn-ghost btn-sm" onClick={() => decide(pending.map((p) => p.student_clerk_id), "reject")} style={{ color: "var(--coral)" }}>Reject all</button>
              </div>
            )}
          </div>

          {enr === null ? (
            <div className="grid" style={{ gap: 10 }}>{[0, 1].map((i) => <div key={i} className="sk" style={{ height: 60, borderRadius: 14 }} />)}</div>
          ) : tab === "requests" ? (
            pending.length === 0
              ? <EmptyState icon="check_circle" title="No pending requests" body="When a student enters your join code, they'll appear here for approval." />
              : <div className="grid" style={{ gap: 10 }}>{pending.map((e) => (
                  <Row key={e.id} e={e} sub={`Requested ${new Date(e.requested_at).toLocaleDateString()}`}>
                    <button className="btn btn-soft btn-sm" onClick={() => decide([e.student_clerk_id], "approve")}><Icon name="check_circle" size={14} /> Approve</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => decide([e.student_clerk_id], "reject")} style={{ color: "var(--coral)" }}><Icon name="x" size={14} /></button>
                  </Row>
                ))}</div>
          ) : (
            active.length === 0
              ? <EmptyState icon="users" title="No students yet" body="Approved students show up here as your class roster." />
              : <div className="grid" style={{ gap: 10 }}>{active.map((e) => (
                  <Row key={e.id} e={e} sub={e.approved_at ? `Joined ${new Date(e.approved_at).toLocaleDateString()}` : "Active"}>
                    {confirmRemove === e.student_clerk_id
                      ? <>
                          <button className="btn btn-sm" onClick={() => remove(e.student_clerk_id)} style={{ background: "var(--coral)", color: "#fff" }}>Confirm</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRemove(null)}>Cancel</button>
                        </>
                      : <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRemove(e.student_clerk_id)} style={{ color: "var(--ink-soft)" }}><Icon name="trash" size={14} /></button>}
                  </Row>
                ))}</div>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ e, sub, children }: { e: Enrollment; sub: string; children: React.ReactNode }) {
  const name = resolveName({ full_name: e.full_name, email: e.email });
  return (
    <div className="flex items-center gap-12" style={{ justifyContent: "space-between", padding: "10px 12px", borderRadius: 14, background: "var(--surface-2)" }}>
      <div className="flex items-center gap-12" style={{ minWidth: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, flex: "none", display: "grid", placeItems: "center", background: "linear-gradient(140deg, var(--purple), #4b32a8)", color: "#fff", fontWeight: 600, fontSize: 14 }}>{(name[0] || "S").toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
          <div className="faint" style={{ fontSize: 12 }}>{sub}</div>
        </div>
      </div>
      <div className="flex gap-8" style={{ flex: "none" }}>{children}</div>
    </div>
  );
}
