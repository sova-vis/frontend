"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/propel/Icon";
import { CountUp, Modal, EmptyState, Segmented, useToast } from "@/components/propel/primitives";
import { listClasses, createClass, updateClass, type TeacherClass } from "@/lib/teacherClasses";
import { teacherSubjectsForLevel, standardCodeForSubject, type SyllabusLevel } from "@/lib/syllabus";
import { subjectSlug } from "@/lib/studentSubjects";
import { useClerkAuth } from "@/lib/useClerkAuth";

export default function TeacherClassesPage() {
  const toast = useToast();
  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = () => { setErr(null); listClasses(false).then(setClasses).catch((e) => setErr(e.message)); };
  useEffect(load, []);

  const totals = useMemo(() => {
    const c = classes ?? [];
    return {
      classes: c.length,
      students: c.reduce((a, x) => a + (x.student_count ?? 0), 0),
      pending: c.reduce((a, x) => a + (x.pending_count ?? 0), 0),
    };
  }, [classes]);

  return (
    <>
      <div className="row-between wrap gap-16" style={{ marginBottom: 26 }}>
        <div>
          <span className="eyebrow">Teacher</span>
          <h1 className="big-num" style={{ fontSize: 34, marginTop: 6 }}>Classes</h1>
          <p className="muted" style={{ marginTop: 4 }}>Create a class, share its join code, and approve who gets in.</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => setCreateOpen(true)}><Icon name="plus" size={18} /> New class</button>
      </div>

      <div className="grid stagger" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 26 }}>
        <Stat icon="users" tone="var(--crimson)" label="Classes" value={totals.classes} />
        <Stat icon="graduation" tone="var(--teal)" label="Students" value={totals.students} />
        <Stat icon="bell" tone="var(--amber)" label="Pending requests" value={totals.pending} />
      </div>

      {err && <div className="card card-pad" style={{ borderColor: "var(--coral)", color: "var(--coral)", marginBottom: 16 }}><Icon name="alert" size={16} /> {err}</div>}

      {classes === null ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>{[0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 180, borderRadius: 18 }} />)}</div>
      ) : classes.length === 0 ? (
        <div className="card"><EmptyState icon="users" title="No classes yet" body="Create your first class to get a join code students can use to request access." cta="Create a class" onCta={() => setCreateOpen(true)} /></div>
      ) : (
        <div className="grid stagger" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {classes.map((c) => <ClassCard key={c.id} c={c} />)}
        </div>
      )}

      {createOpen && <CreateClassModal onClose={() => setCreateOpen(false)} onCreated={() => { toast("Class created", "check_circle"); load(); }} />}
    </>
  );
}

function Stat({ icon, tone, label, value }: { icon: string; tone: string; label: string; value: number }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-12">
        <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone, flex: "none" }}><Icon name={icon} size={20} /></div>
        <div><div className="stat-num"><CountUp value={value} /></div><div className="eyebrow" style={{ marginTop: 3 }}>{label}</div></div>
      </div>
    </div>
  );
}

function ClassCard({ c }: { c: TeacherClass }) {
  return (
    <Link href={`/teacher/classes/${c.id}`} className="card card-pad card-hover" style={{ display: "block" }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, flex: "none", display: "grid", placeItems: "center", background: "linear-gradient(140deg, var(--crimson), var(--crimson-deep))", color: "#fff", fontFamily: "var(--font-fraunces), serif", fontWeight: 600, fontSize: 18 }}>
          {(c.name[0] || "C").toUpperCase()}
        </div>
        {(c.pending_count ?? 0) > 0 && <span className="badge amber"><Icon name="bell" size={12} /> {c.pending_count} pending</span>}
      </div>
      <div className="card-title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
      <div className="flex items-center gap-6 wrap mt-8">
        <span className="chip-tag" style={{ background: "var(--crimson-soft)", color: "var(--crimson)" }}>{c.subject}</span>
        {c.syllabus_code && <span className="chip-tag mono" style={{ background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>{c.syllabus_code}</span>}
        <span className="chip-tag" style={{ background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>{c.level === "A" ? "A Level" : "O Level"}</span>
      </div>
      <div className="hr" style={{ margin: "14px 0" }} />
      <div className="row-between">
        <span className="muted flex items-center gap-6" style={{ fontSize: 13 }}><Icon name="graduation" size={15} /> {c.student_count ?? 0} student{(c.student_count ?? 0) === 1 ? "" : "s"}</span>
        {c.join_code && <span className="mono" style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: c.join_enabled ? "var(--ink)" : "var(--ink-faint)" }}>{c.join_code}</span>}
      </div>
    </Link>
  );
}

function CreateClassModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  // Limit the picker to the scope a school-admin assigned this teacher (§4.1):
  // only their levels, and only the subjects of their assigned syllabus codes.
  // A teacher with no assigned scope keeps free entry (independent teachers).
  const { profile } = useClerkAuth();
  const teacherCodes = useMemo(() => profile?.syllabus_codes ?? [], [profile]);
  const scoped = teacherCodes.length > 0;
  const levels = useMemo<SyllabusLevel[]>(() => {
    const ls = (profile?.levels ?? []).filter((l): l is SyllabusLevel => l === "O" || l === "A");
    return ls.length ? ls : ["O", "A"];
  }, [profile]);

  const [f, setF] = useState({ name: "", subject: "", syllabus_code: "", year_group: "" });
  const [level, setLevel] = useState<SyllabusLevel>("O");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  // Keep the chosen level within the allowed set (and clear the subject when it moves).
  useEffect(() => { if (!levels.includes(level)) { setLevel(levels[0]); setF((s) => ({ ...s, subject: "", syllabus_code: "" })); } }, [levels, level]);

  // The teacher's assigned subjects for this level (reads new name tokens AND
  // legacy numeric codes). A standard Cambridge code is attached when one exists,
  // otherwise a slug — so library-only subjects (no code) still get a class code.
  const options = useMemo<string[]>(() => (scoped ? teacherSubjectsForLevel(teacherCodes, level) : []), [scoped, level, teacherCodes]);
  const codeFor = (name: string) => standardCodeForSubject(name, level) || subjectSlug(name);
  // Auto-pick when they have exactly one assigned subject at this level.
  useEffect(() => {
    if (scoped && options.length === 1 && !f.subject) setF((s) => ({ ...s, subject: options[0], syllabus_code: codeFor(options[0]) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, options, f.subject, level]);
  const chooseSubject = (name: string) => {
    setF((prev) => ({ ...prev, subject: name, syllabus_code: name ? codeFor(name) : "" }));
  };

  const submit = async () => {
    if (!f.name.trim() || !f.subject.trim()) { setErr("Class name and subject are required."); return; }
    setBusy(true); setErr(null);
    try {
      const c = await createClass({ name: f.name.trim(), subject: f.subject.trim(), syllabus_code: f.syllabus_code.trim(), level, year_group: f.year_group.trim() || undefined });
      // Spec §5.1: never auto-accept — enforce manual approval regardless of any default.
      if (c.auto_approve_joins) { try { await updateClass(c.id, { auto_approve_joins: false }); } catch { /* non-fatal */ } }
      onCreated(); onClose();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <div className="row-between" style={{ marginBottom: 16 }}><h3 className="card-title" style={{ fontSize: 20 }}>New class</h3><button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button></div>
      <label style={{ display: "block", marginBottom: 12 }}><span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Class name</span><input className="input" value={f.name} onChange={set("name")} placeholder="e.g. 11B Biology" /></label>
      <div style={{ marginBottom: 12 }}>
        <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Level</span>
        <Segmented options={levels.map((l) => ({ value: l, label: `${l} Level` }))} value={level}
          onChange={(l) => { setLevel(l); setF((s) => ({ ...s, subject: "", syllabus_code: "" })); }} />
      </div>
      {scoped ? (
        <label style={{ display: "block", marginBottom: 12 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Subject</span>
          <select className="input" value={f.subject} onChange={(e) => chooseSubject(e.target.value)} disabled={options.length === 0}>
            <option value="">{options.length ? "Select a subject" : "No subjects assigned at this level"}</option>
            {options.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          {options.length === 0 && <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>Ask your school admin to assign you a subject at this level.</p>}
        </label>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "block", marginBottom: 12 }}><span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Subject</span><input className="input" value={f.subject} onChange={set("subject")} placeholder="Biology" /></label>
          <label style={{ display: "block", marginBottom: 12 }}><span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Syllabus code</span><input className="input mono" value={f.syllabus_code} onChange={set("syllabus_code")} placeholder="0610" /></label>
        </div>
      )}
      <label style={{ display: "block", marginBottom: 12 }}><span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Year group <span className="faint">(optional)</span></span><input className="input" value={f.year_group} onChange={set("year_group")} placeholder="Year 11" /></label>
      {err && <p style={{ color: "var(--coral)", fontSize: 13 }}>{err}</p>}
      <div className="flex gap-10 mt-16"><button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create class"}</button></div>
    </Modal>
  );
}
