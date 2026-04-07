import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/auth/callback(.*)",
  "/sso-callback(.*)",
  "/past-papers",
  "/api/webhooks/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const authState = typeof auth === "function" ? await auth() : (auth as any);
  const userId = authState?.userId;

  if (req.nextUrl.pathname === "/" && userId) {
    // Let the app route with backend profile data to avoid stale session-claim redirects.
    return NextResponse.next();
  }

  if (!isPublicRoute(req)) {
    if (typeof auth === "function") {
      const authFn = auth as any;
      await authFn.protect();
    } else {
      await (auth as any).protect();
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
