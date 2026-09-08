import { NextResponse } from "next/server";

/**
 * Auth is handled by Supabase (session in the browser), and every protected
 * route already guards client-side in its layout (`if (!user) router.replace("/")`).
 * There's no server-readable session cookie to gate on here, so the middleware
 * is a pass-through. (Kept as a file so the matcher/config stays documented.)
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|png|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
