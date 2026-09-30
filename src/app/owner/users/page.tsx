"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/propel/Icon";
import { CountUp, Segmented, Modal, useToast } from "@/components/propel/primitives";
import { apiCall } from "@/lib/api";

interface UserRow {
  clerk_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  onboarding_complete: boolean;
  created_at: string | null;
  billing_status: string;
  is_pro: boolean;
  plan: string | null;
  days_left: number | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
}

type PlanFilter = "all" | "pro" | "trial" | "free";
type RoleFilter = "all" | "student" | "teacher" | "school_admin" | "admin";

function planKind(r: UserRow): "pro" | "trial" | "free" {
  if (r.billing_status === "trialing") return "trial";
  if (r.is_pro) return "pro";
  return "free";
}
function planLabel(r: UserRow) {
  const k = planKind(r);
  if (k === "trial") return "Free trial";
  if (k === "pro") return r.plan === "manual" ? "Pro · manual" : r.plan ? `Pro · ${r.plan}` : "Pro";
  return "Free";
}
function roleTone(role: string) {
  return role === "admin" || role === "owner" ? "crimson" : role === "school_admin" ? "purple" : role === "teacher" ? "teal" : "neutral";
}

export default function OwnerUsersPage() {
  const toast = useToast();
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const [q, setQ] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const setPreset = (kind: "month" | "30" | "clear") => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (kind === "month") { setFromDate(fmt(new Date(now.getFullYear(), now.getMonth(), 1))); setToDate(fmt(now)); }
    else if (kind === "30") { const d = new Date(now); d.setDate(d.getDate() - 30); setFromDate(fmt(d)); setToDate(fmt(now)); }
    else { setFromDate(""); setToDate(""); }
  };
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    const res = await apiCall("/admin/users-billing");
    const data = await res.json().catch(() => ({}));
    setRows((data.users ?? []) as UserRow[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const r = rows ?? [];
    return {
      total: r.length,
      pro: r.filter((x) => planKind(x) === "pro").length,
      trial: r.filter((x) => planKind(x) === "trial").length,
      free: r.filter((x) => planKind(x) === "free").length,
    };
  }, [rows]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const fromT = fromDate ? Date.parse(fromDate) : null;
    const toT = toDate ? Date.parse(toDate) + 86400000 : null;
    const list = (rows ?? []).filter((r) => {
      if (plan !== "all" && planKind(r) !== plan) return false;
      if (role !== "all" && r.role !== role) return false;
      if (term && !`${r.full_name ?? ""} ${r.email ?? ""}`.toLowerCase().includes(term)) return false;
      const t = r.created_at ? Date.parse(r.created_at) : null;
      if (fromT !== null && (t === null || t < fromT)) return false;
      if (toT !== null && (t === null || t > toT)) return false;
      return true;
    });
    list.sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return newestFirst ? tb - ta : ta - tb;
    });
    return list;
  }, [rows, plan, role, q, newestFirst, fromDate, toDate]);

  const revoke = async (r: UserRow) => {
    setBusyId(r.clerk_id);
    try {
      const res = await apiCall(`/admin/users/${encodeURIComponent(r.clerk_id)}/revoke-pro`, { method: "POST" });
      if (!res.ok) throw new Error("failed");
      toast(r.billing_status === "trialing" ? "Trial ended" : "Pro cancelled", "check_circle");
      setConfirm(null);
      await load();
    } catch { toast("Could not update. Try again.", "alert"); }
    finally { setBusyId(null); }
  };

  return (
    <>
      <div className="row-between wrap gap-16" style={{ marginBottom: 24 }}>
        <div>
          <span className="eyebrow">Platform Owner</span>
          <h1 className="big-num" style={{ fontSize: 34, marginTop: 6 }}>Users</h1>
          <p className="muted" style={{ marginTop: 4 }}>Everyone signed in, with their plan and when they joined.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => { setRows(null); void load(); }}><Icon name="refresh" size={16} /> Refresh</button>
      </div>

      <div className="grid stagger" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 22 }}>
        <UStat icon="users" tone="var(--crimson)" label="Total users" value={stats.total} />
        <UStat icon="check_circle" tone="var(--teal)" label="Pro" value={stats.pro} />
        <UStat icon="clock" tone="var(--amber)" label="On trial" value={stats.trial} />
        <UStat icon="minus" tone="var(--ink-faint)" label="Free" value={stats.free} />
      </div>

      {/* Filter bar */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="flex items-center gap-12 wrap">
          <div>
            <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Plan</span>
            <Segmented options={[{ value: "all", label: "All" }, { value: "pro", label: "Pro" }, { value: "trial", label: "Trial" }, { value: "free", label: "Free" }]} value={plan} onChange={setPlan} />
          </div>
          <div>
            <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Sort</span>
            <Segmented options={[{ value: "new", label: "Newest" }, { value: "old", label: "Oldest" }]} value={newestFirst ? "new" : "old"} onChange={(v) => setNewestFirst(v === "new")} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Search</span>
            <div className="search"><Icon name="search" size={16} className="faint" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email…" /></div>
          </div>
          <div>
            <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Role</span>
            <select className="input" style={{ width: 160 }} value={role} onChange={(e) => setRole(e.target.value as RoleFilter)}>
              <option value="all">All roles</option>
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
              <option value="school_admin">School admins</option>
              <option value="admin">Owners / admins</option>
            </select>
          </div>
        </div>
        <div className="hr" style={{ margin: "14px 0" }} />
        <div className="flex items-center gap-10 wrap">
          <span className="eyebrow">Joined between</span>
          <input className="input" style={{ width: 158 }} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <span className="faint">and</span>
          <input className="input" style={{ width: 158 }} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <div className="flex gap-8" style={{ marginLeft: 4 }}>
            <button className="chip" onClick={() => setPreset("month")}>This month</button>
            <button className="chip" onClick={() => setPreset("30")}>Last 30 days</button>
            <button className="chip" onClick={() => setPreset("clear")}>All time</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card card-pad">
        {rows === null ? (
          <div className="grid" style={{ gap: 10 }}>{[0, 1, 2, 3].map((i) => <div key={i} className="sk" style={{ height: 44, borderRadius: 10 }} />)}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                  {["Name", "Email", "Role", "Plan", "Days left", "Joined", ""].map((h) => (
                    <th key={h || "act"} style={{ padding: "8px 12px 10px", whiteSpace: "nowrap", textAlign: "left", fontFamily: "var(--font-roboto-mono), ui-monospace, monospace", fontSize: 11, fontWeight: 500, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--ink-faint)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.clerk_id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.full_name || "—"}</td>
                    <td style={{ padding: "10px 12px" }} className="muted">{r.email || "—"}</td>
                    <td style={{ padding: "10px 12px" }}><span className={`badge ${roleTone(r.role)}`} style={{ textTransform: "capitalize" }}>{r.role.replace("_", " ")}</span></td>
                    <td style={{ padding: "10px 12px" }}><span className={`badge ${planKind(r) === "pro" ? "teal" : planKind(r) === "trial" ? "amber" : "neutral"}`}>{planLabel(r)}</span></td>
                    <td style={{ padding: "10px 12px" }} className="mono">{typeof r.days_left === "number" ? `${r.days_left}d` : "—"}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }} className="muted">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      {r.is_pro
                        ? <button className="btn btn-ghost btn-sm" style={{ color: "var(--coral)" }} onClick={() => setConfirm(r)}><Icon name="x" size={14} /> {r.billing_status === "trialing" ? "End trial" : "Cancel Pro"}</button>
                        : <span className="faint">—</span>}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={7} className="muted" style={{ padding: "28px 0", textAlign: "center" }}>No users match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirm && (
        <Modal open onClose={() => setConfirm(null)}>
          <h3 className="card-title" style={{ fontSize: 19 }}>{confirm.billing_status === "trialing" ? "End free trial?" : "Cancel Pro?"}</h3>
          <p className="muted" style={{ marginTop: 8 }}>
            {confirm.billing_status === "trialing" ? "The free trial for " : "Pro access for "}
            <strong>{confirm.email || confirm.full_name || "this user"}</strong> ends immediately.
          </p>
          <div className="flex gap-10 mt-16">
            <button className="btn btn-ghost" onClick={() => setConfirm(null)} disabled={busyId === confirm.clerk_id}>Keep it</button>
            <button className="btn btn-block" style={{ background: "var(--coral)", color: "#fff" }} onClick={() => revoke(confirm)} disabled={busyId === confirm.clerk_id}>
              {busyId === confirm.clerk_id ? "Working…" : confirm.billing_status === "trialing" ? "End trial" : "Cancel Pro"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function UStat({ icon, tone, label, value }: { icon: string; tone: string; label: string; value: number }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-12">
        <div style={{ width: 40, height: 40, borderRadius: 11, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone, flex: "none" }}><Icon name={icon} size={19} /></div>
        <div><div className="stat-num"><CountUp value={value} /></div><div className="eyebrow" style={{ marginTop: 3 }}>{label}</div></div>
      </div>
    </div>
  );
}
