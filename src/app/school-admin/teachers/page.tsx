"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/propel/Icon";
import { Modal, EmptyState, useToast } from "@/components/propel/primitives";
import { listTeachers, createTeacher, bulkTeachers, updateTeacher, type Teacher, type BulkRow } from "@/lib/schoolAdmin";
import { syllabusesForLevel } from "@/lib/syllabus";

export default function TeachersPage() {
  const toast = useToast();
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);

  const load = () => { setErr(null); listTeachers().then(setTeachers).catch((e) => setErr(e.message)); };
  useEffect(load, []);

  const toggleActive = async (t: Teacher) => {
    try { await updateTeacher(t.clerk_id, { active: !!t.deactivated_at }); toast(t.deactivated_at ? "Reactivated" : "Deactivated", "check_circle"); load(); }
    catch (e) { toast((e as Error).message, "alert"); }
  };

  return (
    <>
      <div className="row-between wrap gap-16" style={{ marginBottom: 24 }}>
        <div>
          <span className="eyebrow">School Admin</span>
          <h1 className="big-num" style={{ fontSize: 32, marginTop: 6 }}>Teachers</h1>
          <p className="muted" style={{ marginTop: 4 }}>Create staff logins and choose the levels &amp; subjects they teach.</p>
        </div>
        <div className="flex gap-10 wrap">
          <button className="btn btn-secondary" onClick={() => setBulkOpen(true)}><Icon name="upload" size={16} /> Import CSV</button>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}><Icon name="plus" size={16} /> Add teacher</button>
        </div>
      </div>

      {err && <div className="card card-pad" style={{ borderColor: "var(--coral)", color: "var(--coral)", marginBottom: 16 }}><Icon name="alert" size={16} /> {err}</div>}

      {teachers === null ? (
        <div className="grid" style={{ gap: 12 }}>{[0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 76, borderRadius: 16 }} />)}</div>
      ) : teachers.length === 0 ? (
        <div className="card"><EmptyState icon="users" title="No teachers yet" body="Add your first teacher to give them a login and assign subjects." cta="Add a teacher" onCta={() => setAddOpen(true)} /></div>
      ) : (
        <div className="grid stagger" style={{ gap: 12 }}>
          {teachers.map((t) => {
            const name = t.full_name || t.email?.split("@")[0] || "Teacher";
            const inactive = !!t.deactivated_at;
            return (
              <div key={t.clerk_id} className="card card-pad" style={{ opacity: inactive ? 0.62 : 1 }}>
                <div className="row-between wrap gap-16">
                  <div className="flex items-center gap-12" style={{ minWidth: 0 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, flex: "none", display: "grid", placeItems: "center", background: "linear-gradient(140deg, var(--teal), var(--teal-deep))", color: "#fff", fontWeight: 600 }}>
                      {(name[0] || "T").toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="flex items-center gap-8">
                        <span style={{ fontWeight: 600 }}>{name}</span>
                        {inactive ? <span className="badge coral">Deactivated</span> : t.must_change_password ? <span className="badge amber">Pending first sign-in</span> : <span className="badge teal">Active</span>}
                      </div>
                      <div className="muted" style={{ fontSize: 13 }}>{t.email}</div>
                      <div className="flex items-center gap-6 wrap mt-6">
                        {(t.syllabus_codes ?? []).slice(0, 6).map((c) => <span key={c} className="chip-tag" style={{ background: "var(--crimson-soft)", color: "var(--crimson)" }}>{c}</span>)}
                        {(t.levels ?? []).map((l) => <span key={l} className="chip-tag" style={{ background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>{l}</span>)}
                        {(!t.syllabus_codes?.length && !t.levels?.length) && <span className="faint" style={{ fontSize: 12.5 }}>No subjects assigned</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-8" style={{ flex: "none" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(t)}><Icon name="edit" size={15} /> Edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(t)} style={{ color: inactive ? "var(--teal)" : "var(--coral)" }}>
                      <Icon name={inactive ? "refresh" : "x"} size={15} /> {inactive ? "Reactivate" : "Deactivate"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addOpen && <AddTeacherModal onClose={() => setAddOpen(false)} onDone={() => { toast("Teacher added", "check_circle"); load(); }} />}
      {bulkOpen && <BulkModal onClose={() => setBulkOpen(false)} onDone={load} />}
      {editing && <EditTeacherModal teacher={editing} onClose={() => setEditing(null)} onDone={() => { toast("Saved", "check_circle"); load(); }} />}
    </>
  );
}

function TempPasswordBox({ email, password }: { email: string; password: string }) {
  return (
    <div className="card" style={{ background: "var(--surface-2)", padding: 14, marginTop: 12, textAlign: "left" }}>
      <div className="eyebrow">{email}</div>
      <div className="row-between mt-6">
        <code className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{password}</code>
        <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(password)}><Icon name="file_text" size={14} /> Copy</button>
      </div>
    </div>
  );
}

function AddTeacherModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [levels, setLevels] = useState<string[]>([]); const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ email: string; tempPassword: string | null; existed: boolean } | null>(null);
  const submit = async () => {
    if (!name.trim()) { setErr("Name is required."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await createTeacher({ name: name.trim(), subjects: codes, levels });
      setRes(r.teacher); onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose}>
      {res ? (
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 60, height: 60, margin: "0 auto 12px", borderRadius: 16, display: "grid", placeItems: "center", background: "var(--teal-soft)", color: "var(--teal-deep)" }}><Icon name="check_circle" size={30} /></div>
          <h3 className="card-title" style={{ fontSize: 19 }}>Teacher added</h3>
          {!res.existed && res.tempPassword
            ? <><p className="muted mt-6">Share this one-time password; they reset it on first sign-in.</p><TempPasswordBox email={res.email} password={res.tempPassword} /></>
            : <p className="muted mt-6">That email already had an account, now promoted to teacher.</p>}
          <button className="btn btn-primary btn-block mt-16" onClick={onClose}>Done</button>
        </div>
      ) : (
        <>
          <div className="row-between" style={{ marginBottom: 16 }}><h3 className="card-title" style={{ fontSize: 19 }}>Add teacher</h3><button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button></div>
          <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></Field>
          <p className="faint" style={{ fontSize: 12.5, marginBottom: 12 }}>A login is generated from the name with a one-time password.</p>
          <div style={{ marginBottom: 12 }}>
            <span className="eyebrow" style={{ marginBottom: 8, display: "block" }}>Levels &amp; subjects they teach</span>
            <SubjectLevelPicker levels={levels} codes={codes} onLevels={setLevels} onCodes={setCodes} />
          </div>
          {err && <p style={{ color: "var(--coral)", fontSize: 13 }}>{err}</p>}
          <div className="flex gap-10 mt-16"><button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>{busy ? "Adding…" : "Add teacher"}</button></div>
        </>
      )}
    </Modal>
  );
}

function EditTeacherModal({ teacher, onClose, onDone }: { teacher: Teacher; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(teacher.full_name || "");
  const [levels, setLevels] = useState<string[]>((teacher.levels ?? []).filter((l) => l === "O" || l === "A"));
  const [codes, setCodes] = useState<string[]>(teacher.syllabus_codes ?? []);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await updateTeacher(teacher.clerk_id, { full_name: name.trim() || undefined, subjects: codes, levels }); onDone(); onClose(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose}>
      <div className="row-between" style={{ marginBottom: 16 }}><h3 className="card-title" style={{ fontSize: 19 }}>Edit teacher</h3><button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button></div>
      <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div style={{ marginBottom: 12 }}>
        <span className="eyebrow" style={{ marginBottom: 8, display: "block" }}>Levels &amp; subjects</span>
        <SubjectLevelPicker levels={levels} codes={codes} onLevels={setLevels} onCodes={setCodes} />
      </div>
      {err && <p style={{ color: "var(--coral)", fontSize: 13 }}>{err}</p>}
      <div className="flex gap-10 mt-16"><button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
    </Modal>
  );
}

// Level → subjects picker (§4.1). Toggle O Level and/or A Level; each reveals its
// real syllabuses to tick. Reports the chosen levels + syllabus codes.
function SubjectLevelPicker({ levels, codes, onLevels, onCodes }: {
  levels: string[]; codes: string[]; onLevels: (l: string[]) => void; onCodes: (c: string[]) => void;
}) {
  const toggleLevel = (lv: "O" | "A") => {
    if (levels.includes(lv)) {
      onLevels(levels.filter((x) => x !== lv));
      const lvCodes = new Set(syllabusesForLevel(lv).map((s) => s.code));
      onCodes(codes.filter((c) => !lvCodes.has(c)));
    } else {
      onLevels([...levels, lv]);
    }
  };
  const toggleCode = (code: string) => onCodes(codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code]);
  return (
    <div className="grid" style={{ gap: 10 }}>
      {(["O", "A"] as const).map((lv) => {
        const on = levels.includes(lv);
        const chosen = syllabusesForLevel(lv).filter((s) => codes.includes(s.code)).length;
        return (
          <div key={lv} style={{ border: `1px solid ${on ? "var(--crimson)" : "var(--line)"}`, borderRadius: 12, padding: 12 }}>
            <button type="button" onClick={() => toggleLevel(lv)} className="row-between" style={{ width: "100%" }}>
              <span className="flex items-center gap-8">
                <span style={{ fontWeight: 600, fontSize: 14 }}>{lv === "O" ? "O Level / IGCSE" : "A Level"}</span>
                {on && chosen > 0 && <span className="chip-tag" style={{ background: "var(--crimson-soft)", color: "var(--crimson)" }}>{chosen}</span>}
              </span>
              <span style={{ display: "inline-block", width: 42, height: 24, borderRadius: 99, background: on ? "var(--crimson)" : "var(--line-strong)", position: "relative", transition: "background .2s", flex: "none" }}>
                <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "var(--shadow-sm)" }} />
              </span>
            </button>
            {on && (
              <div className="flex wrap gap-6" style={{ marginTop: 12 }}>
                {syllabusesForLevel(lv).map((s) => {
                  const sel = codes.includes(s.code);
                  return (
                    <button key={s.code} type="button" onClick={() => toggleCode(s.code)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, fontSize: 12.5, cursor: "pointer",
                        ...(sel ? { background: "var(--crimson)", color: "#fff", border: "1px solid var(--crimson)" } : { background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }) }}>
                      {sel && <Icon name="check_circle" size={13} />}
                      {s.subject} <span className="mono" style={{ opacity: 0.7, fontSize: 11 }}>{s.code}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BulkModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [csv, setCsv] = useState("email,name,subjects,levels\n");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<BulkRow[] | null>(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { const r = await bulkTeachers({ csv }); setResults(r.results); onDone(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose}>
      {results ? (
        <>
          <h3 className="card-title" style={{ fontSize: 19, marginBottom: 12 }}>Import results</h3>
          <div className="grid" style={{ gap: 8, maxHeight: 340, overflow: "auto" }}>
            {results.map((r, i) => (
              <div key={i} className="card" style={{ background: "var(--surface-2)", padding: 12 }}>
                <div className="row-between">
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.email}</span>
                  <span className={`badge ${r.ok ? "teal" : "coral"}`}>{r.ok ? (r.existed ? "Promoted" : "Created") : "Failed"}</span>
                </div>
                {r.ok && !r.existed && r.tempPassword && (
                  <div className="row-between mt-6"><code className="mono" style={{ fontSize: 13.5 }}>{r.tempPassword}</code>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(r.tempPassword || "")}><Icon name="file_text" size={13} /> Copy</button></div>
                )}
                {!r.ok && <div className="faint mt-6" style={{ fontSize: 12.5, color: "var(--coral)" }}>{r.error}</div>}
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-block mt-16" onClick={onClose}>Done</button>
        </>
      ) : (
        <>
          <div className="row-between" style={{ marginBottom: 8 }}><h3 className="card-title" style={{ fontSize: 19 }}>Import teachers (CSV)</h3><button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button></div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Columns: <code className="mono">email, name, subjects, levels</code>. Use <code className="mono">;</code> to separate multiple subjects or levels.</p>
          <textarea className="textarea mono" style={{ minHeight: 180, fontSize: 13 }} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"email,name,subjects,levels\njane@school.edu,Jane Doe,0620;0625,O\n"} />
          {err && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 8 }}>{err}</p>}
          <div className="flex gap-10 mt-16"><button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>{busy ? "Importing…" : "Import"}</button></div>
        </>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span className="eyebrow" style={{ marginBottom: 6, display: "block" }}>{label}</span>
      {children}
    </label>
  );
}
