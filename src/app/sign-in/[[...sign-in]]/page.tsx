import { redirect } from "next/navigation";

// Sign-in lives on the landing page as a single "Continue with Google" popup.
// Any direct hit here (bookmark, stray Clerk redirect) goes to the landing,
// which shows the Login popup when logged out and routes to the dashboard when
// logged in.
export default function SignInPage() {
  redirect("/");
}
