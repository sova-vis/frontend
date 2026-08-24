import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Routes anyone can hit without being signed in.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/auth/callback(.*)",
  "/sso-callback(.*)",
  "/api/webhooks/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const authState = typeof auth === "function" ? await auth() : (auth as any);
  const userId = authState?.userId;

  // Signed-out visitor on a protected route → send them to OUR landing page
  // (which shows the Login popup). Never to Clerk's hosted Account Portal, which
  // is what auth.protect() would do here. Any link → landing when logged out,
  // dashboard when logged in (the app routes signed-in users by role).
  if (!userId && !isPublicRoute(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
