// The canonical list of subjects a student can pick, shared by onboarding and
// the settings profile manager.
export const SUBJECT_OPTIONS = [
  "Mathematics", "Further Mathematics", "Statistics",
  "Physics", "Chemistry", "Biology", "Computer Science",
  "Economics", "Business", "Accounting", "Commerce", "Sociology", "Psychology",
  "English Language", "English Literature", "Urdu",
  "Geography", "History", "Islamiyat", "Pakistan Studies",
  "Art and Design", "Environmental Management", "Religious Studies",
];

// Per-level fallbacks — only used when the live Drive library can't be reached,
// so O and A still show their own (different) subjects instead of one generic
// list. Mirror the actual past-paper Drive folders.
export const O_LEVEL_SUBJECTS = [
  "Accounting", "Art and Design", "Biology", "Business Studies", "Chemistry",
  "Commerce", "Computer Science", "Economics", "English Language", "Environmental Management",
  "Geography", "History", "Islamiyat", "Mathematics", "Pakistan Studies",
  "Physics", "Religious Studies", "Sociology", "Statistics",
];
export const A_LEVEL_SUBJECTS = [
  "Accounting", "Biology", "Business", "Chemistry", "Computer Science", "Economics",
  "English General Paper", "English Language", "Further Mathematics", "Geography",
  "Global Perspectives & Research", "History", "Information Technology", "Law",
  "Literature in English", "Mathematics", "Physics", "Psychology", "Sociology",
];

// Subjects hidden from Practice / Past Papers everywhere because their content
// isn't ready/correct yet — filtered out even if a legacy selection or library
// folder still references them.
export const EXCLUDED_SUBJECTS = ["additional mathematics"];

export function isExcludedSubject(name: string): boolean {
  const n = name.toLowerCase();
  return EXCLUDED_SUBJECTS.some((e) => n === e || n.startsWith(`${e} `) || n.includes(e));
}

export function subjectSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
