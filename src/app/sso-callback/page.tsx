"use client";

import { useEffect } from "react";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { showAuthSplash } from "@/lib/authSplash";

/**
 * Google OAuth return handler. Clerk completes the sign-in (or first-time
 * sign-up) here, then sends the user to "/", where the landing routes them on.
 * We raise the Propel splash immediately so the whole hand-off (callback →
 * landing → dashboard) shows one animated logo — no landing flicker.
 */
export default function SSOCallbackPage() {
  useEffect(() => { showAuthSplash(); }, []);
  return <AuthenticateWithRedirectCallback signInForceRedirectUrl="/" signUpForceRedirectUrl="/" />;
}
