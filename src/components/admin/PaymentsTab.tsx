"use client";

/** Admin tab: the general QR + payee details shown to students, and promo codes
 *  (each with its own QR that swaps in when a student enters that code). */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Trash2, Upload, Plus, QrCode } from "lucide-react";
import { apiCall } from "@/lib/api";

interface PayConfig {
  qr_image: string | null;
  payee_name: string | null;
  account_number: string | null;
  bank_name: string | null;
  instructions: string | null;
  amount_pkr: number | null;
}
interface Promo {
  id: string;
  code: string;
  label: string | null;
  note: string | null;
  amount_pkr: number | null;
  qr_image: string | null;
  active: boolean;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export default function PaymentsTab() {
  const [cfg, setCfg] = useState<PayConfig>({ qr_image: null, payee_name: "", account_number: "", bank_name: "", instructions: "", amount_pkr: null });
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCfg, setSavingCfg] = useState(false);
  const [cfgSaved, setCfgSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([apiCall("/admin/pay-config"), apiCall("/admin/promo-codes")]);
      const cData = await c.json().catch(() => ({}));
      const pData = await p.json().catch(() => ({}));
      if (cData.config) setCfg({
        qr_image: cData.config.qr_image ?? null,
        payee_name: cData.config.payee_name ?? "",
        account_number: cData.config.account_number ?? "",
        bank_name: cData.config.bank_name ?? "",
        instructions: cData.config.instructions ?? "",
        amount_pkr: cData.config.amount_pkr ?? null,
      });
      setPromos((pData.promos ?? []) as Promo[]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const saveConfig = async () => {
    setSavingCfg(true);
    setCfgSaved(false);
    try {
      const res = await apiCall("/admin/pay-config", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrImage: cfg.qr_image, payeeName: cfg.payee_name, accountNumber: cfg.account_number,
          bankName: cfg.bank_name, instructions: cfg.instructions, amountPkr: cfg.amount_pkr,
        }),
      });
      if (res.ok) { setCfgSaved(true); setTimeout(() => setCfgSaved(false), 2000); }
    } finally {
      setSavingCfg(false);
    }
  };

  if (loading) return <section className="ed-card p-6"><p className="text-sm text-ink-muted">Loading payment settings…</p></section>;

  return (
    <div className="space-y-6">
      {/* General QR + payee */}
      <section className="ed-card p-6">
        <h3 className="font-display text-lg font-semibold tracking-tight text-ink inline-flex items-center gap-2"><QrCode size={18} /> General QR &amp; payee details</h3>
        <p className="text-sm text-ink-muted mb-4">Shown to every student who doesn&apos;t enter a promo code.</p>
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <QrUpload value={cfg.qr_image} onChange={(v) => setCfg((c) => ({ ...c, qr_image: v }))} />
          <div className="space-y-3">
            <LabeledInput label="Account / holder name" value={cfg.payee_name || ""} onChange={(v) => setCfg((c) => ({ ...c, payee_name: v }))} placeholder="e.g. Propel Cambridge" />
            <LabeledInput label="Bank / wallet" value={cfg.bank_name || ""} onChange={(v) => setCfg((c) => ({ ...c, bank_name: v }))} placeholder="e.g. Meezan / JazzCash" />
            <LabeledInput label="Account number / IBAN" value={cfg.account_number || ""} onChange={(v) => setCfg((c) => ({ ...c, account_number: v }))} placeholder="PKxx..." />
            <div>
              <label className="ed-label mb-1 block">Base price (Rs)</label>
              <input type="number" className="ed-input" value={cfg.amount_pkr ?? ""} onChange={(e) => setCfg((c) => ({ ...c, amount_pkr: e.target.value ? Number(e.target.value) : null }))} placeholder="999" />
            </div>
            <div>
              <label className="ed-label mb-1 block">Instructions (optional)</label>
              <textarea rows={2} className="ed-input" value={cfg.instructions || ""} onChange={(e) => setCfg((c) => ({ ...c, instructions: e.target.value }))} placeholder="e.g. Send the screenshot to our WhatsApp after paying." />
            </div>
            <button onClick={saveConfig} disabled={savingCfg} className="ed-btn-primary">
              {savingCfg ? <><Loader2 size={15} className="mr-1 animate-spin" /> Saving…</> : cfgSaved ? <><Check size={15} className="mr-1" /> Saved</> : "Save details"}
            </button>
          </div>
        </div>
      </section>

      {/* Promo codes */}
      <PromoManager promos={promos} onChanged={load} />
    </div>
  );
}

function PromoManager({ promos, onChanged }: { promos: Promo[]; onChanged: () => Promise<void> }) {
  const blank = { code: "", label: "", note: "", amount_pkr: null as number | null, qr_image: null as string | null, active: true };
  const [draft, setDraft] = useState<{ id?: string } & typeof blank>(blank);
  const [saving, setSaving] = useState(false);

  const edit = (p: Promo) => setDraft({ id: p.id, code: p.code, label: p.label || "", note: p.note || "", amount_pkr: p.amount_pkr, qr_image: p.qr_image, active: p.active });
  const reset = () => setDraft(blank);

  const save = async () => {
    if (!draft.code.trim()) return;
    setSaving(true);
    try {
      const res = await apiCall("/admin/promo-codes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id, code: draft.code, label: draft.label, note: draft.note, amountPkr: draft.amount_pkr, qrImage: draft.qr_image, active: draft.active }),
      });
      if (res.ok) { reset(); await onChanged(); }
    } finally {
      setSaving(false);
    }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Delete this promo code?")) return;
    await apiCall(`/admin/promo-codes/${id}`, { method: "DELETE" });
    await onChanged();
  };

  return (
    <section className="ed-card p-6">
      <h3 className="font-display text-lg font-semibold tracking-tight text-ink">Promo codes</h3>
      <p className="text-sm text-ink-muted mb-4">Create a code and attach its own QR — students who enter it see that QR (and optional discounted price).</p>

      {/* existing */}
      {promos.length > 0 && (
        <div className="mb-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-ink-faint">
              <th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Label</th><th className="py-2 pr-3">Price</th><th className="py-2 pr-3">QR</th><th className="py-2 pr-3">Active</th><th className="py-2"></th>
            </tr></thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-b border-line hover:bg-surface-soft">
                  <td className="py-2 pr-3"><span className="ed-pill-crimson">{p.code}</span></td>
                  <td className="py-2 pr-3 text-ink-muted">{p.label || "—"}</td>
                  <td className="py-2 pr-3 text-ink">{p.amount_pkr != null ? `Rs ${p.amount_pkr.toLocaleString()}` : "—"}</td>
                  <td className="py-2 pr-3">{p.qr_image ? <span className="ed-pill-mint">set</span> : <span className="ed-pill-clay">none</span>}</td>
                  <td className="py-2 pr-3">{p.active ? <span className="ed-pill-mint">on</span> : <span className="ed-pill-clay">off</span>}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => edit(p)} className="mr-2 text-xs font-semibold text-crimson underline">Edit</button>
                    <button onClick={() => void remove(p.id)} className="text-ink-faint hover:text-crimson-ink"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* editor */}
      <div className="rounded-xl border border-line bg-surface-soft p-4">
        <p className="ed-label mb-3">{draft.id ? `Edit ${draft.code}` : "Add a promo code"}</p>
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <QrUpload value={draft.qr_image} onChange={(v) => setDraft((d) => ({ ...d, qr_image: v }))} small />
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledInput label="Code" value={draft.code} onChange={(v) => setDraft((d) => ({ ...d, code: v.toUpperCase() }))} placeholder="EID20" />
              <LabeledInput label="Label (internal)" value={draft.label} onChange={(v) => setDraft((d) => ({ ...d, label: v }))} placeholder="Eid 20% off" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="ed-label mb-1 block">Discounted price (Rs)</label>
                <input type="number" className="ed-input" value={draft.amount_pkr ?? ""} onChange={(e) => setDraft((d) => ({ ...d, amount_pkr: e.target.value ? Number(e.target.value) : null }))} placeholder="799" />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm text-ink">
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} /> Active
              </label>
            </div>
            <LabeledInput label="Note shown to student (optional)" value={draft.note} onChange={(v) => setDraft((d) => ({ ...d, note: v }))} placeholder="20% off — limited time" />
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !draft.code.trim()} className="ed-btn-primary">
                {saving ? <><Loader2 size={15} className="mr-1 animate-spin" /> Saving…</> : draft.id ? "Save changes" : <><Plus size={15} className="mr-1" /> Add promo</>}
              </button>
              {draft.id && <button onClick={reset} className="ed-btn-ghost">Cancel</button>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QrUpload({ value, onChange, small }: { value: string | null; onChange: (v: string | null) => void; small?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");
  const size = small ? "h-40 w-40" : "h-52 w-52";
  const pick = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Please choose an image."); return; }
    if (file.size > 1.5 * 1024 * 1024) { setErr("Image must be under 1.5 MB."); return; }
    setErr("");
    onChange(await fileToDataUrl(file));
  };
  return (
    <div>
      <div className={`relative mx-auto ${size} overflow-hidden rounded-xl border border-line bg-white`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="QR" className="h-full w-full object-contain p-1.5" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-faint">
            <QrCode size={28} /><span className="text-[11px]">No QR yet</span>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.currentTarget.value = ""; }} />
      <div className="mt-2 flex justify-center gap-2">
        <button onClick={() => ref.current?.click()} className="ed-btn-ghost inline-flex items-center gap-1 px-3 py-1.5 text-xs"><Upload size={13} /> {value ? "Replace" : "Upload QR"}</button>
        {value && <button onClick={() => onChange(null)} className="text-xs text-ink-faint underline">Remove</button>}
      </div>
      {err && <p className="mt-1 text-center text-[11px] text-crimson-ink">{err}</p>}
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="ed-label mb-1 block">{label}</label>
      <input className="ed-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
