"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiCall } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { BrandLogo } from "@/components/ui/Logo";
import { Icon } from "@/components/propel/Icon";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !user) router.replace("/");
  }, [isLoaded, user, router]);

  const submit = async () => {
    if (pw.length < 8) { setErr("Use at least 8 characters."); return; }
    if (pw !== pw2) { setErr("Those passwords do not match."); return; }
    setBusy(true); setErr(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw new Error(error.message);
      await apiCall("/auth/password-changed", { method: "POST" });
      // Bust the cached profile so the first-login gate stops firing, then reload
      // home — destForUser routes them to their console.
      if (user?.id) window.localStorage.removeItem("propel_profile_" + user.id);
      window.location.href = "/";
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="pr">
      <div className="app-root" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
        <div className="card card-pad" style={{ maxWidth: 430, width: "100%" }}>
          <div style={{ marginBottom: 18 }}><BrandLogo size={30} labelClassName="text-xl" /></div>
          <div style={{ width: 52, height: 52, borderRadius: 14, display: "grid", placeItems: "center", background: "var(--crimson-soft)", color: "var(--crimson)", marginBottom: 14 }}>
            <Icon name="shield" size={26} />
          </div>
          <h1 className="big-num" style={{ fontSize: 24 }}>Set your password</h1>
          <p className="muted" style={{ marginTop: 6 }}>Your account was created with a temporary password. Choose a new one to finish setting up.</p>

          <label style={{ display: "block", marginTop: 18 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>New password</span>
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" />
          </label>
          <label style={{ display: "block", marginTop: 12 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Confirm new password</span>
            <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          </label>

          {err && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 12 }}>{err}</p>}

          <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 18 }} onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save and continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
