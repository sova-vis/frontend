"use client";

/** Admin tab: every signed-in user with role + trial/Pro status and days left. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Users as UsersIcon } from "lucide-react";
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

type Filter = "all" | "pro" | "trialing" | "student" | "teacher";

export default function UsersBillingTab() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall("/admin/users-billing");
      const data = await res.json().catch(() => ({}));
      setRows((data.users ?? []) as UserRow[]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => ({
    total: rows.length,
    pro: rows.filter((r) => r.is_pro && r.billing_status !== "trialing").length,
    trialing: rows.filter((r) => r.billing_status === "trialing").length,
  }), [rows]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "pro" && !(r.is_pro && r.billing_status !== "trialing")) return false;
      if (filter === "trialing" && r.billing_status !== "trialing") return false;
      if (filter === "student" && r.role !== "student") return false;
      if (filter === "teacher" && r.role !== "teacher") return false;
      if (term && !(`${r.full_name ?? ""} ${r.email ?? ""}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [rows, filter, q]);

  const planLabel = (r: UserRow) => {
    if (r.billing_status === "trialing") return "Free trial";
    if (r.is_pro) return r.plan === "manual" ? "Pro (manual)" : r.plan ? `Pro (${r.plan})` : "Pro";
    return r.billing_status;
  };

  return (
    <section className="ed-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight text-ink inline-flex items-center gap-2"><UsersIcon size={18} /> Users &amp; Plans</h3>
          <p className="text-sm text-ink-muted">Everyone who&apos;s signed in, with their plan and days remaining.</p>
        </div>
        <button onClick={() => void load()} className="ed-btn-ghost px-3 py-2" title="Refresh"><RefreshCw size={15} /></button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Total users" value={stats.total} />
        <Stat label="Pro" value={stats.pro} tone="mint" />
        <Stat label="On trial" value={stats.trialing} tone="gold" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-xl border border-line p-0.5">
          {(["all", "pro", "trialing", "student", "teacher"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${filter === f ? "bg-ink text-paper" : "text-ink-muted"}`}>{f}</button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="ed-input pl-9" />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading users…</p>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-paper">
              <tr className="border-b border-line text-left text-ink-faint">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3">Days left</th>
                <th className="py-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.clerk_id} className="border-b border-line hover:bg-surface-soft">
                  <td className="py-2 pr-3 text-ink">{r.full_name || "—"}</td>
                  <td className="py-2 pr-3 text-ink-muted">{r.email || "—"}</td>
                  <td className="py-2 pr-3"><span className={r.role === "admin" ? "ed-pill-crimson" : r.role === "teacher" ? "ed-pill-gold" : "ed-pill-clay"}>{r.role}</span></td>
                  <td className="py-2 pr-3">
                    {r.billing_status === "trialing" ? <span className="ed-pill-gold">Free trial</span>
                      : r.is_pro ? <span className="ed-pill-mint">{planLabel(r)}</span>
                      : <span className="ed-pill-clay">{planLabel(r)}</span>}
                  </td>
                  <td className="py-2 pr-3 text-ink">{typeof r.days_left === "number" ? `${r.days_left}d` : "—"}</td>
                  <td className="py-2 text-ink-muted whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-ink-muted">No users match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "mint" | "gold" }) {
  return (
    <div className="rounded-xl border border-line bg-surface-soft p-3">
      <p className="ed-label">{label}</p>
      <p className={`font-display text-2xl font-semibold ${tone === "mint" ? "text-mint-ink" : tone === "gold" ? "text-gold-ink" : "text-ink"}`}>{value}</p>
    </div>
  );
}
