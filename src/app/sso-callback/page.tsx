"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { BrandLogo } from "@/components/ui/Logo";

/**
 * Google OAuth return handler. Clerk completes the sign-in (or first-time
 * sign-up) here, then sends the user to redirectUrlComplete ("/"), where the
 * landing routes them to their dashboard/onboarding.
 */
export default function SSOCallbackPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-paper">
      <div className="flex flex-col items-center gap-4">
        <BrandLogo size={40} />
        <div className="flex items-center gap-2 text-ink-muted text-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-crimson" />
          Signing you in…
        </div>
      </div>
      <AuthenticateWithRedirectCallback signInForceRedirectUrl="/" signUpForceRedirectUrl="/" />
    </div>
  );
}
