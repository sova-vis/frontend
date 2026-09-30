"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/propel/Icon";
import { CountUp, Bar, Modal, EmptyState, useToast } from "@/components/propel/primitives";
import { listSchools, createSchool, listUsersBilling, type SchoolWithUsage, type QuotaStatus, type BillingUser } from "@/lib/owner";

function quotaTone(state?: QuotaStatus["state"]) {
  return state === "full" ? "coral" : state === "warn" ? "amber" : "teal";
}
function statusTone(status: string) {
  return status === "active" ? "teal" : status === "suspended" ? "coral" : "amber";
}
function pctOf(used: number, max: number | null | undefined) {
  if (!max || max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

export default function OwnerSchoolsPage() {
  const toast = useToast();
  const [schools, setSchools] = useState<SchoolWithUsage[] | null>(null);
  const [users, setUsers] = useState<BillingUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = () => {
    setError(null);
    listSchools().then(setSchools).catch((e) => setError(e.message));
    listUsersBilling().then(setUsers).catch(() => setUsers([]));
  };
  useEffect(load, []);

  const platform = useMemo(() => {
    const u = users ?? [];
    const kind = (x: BillingUser) => (x.billing_status === "trialing" ? "trial" : x.is_pro ? "pro" : "free");
    const s = schools ?? [];
    return {
      schools: s.length,
      users: u.length,
      students: u.filter((x) => x.role === "student").length,
      teachers: u.filter((x) => x.role === "teacher").length,
      schoolAdmins: u.filter((x) => x.role === "school_admin").length,
      pro: u.filter((x) => kind(x) === "pro").length,
      trial: u.filter((x) => kind(x) === "trial").length,
      marking: s.reduce((a, x) => a + (x.usage?.marking?.used ?? 0), 0),
    };
  }, [users, schools]);

  return (
    <>
      {/* Header */}
      <div className="row-between wrap gap-16" style={{ marginBottom: 26 }}>
        <div>
          <span className="eyebrow">Platform Owner</span>
          <h1 className="big-num" style={{ fontSize: 34, marginTop: 6 }}>Schools</h1>
          <p className="muted" style={{ marginTop: 4 }}>Create and govern schools, set their limits, and watch usage against cost.</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={18} /> New school
        </button>
      </div>

      {/* KPI row */}
      <div className="grid stagger" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(172px, 1fr))", marginBottom: 26 }}>
        <StatCard icon="briefcase" tone="var(--crimson)" label="Schools" value={platform.schools} />
        <StatCard icon="users" tone="var(--ink)" label="Total users" value={platform.users} />
        <StatCard icon="graduation" tone="var(--amber)" label="Students" value={platform.students} />
        <StatCard icon="pencil" tone="var(--teal)" label="Teachers" value={platform.teachers} />
        <StatCard icon="shield" tone="var(--purple)" label="School admins" value={platform.schoolAdmins} />
        <StatCard icon="check_circle" tone="var(--teal)" label="Pro" value={platform.pro} />
        <StatCard icon="clock" tone="var(--amber)" label="On trial" value={platform.trial} />
        <StatCard icon="chart" tone="var(--purple)" label="Parts marked" value={platform.marking} />
      </div>

      {error && (
        <div className="card card-pad" style={{ borderColor: "var(--coral)", marginBottom: 20 }}>
          <div className="flex items-center gap-10" style={{ color: "var(--coral)" }}>
            <Icon name="alert" size={18} /> <span className="muted" style={{ color: "var(--coral)" }}>{error}</span>
          </div>
        </div>
      )}

      {/* Schools grid */}
      {schools === null ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {[0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 210, borderRadius: 18 }} />)}
        </div>
      ) : schools.length === 0 ? (
        <div className="card"><EmptyState icon="briefcase" title="No schools yet" body="Create your first school to issue its admin login and set its limits." cta="Create a school" onCta={() => setCreateOpen(true)} /></div>
      ) : (
        <div className="grid stagger" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {schools.map((s) => <SchoolCard key={s.id} s={s} />)}
        </div>
      )}

      {createOpen && (
        <CreateSchoolModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => { toast("School created", "check_circle"); load(); }}
        />
      )}
    </>
  );
}

function StatCard({ icon, tone, label, value }: { icon: string; tone: string; label: string; value: number }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-12">
        <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone, flex: "none" }}>
          <Icon name={icon} size={20} />
        </div>
        <div>
          <div className="stat-num"><CountUp value={value} /></div>
          <div className="eyebrow" style={{ marginTop: 3 }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function SchoolCard({ s }: { s: SchoolWithUsage }) {
  const tPct = pctOf(s.usage?.teachers ?? 0, s.limits?.max_teachers);
  const sPct = pctOf(s.usage?.students ?? 0, s.limits?.max_students_total);
  const m = s.usage?.marking;
  return (
    <Link href={`/owner/schools/${s.id}`} className="card card-pad card-hover" style={{ display: "block" }}>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <div className="flex items-center gap-12" style={{ minWidth: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, flex: "none", display: "grid", placeItems: "center", background: "linear-gradient(140deg, var(--crimson), var(--crimson-deep))", color: "#fff", fontFamily: "var(--font-fraunces), serif", fontWeight: 600, fontSize: 19 }}>
            {(s.name[0] || "S").toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="card-title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
            <div className="eyebrow" style={{ marginTop: 2 }}>{s.licence_expiry ? `Licence ends ${new Date(s.licence_expiry).toLocaleDateString()}` : "No licence end set"}</div>
          </div>
        </div>
        <span className={`badge ${statusTone(s.status)}`} style={{ textTransform: "capitalize", flex: "none" }}>{s.status}</span>
      </div>

      <UsageRow label="Teachers" used={s.usage?.teachers ?? 0} max={s.limits?.max_teachers ?? null} pct={tPct} tone={tPct >= 100 ? "coral" : tPct >= 80 ? "amber" : "teal"} />
      <UsageRow label="Students" used={s.usage?.students ?? 0} max={s.limits?.max_students_total ?? null} pct={sPct} tone={sPct >= 100 ? "coral" : sPct >= 80 ? "amber" : "teal"} />

      <div style={{ marginTop: 14 }}>
        <div className="row-between" style={{ marginBottom: 6 }}>
          <span className="eyebrow">Marking · this {s.limits?.quota_period ?? "month"}</span>
          {m ? <span className={`badge ${quotaTone(m.state)}`}>{m.pct}%</span> : <span className="badge neutral">n/a</span>}
        </div>
        <Bar value={m?.pct ?? 0} tone={quotaTone(m?.state)} />
        <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
          {m ? `${m.used.toLocaleString()} / ${m.quota.toLocaleString()} parts` : "No limits configured"}
          {s.discount_pct > 0 && <span> · {s.discount_pct}% student discount</span>}
        </div>
      </div>
    </Link>
  );
}

function UsageRow({ label, used, max, pct, tone }: { label: string; used: number; max: number | null; pct: number; tone: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="row-between" style={{ marginBottom: 5 }}>
        <span className="muted" style={{ fontSize: 13 }}>{label}</span>
        <span className="mono" style={{ fontSize: 12.5 }}>{used}{max != null ? ` / ${max}` : ""}</span>
      </div>
      <Bar value={pct} tone={tone} height={6} />
    </div>
  );
}

/* ---- Create school modal ---- */
function CreateSchoolModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ name: "", adminName: "", adminEmail: "", discount: "", maxTeachers: "", maxStudents: "", quota: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; tempPassword: string | null; existed: boolean } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async () => {
    if (!f.name.trim() || !f.adminName.trim() || !f.adminEmail.trim()) { setErr("School name, admin name and admin email are required."); return; }
    setBusy(true); setErr(null);
    try {
      const limits: Record<string, number> = {};
      if (f.maxTeachers) limits.max_teachers = parseInt(f.maxTeachers, 10);
      if (f.maxStudents) limits.max_students_total = parseInt(f.maxStudents, 10);
      if (f.quota) limits.marking_quota_units = parseInt(f.quota, 10);
      const res = await createSchool({
        name: f.name.trim(),
        discount_pct: f.discount ? Number(f.discount) : undefined,
        limits: Object.keys(limits).length ? limits : undefined,
        admin: { email: f.adminEmail.trim(), name: f.adminName.trim() },
      });
      setResult(res.admin);
      onCreated();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      {result ? (
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, margin: "0 auto 14px", borderRadius: 18, display: "grid", placeItems: "center", background: "var(--teal-soft)", color: "var(--teal-deep)" }}>
            <Icon name="check_circle" size={32} />
          </div>
          <h3 className="card-title" style={{ fontSize: 20 }}>School created</h3>
          <p className="muted" style={{ marginTop: 6 }}>
            {result.existed
              ? "That email already had an account, so it is now the school admin. They keep their existing password."
              : "Share this one-time password with the school admin. They'll be asked to reset it on first sign-in."}
          </p>
          {!result.existed && result.tempPassword && (
            <div className="card" style={{ background: "var(--surface-2)", padding: 16, marginTop: 16, textAlign: "left" }}>
              <div className="eyebrow">Admin email</div>
              <div className="mono" style={{ marginBottom: 10 }}>{result.email}</div>
              <div className="eyebrow">Temporary password</div>
              <div className="flex items-center gap-10" style={{ justifyContent: "space-between" }}>
                <code className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{result.tempPassword}</code>
                <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard?.writeText(result.tempPassword || ""); }}>
                  <Icon name="file_text" size={14} /> Copy
                </button>
              </div>
            </div>
          )}
          <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 18 }} onClick={onClose}>Done</button>
        </div>
      ) : (
        <>
          <div className="row-between" style={{ marginBottom: 16 }}>
            <h3 className="card-title" style={{ fontSize: 20 }}>New school</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
          </div>

          <Field label="School name"><input className="input" value={f.name} onChange={set("name")} placeholder="Cambridge International School" /></Field>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="First admin name"><input className="input" value={f.adminName} onChange={set("adminName")} placeholder="Full name" /></Field>
            <Field label="First admin email"><input className="input" value={f.adminEmail} onChange={set("adminEmail")} placeholder="admin@school.edu" type="email" /></Field>
          </div>

          <div className="hr" style={{ margin: "14px 0" }} />
          <div className="eyebrow" style={{ marginBottom: 10 }}>Limits and pricing (optional; sensible defaults apply)</div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Max teachers"><input className="input" value={f.maxTeachers} onChange={set("maxTeachers")} placeholder="10" inputMode="numeric" /></Field>
            <Field label="Max students"><input className="input" value={f.maxStudents} onChange={set("maxStudents")} placeholder="300" inputMode="numeric" /></Field>
            <Field label="Marking quota (parts/mo)"><input className="input" value={f.quota} onChange={set("quota")} placeholder="5000" inputMode="numeric" /></Field>
            <Field label="Student discount %"><input className="input" value={f.discount} onChange={set("discount")} placeholder="40" inputMode="numeric" /></Field>
          </div>

          {err && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 12 }}>{err}</p>}

          <div className="flex gap-10" style={{ marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
              {busy ? "Creating…" : "Create school & admin"}
            </button>
          </div>
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
