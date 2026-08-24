"use client";

import { useEffect } from "react";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { showAuthSplash } from "@/lib/authSplash";

/**
 * Google OAuth return handler. Clerk completes the sign-in (or first-time
 * sign-up) here, then sends the user to "/dashboard" — the neutral role-router,
 * NOT the marketing landing (that "/" briefly rendered and caused the flicker).
 * We raise the Propel splash immediately so the whole hand-off shows one
 * animated logo straight through to the dashboard.
 */
export default function SSOCallbackPage() {
  useEffect(() => { showAuthSplash(); }, []);
  return <AuthenticateWithRedirectCallback signInForceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard" />;
}
