"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/propel/Icon";
import { Ring, Bar, Modal, useToast } from "@/components/propel/primitives";
import { getSchool, setLimits, updateSchool, addSchoolAdmin, type SchoolWithUsage } from "@/lib/owner";

type LimForm = {
  max_teachers: string; max_students_per_teacher: string; max_classes_per_teacher: string;
  max_students_total: string; marking_quota_units: string; askai_allowance: string;
  storage_cap_mb: string; quota_period: "month" | "term"; subject_entitlements: string;
  discount_pct: string; licence_start: string; licence_expiry: string; allow_admin_script_view: boolean;
};

function fromSchool(s: SchoolWithUsage): LimForm {
  const l = s.limits;
  return {
    max_teachers: String(l?.max_teachers ?? ""),
    max_students_per_teacher: String(l?.max_students_per_teacher ?? ""),
    max_classes_per_teacher: String(l?.max_classes_per_teacher ?? ""),
    max_students_total: String(l?.max_students_total ?? ""),
    marking_quota_units: String(l?.marking_quota_units ?? ""),
    askai_allowance: String(l?.askai_allowance ?? ""),
    storage_cap_mb: String(l?.storage_cap_mb ?? ""),
    quota_period: (l?.quota_period ?? "month"),
    subject_entitlements: (l?.subject_entitlements ?? []).join(", "),
    discount_pct: String(s.discount_pct ?? 0),
    licence_start: s.licence_start ? s.licence_start.slice(0, 10) : "",
    licence_expiry: s.licence_expiry ? s.licence_expiry.slice(0, 10) : "",
    allow_admin_script_view: !!s.allow_admin_script_view,
  };
}

export default function SchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const toast = useToast();
  const [s, setS] = useState<SchoolWithUsage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<LimForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = () => getSchool(id).then((d) => { setS(d); setForm(fromSchool(d)); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const num = (v: string) => (v === "" ? undefined : parseInt(v, 10));

  const save = async () => {
    if (!form) return;
    setSaving(true); setErr(null);
    try {
      await Promise.all([
        setLimits(id, {
          max_teachers: num(form.max_teachers), max_students_per_teacher: num(form.max_students_per_teacher),
          max_classes_per_teacher: num(form.max_classes_per_teacher), max_students_total: num(form.max_students_total),
          marking_quota_units: num(form.marking_quota_units), askai_allowance: num(form.askai_allowance),
          storage_cap_mb: num(form.storage_cap_mb), quota_period: form.quota_period,
          subject_entitlements: form.subject_entitlements.split(",").map((x) => x.trim()).filter(Boolean),
        }),
        updateSchool(id, {
          discount_pct: form.discount_pct === "" ? 0 : Number(form.discount_pct),
          allow_admin_script_view: form.allow_admin_script_view,
          licence_start: form.licence_start || null,
          licence_expiry: form.licence_expiry || null,
        }),
      ]);
      toast("Saved", "check_circle");
      load();
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  const setStatus = async (status: "active" | "suspended") => {
    try { await updateSchool(id, { status }); toast(status === "active" ? "Reactivated" : "Suspended", "check_circle"); load(); }
    catch (e) { toast((e as Error).message, "alert"); }
  };

  if (!s || !form) {
    return err ? <p style={{ color: "var(--coral)" }}>{err}</p> : <div className="sk" style={{ height: 300, borderRadius: 18 }} />;
  }

  const m = s.usage?.marking;
  const set = (k: keyof LimForm) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => p && ({ ...p, [k]: e.target.value }));

  return (
    <>
      <Link href="/owner" className="chip" style={{ marginBottom: 18 }}><Icon name="chevron_left" size={15} /> All schools</Link>

      {/* Header */}
      <div className="row-between wrap gap-16" style={{ marginBottom: 24 }}>
        <div className="flex items-center gap-16" style={{ minWidth: 0 }}>
          <div style={{ width: 56, height: 56, borderRadius: 15, flex: "none", display: "grid", placeItems: "center", background: "linear-gradient(140deg, var(--crimson), var(--crimson-deep))", color: "#fff", fontFamily: "var(--font-fraunces), serif", fontWeight: 600, fontSize: 24 }}>
            {(s.name[0] || "S").toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 className="big-num" style={{ fontSize: 28 }}>{s.name}</h1>
            <div className="flex items-center gap-10 mt-6">
              <span className={`badge ${s.status === "active" ? "teal" : s.status === "suspended" ? "coral" : "amber"}`} style={{ textTransform: "capitalize" }}>{s.status}</span>
              {s.discount_pct > 0 && <span className="badge purple">{s.discount_pct}% student discount</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-10">
          {s.status === "active"
            ? <button className="btn btn-secondary" onClick={() => setStatus("suspended")}><Icon name="pause" size={16} /> Suspend</button>
            : <button className="btn btn-secondary" onClick={() => setStatus("active")}><Icon name="play" size={16} /> Reactivate</button>}
        </div>
      </div>

      {/* Usage */}
      <div className="grid stagger" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", marginBottom: 22 }}>
        <UsageStat icon="users" label="Teachers" used={s.usage?.teachers ?? 0} max={s.limits?.max_teachers ?? null} tone="var(--teal)" />
        <UsageStat icon="graduation" label="Students" used={s.usage?.students ?? 0} max={s.limits?.max_students_total ?? null} tone="var(--amber)" />
        <div className="card card-pad flex items-center gap-16">
          <Ring value={m?.pct ?? 0} size={92} stroke={10}
            color={m?.state === "full" ? "var(--coral)" : m?.state === "warn" ? "var(--amber)" : "var(--teal)"}
            track="var(--canvas-2)" textColor="var(--ink)" />
          <div>
            <div className="eyebrow">Marking · {s.limits?.quota_period ?? "month"}</div>
            <div className="mono mt-6" style={{ fontSize: 13 }}>{m ? `${m.used.toLocaleString()} / ${m.quota.toLocaleString()}` : "n/a"}</div>
            <div className="faint" style={{ fontSize: 12 }}>parts marked</div>
          </div>
        </div>
        <UsageStat icon="message" label="Ask AI · allowance" used={s.usage?.askai?.used ?? 0} max={s.usage?.askai?.allowance ?? null} tone="var(--purple)" />
      </div>

      {/* Upsell funnel (§6.2) */}
      <div className="card card-pad" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <div className="card-title">Upsell funnel</div>
          <span className="faint" style={{ fontSize: 12.5 }}>Classroom students → personal Pro{s.discount_pct > 0 ? ` · ${s.discount_pct}% off` : ""}</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
          <FunnelStat label="Prompts shown" value={s.funnel?.prompts_shown ?? 0} />
          <FunnelStat label="Students prompted" value={s.funnel?.students_prompted ?? 0} />
          <FunnelStat label="Converted" value={s.funnel?.conversions ?? 0} tone="var(--teal)" />
          <FunnelStat label="Conversion" value={`${s.funnel?.rate ?? 0}%`} tone="var(--crimson)" />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", alignItems: "start" }}>
        {/* Limits editor */}
        <div className="card card-pad">
          <div className="card-head"><div className="card-title">Limits & entitlements</div></div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <NumField label="Max teachers" value={form.max_teachers} onChange={set("max_teachers")} />
            <NumField label="Max students (total)" value={form.max_students_total} onChange={set("max_students_total")} />
            <NumField label="Max students / teacher" value={form.max_students_per_teacher} onChange={set("max_students_per_teacher")} />
            <NumField label="Max classes / teacher" value={form.max_classes_per_teacher} onChange={set("max_classes_per_teacher")} />
            <NumField label="Marking quota (parts)" value={form.marking_quota_units} onChange={set("marking_quota_units")} />
            <NumField label="Ask AI allowance" value={form.askai_allowance} onChange={set("askai_allowance")} />
            <NumField label="Storage cap (MB)" value={form.storage_cap_mb} onChange={set("storage_cap_mb")} />
            <div>
              <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Quota period</span>
              <div className="seg">
                {(["month", "term"] as const).map((p) => (
                  <button key={p} className={form.quota_period === p ? "on" : ""} onClick={() => setForm((f) => f && ({ ...f, quota_period: p }))} type="button" style={{ textTransform: "capitalize" }}>{p}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="hr" style={{ margin: "16px 0" }} />
          <label style={{ display: "block", marginBottom: 14 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Subject entitlements <span className="faint">(comma-separated syllabus codes; empty = all)</span></span>
            <input className="input" value={form.subject_entitlements} onChange={set("subject_entitlements")} placeholder="0620, 0625, 9701" />
          </label>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <NumField label="Student discount %" value={form.discount_pct} onChange={set("discount_pct")} />
            <DateField label="Licence start" value={form.licence_start} onChange={set("licence_start")} />
            <DateField label="Licence expiry" value={form.licence_expiry} onChange={set("licence_expiry")} />
          </div>

          <button
            type="button"
            onClick={() => setForm((f) => f && ({ ...f, allow_admin_script_view: !f.allow_admin_script_view }))}
            className="flex items-center gap-12 mt-16"
            style={{ width: "100%", textAlign: "left" }}
          >
            <span style={{ width: 44, height: 26, borderRadius: 99, flex: "none", background: form.allow_admin_script_view ? "var(--teal)" : "var(--line-strong)", position: "relative", transition: "background .2s" }}>
              <span style={{ position: "absolute", top: 3, left: form.allow_admin_script_view ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "var(--shadow-sm)" }} />
            </span>
            <span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Let the school admin view individual student scripts</span>
              <span className="faint" style={{ display: "block", fontSize: 12.5 }}>Off by default; admins see aggregates only (spec §2/§4.2).</span>
            </span>
          </button>

          {err && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 12 }}>{err}</p>}
          <button className="btn btn-primary btn-lg mt-16" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>

        {/* Side: admins */}
        <div className="card card-pad">
          <div className="card-head"><div className="card-title">Access</div></div>
          <p className="muted" style={{ fontSize: 13.5 }}>Add another school admin. They manage teachers and see aggregate reporting.</p>
          <button className="btn btn-secondary btn-block mt-16" onClick={() => setAddOpen(true)}><Icon name="plus" size={16} /> Add school admin</button>
          <div className="hr" style={{ margin: "16px 0" }} />
          <div className="eyebrow">Created</div>
          <div className="muted mt-6" style={{ fontSize: 13 }}>{new Date(s.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</div>
        </div>
      </div>

      {addOpen && <AddAdminModal id={id} onClose={() => setAddOpen(false)} onDone={() => toast("Admin added", "check_circle")} />}
    </>
  );
}

function UsageStat({ icon, label, used, max, tone }: { icon: string; label: string; used: number; max: number | null; tone: string }) {
  const pct = max && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-10" style={{ marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone, flex: "none" }}><Icon name={icon} size={17} /></div>
        <div className="eyebrow">{label}</div>
      </div>
      <div className="stat-num">{used}<span className="faint" style={{ fontSize: 16 }}>{max != null ? ` / ${max}` : ""}</span></div>
      <div className="mt-12"><Bar value={pct} tone={pct >= 100 ? "coral" : pct >= 80 ? "amber" : "teal"} height={6} /></div>
    </div>
  );
}

function FunnelStat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "12px 14px" }}>
      <div className="stat-num" style={{ color: tone }}>{value}</div>
      <div className="eyebrow" style={{ marginTop: 2 }}>{label}</div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label style={{ display: "block" }}>
      <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>{label}</span>
      <input className="input" value={value} onChange={onChange} inputMode="numeric" />
    </label>
  );
}
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label style={{ display: "block" }}>
      <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>{label}</span>
      <input className="input" value={value} onChange={onChange} type="date" />
    </label>
  );
}

function AddAdminModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ email: string; tempPassword: string | null; existed: boolean } | null>(null);
  const submit = async () => {
    if (!name.trim() || !email.trim()) { setErr("Name and email are required."); return; }
    setBusy(true); setErr(null);
    try { const r = await addSchoolAdmin(id, { name: name.trim(), email: email.trim() }); setRes(r.admin); onDone(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose}>
      {res ? (
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 60, height: 60, margin: "0 auto 12px", borderRadius: 16, display: "grid", placeItems: "center", background: "var(--teal-soft)", color: "var(--teal-deep)" }}><Icon name="check_circle" size={30} /></div>
          <h3 className="card-title" style={{ fontSize: 19 }}>Admin added</h3>
          {!res.existed && res.tempPassword ? (
            <div className="card" style={{ background: "var(--surface-2)", padding: 16, marginTop: 14, textAlign: "left" }}>
              <div className="eyebrow">{res.email}</div>
              <div className="row-between mt-6"><code className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{res.tempPassword}</code>
                <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(res.tempPassword || "")}><Icon name="file_text" size={14} /> Copy</button></div>
            </div>
          ) : <p className="muted mt-6">That email already had an account, now promoted to school admin.</p>}
          <button className="btn btn-primary btn-block mt-16" onClick={onClose}>Done</button>
        </div>
      ) : (
        <>
          <div className="row-between" style={{ marginBottom: 16 }}><h3 className="card-title" style={{ fontSize: 19 }}>Add school admin</h3><button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button></div>
          <label style={{ display: "block", marginBottom: 12 }}><span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label style={{ display: "block", marginBottom: 12 }}><span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Email</span><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></label>
          {err && <p style={{ color: "var(--coral)", fontSize: 13 }}>{err}</p>}
          <div className="flex gap-10 mt-16"><button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>{busy ? "Adding…" : "Add admin"}</button></div>
        </>
      )}
    </Modal>
  );
}
