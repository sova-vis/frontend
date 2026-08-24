import { redirect } from "next/navigation";

// Sign-up is handled by the same "Continue with Google" popup on the landing
// (Clerk registers new Google users through the OAuth flow). Redirect any direct
// hit here to the landing.
export default function SignUpPage() {
  redirect("/");
}
