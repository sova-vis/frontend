"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { showAuthSplash } from "@/lib/authSplash";
import PropelLoader from "@/components/ui/PropelLoader";

/**
 * OAuth return handler. supabase-js (detectSessionInUrl) parses the token from
 * the URL and stores the session; we then route to the neutral role-router
 * (/dashboard). The Propel splash covers the hand-off so it reads as one motion.
 */
function SSOCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") || "/dashboard";

  useEffect(() => {
    showAuthSplash();
    let done = false;
    const go = () => { if (!done) { done = true; router.replace(next); } };

    // If the session is already present, go straight away.
    supabase.auth.getSession().then(({ data }) => { if (data.session) go(); });
    // Otherwise wait for supabase-js to finish parsing the URL / signing in.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { if (session) go(); });
    // Safety net so we never hang on this screen.
    const t = setTimeout(() => router.replace(next), 6000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, [router, next]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <PropelLoader />
    </div>
  );
}

export default function SSOCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><PropelLoader /></div>}>
      <SSOCallbackInner />
    </Suspense>
  );
}
