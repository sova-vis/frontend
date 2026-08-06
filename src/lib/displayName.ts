// Resolve a person's display name: real name → Clerk first name / username →
// the email local part (before @) → fallback. Never shows a bare "User".
export function resolveName(opts: {
  full_name?: string | null;
  firstName?: string | null;
  username?: string | null;
  email?: string | null;
  fallback?: string;
}): string {
  const name = (opts.full_name || "").trim();
  if (name && name.toLowerCase() !== "user") return name;
  const first = (opts.firstName || "").trim();
  if (first) return first;
  const username = (opts.username || "").trim();
  if (username) return username;
  const local = (opts.email || "").split("@")[0]?.trim();
  if (local) return local;
  return opts.fallback || "there";
}
