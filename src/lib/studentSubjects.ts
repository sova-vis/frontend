// The canonical list of subjects a student can pick, shared by onboarding and
// the settings profile manager.
export const SUBJECT_OPTIONS = [
  "Mathematics", "Additional Mathematics", "Further Mathematics", "Statistics",
  "Physics", "Chemistry", "Biology", "Computer Science",
  "Economics", "Business", "Accounting", "Sociology", "Psychology",
  "English Language", "English Literature", "Urdu",
  "Geography", "History", "Islamiyat", "Pakistan Studies",
];

export function subjectSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
