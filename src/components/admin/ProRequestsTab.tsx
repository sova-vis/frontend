"use client";

/** Admin tab: manual Pro payment requests — review, activate 30-day Pro, or reject. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, X, RefreshCw, Loader2, Clock } from "lucide-react";
import { apiCall } from "@/lib/api";

interface ProRequestRow {
  id: string;
  clerk_id: string;
  name: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  cardholder_name: string | null;
  promo_code: string | null;
  amount_pkr: number | null;
  status: string;              // pending | approved | rejected
  created_at: string;
  billing_status: string;      // current billing state
  is_pro: boolean;
  days_left: number | null;
}

export default function ProRequestsTab() {
  const [rows, setRows] = useState<ProRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiCall("/admin/pro-requests");
      if (!res.ok) throw new Error("Failed to load requests");
      const data = await res.json();
      setRows((data.requests ?? []) as ProRequestRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activate = async (row: ProRequestRow) => {
    if (!window.confirm(`Activate 30 days of Pro for ${row.email}?`)) return;
    setBusyId(row.id);
    try {
      const res = await apiCall(`/admin/pro-requests/${row.id}/activate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: 30 }) });
      if (!res.ok) throw new Error("activation failed");
      await load();
    } catch {
      window.alert("Could not activate. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (row: ProRequestRow) => {
    if (!window.confirm(`Reject the request from ${row.email}?`)) return;
    setBusyId(row.id);
    try {
      await apiCall(`/admin/pro-requests/${row.id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const shown = useMemo(() => filter === "pending" ? rows.filter((r) => r.status === "pending") : rows, [rows, filter]);
  const pendingCount = useMemo(() => rows.filter((r) => r.status === "pending").length, [rows]);

  return (
    <section className="ed-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight text-ink inline-flex items-center gap-2">
            <Clock size={18} /> Pro Requests
            {pendingCount > 0 && <span className="ed-pill-gold">{pendingCount} pending</span>}
          </h3>
          <p className="text-sm text-ink-muted">Manual payments awaiting review. Activating grants a 30-day Pro period.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-line p-0.5">
            {(["pending", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${filter === f ? "bg-ink text-paper" : "text-ink-muted"}`}>{f}</button>
            ))}
          </div>
          <button onClick={() => void load()} className="ed-btn-ghost px-3 py-2" title="Refresh"><RefreshCw size={15} /></button>
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-crimson-soft px-3 py-2 text-sm text-crimson-ink">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading requests…</p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-ink-muted">No {filter === "pending" ? "pending " : ""}requests.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-faint">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Paid as</th>
                <th className="py-2 pr-3">Promo</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Requested</th>
                <th className="py-2 pr-3">Current plan</th>
                <th className="py-2 pr-3">Request</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-line align-top hover:bg-surface-soft">
                  <td className="py-2 pr-3 text-ink">{r.full_name || r.name || "—"}</td>
                  <td className="py-2 pr-3 text-ink-muted">{r.email}</td>
                  <td className="py-2 pr-3 text-ink-muted">{r.phone || "—"}</td>
                  <td className="py-2 pr-3 text-ink-muted">{r.cardholder_name || "—"}</td>
                  <td className="py-2 pr-3">{r.promo_code ? <span className="ed-pill-crimson">{r.promo_code}</span> : <span className="text-ink-faint">—</span>}</td>
                  <td className="py-2 pr-3 text-ink">{r.amount_pkr != null ? `Rs ${r.amount_pkr.toLocaleString()}` : "—"}</td>
                  <td className="py-2 pr-3 text-ink-muted whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="py-2 pr-3">
                    {r.is_pro
                      ? <span className="ed-pill-mint">{r.billing_status}{typeof r.days_left === "number" ? ` · ${r.days_left}d` : ""}</span>
                      : <span className="ed-pill-clay">{r.billing_status}</span>}
                  </td>
                  <td className="py-2 pr-3">
                    {r.status === "pending" ? <span className="ed-pill-gold">pending</span>
                      : r.status === "approved" ? <span className="ed-pill-mint">approved</span>
                      : <span className="ed-pill-clay">{r.status}</span>}
                  </td>
                  <td className="py-2">
                    {r.status === "pending" ? (
                      <div className="flex gap-1.5">
                        <button onClick={() => void activate(r)} disabled={busyId === r.id} className="inline-flex items-center gap-1 rounded-lg bg-mint-ink px-2.5 py-1.5 text-xs font-semibold text-paper disabled:opacity-50">
                          {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Activate
                        </button>
                        <button onClick={() => void reject(r)} disabled={busyId === r.id} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface disabled:opacity-50">
                          <X size={13} /> Reject
                        </button>
                      </div>
                    ) : r.is_pro ? (
                      <button onClick={() => void activate(r)} disabled={busyId === r.id} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface disabled:opacity-50">
                        {busyId === r.id ? "…" : "+30 days"}
                      </button>
                    ) : (
                      <button onClick={() => void activate(r)} disabled={busyId === r.id} className="inline-flex items-center gap-1 rounded-lg bg-mint-ink px-2.5 py-1.5 text-xs font-semibold text-paper disabled:opacity-50">
                        {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
