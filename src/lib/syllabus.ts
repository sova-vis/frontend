/**
 * Controlled syllabus-code catalog (spec §1.5, §3.1).
 * Codes are selected from this list, never free text. A class belongs to
 * exactly one code, which will drive which questions are available (§3.1).
 *
 * Level 'O' groups Cambridge O Level and IGCSE (both pre-A-Level); 'A' is
 * Cambridge International AS & A Level. Extend as content ingestion adds
 * syllabuses (Appendix A / Open decision B.4 — syllabus scope at launch).
 */

export type SyllabusLevel = "O" | "A";

export interface Syllabus {
  code: string;
  subject: string;
  level: SyllabusLevel;
  board: "O Level" | "IGCSE" | "A Level";
}

export const SYLLABUSES: Syllabus[] = [
  // ---- Cambridge O Level ----
  { code: "5054", subject: "Physics", level: "O", board: "O Level" },
  { code: "5070", subject: "Chemistry", level: "O", board: "O Level" },
  { code: "5090", subject: "Biology", level: "O", board: "O Level" },
  { code: "4024", subject: "Mathematics (Syllabus D)", level: "O", board: "O Level" },
  { code: "4037", subject: "Additional Mathematics", level: "O", board: "O Level" },
  { code: "2210", subject: "Computer Science", level: "O", board: "O Level" },
  { code: "2281", subject: "Economics", level: "O", board: "O Level" },
  { code: "7115", subject: "Business Studies", level: "O", board: "O Level" },
  { code: "7707", subject: "Accounting", level: "O", board: "O Level" },
  { code: "2058", subject: "Islamiyat", level: "O", board: "O Level" },
  { code: "2059", subject: "Pakistan Studies", level: "O", board: "O Level" },
  { code: "1123", subject: "English Language", level: "O", board: "O Level" },
  { code: "2251", subject: "Sociology", level: "O", board: "O Level" },
  { code: "2217", subject: "Geography", level: "O", board: "O Level" },
  { code: "2147", subject: "History", level: "O", board: "O Level" },

  // ---- Cambridge IGCSE (grouped under level O) ----
  { code: "0625", subject: "Physics", level: "O", board: "IGCSE" },
  { code: "0620", subject: "Chemistry", level: "O", board: "IGCSE" },
  { code: "0610", subject: "Biology", level: "O", board: "IGCSE" },
  { code: "0654", subject: "Co-ordinated Sciences", level: "O", board: "IGCSE" },
  { code: "0580", subject: "Mathematics", level: "O", board: "IGCSE" },
  { code: "0606", subject: "Additional Mathematics", level: "O", board: "IGCSE" },
  { code: "0478", subject: "Computer Science", level: "O", board: "IGCSE" },
  { code: "0455", subject: "Economics", level: "O", board: "IGCSE" },
  { code: "0450", subject: "Business Studies", level: "O", board: "IGCSE" },
  { code: "0985", subject: "English Language", level: "O", board: "IGCSE" },

  // ---- Cambridge International AS & A Level ----
  { code: "9702", subject: "Physics", level: "A", board: "A Level" },
  { code: "9701", subject: "Chemistry", level: "A", board: "A Level" },
  { code: "9700", subject: "Biology", level: "A", board: "A Level" },
  { code: "9709", subject: "Mathematics", level: "A", board: "A Level" },
  { code: "9231", subject: "Further Mathematics", level: "A", board: "A Level" },
  { code: "9618", subject: "Computer Science", level: "A", board: "A Level" },
  { code: "9708", subject: "Economics", level: "A", board: "A Level" },
  { code: "9609", subject: "Business", level: "A", board: "A Level" },
  { code: "9706", subject: "Accounting", level: "A", board: "A Level" },
  { code: "9093", subject: "English Language", level: "A", board: "A Level" },
];

export function syllabusByCode(code: string): Syllabus | undefined {
  return SYLLABUSES.find((s) => s.code === code);
}

export function syllabusesForLevel(level: SyllabusLevel): Syllabus[] {
  return SYLLABUSES.filter((s) => s.level === level);
}

export function syllabusLabel(code: string): string {
  const s = syllabusByCode(code);
  return s ? `${s.subject} (${s.code})` : code;
}

/* ---------------------------------------------------------------------------
 * Teacher subject-scope tokens
 *
 * A school-admin assigns a teacher the LEVELS & SUBJECTS they teach; those are
 * stored in profiles.syllabus_codes. Historically that column held numeric
 * Cambridge codes ("5054"). It now holds LEVEL-QUALIFIED SUBJECT NAMES
 * ("O:Physics", "A:Law") so the picker can mirror the real past-paper library
 * exactly — the library is name-keyed (O-Level folders carry no code at all),
 * so numeric codes can't represent every subject we actually have. Both forms
 * are read here so existing teachers keep working.
 * ------------------------------------------------------------------------- */

function normSubjectName(s: string): string {
  return s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\d+/g, " ").replace(/[^a-z]+/g, " ").trim();
}

/** Build a level-qualified token for a (level, subject) pair. */
export function teacherSubjectToken(level: SyllabusLevel, subject: string): string {
  return `${level}:${subject.trim()}`;
}

/** Parse a stored token: a new "O:Physics", a legacy numeric code, or a bare name. */
export function parseTeacherSubjectToken(token: string): { subject: string; level?: SyllabusLevel } {
  const t = (token ?? "").trim();
  const m = /^([OA]):(.+)$/.exec(t);
  if (m) return { level: m[1] as SyllabusLevel, subject: m[2].trim() };
  const byCode = syllabusByCode(t);
  if (byCode) return { level: byCode.level, subject: byCode.subject };
  return { subject: t };
}

/** Display name for a stored token (strips the level prefix / resolves a code). */
export function teacherSubjectLabel(token: string): string {
  return parseTeacherSubjectToken(token).subject || token;
}

/** The subject names a teacher may use at a given level (reads tokens + legacy codes). */
export function teacherSubjectsForLevel(tokens: string[], level: SyllabusLevel): string[] {
  const out = new Set<string>();
  for (const t of tokens ?? []) {
    const p = parseTeacherSubjectToken(t);
    if (!p.level || p.level === level) out.add(p.subject);
  }
  return Array.from(out);
}

/** Upgrade any legacy numeric codes in a stored list to level-qualified tokens. */
export function normalizeTeacherSubjectTokens(tokens: string[]): string[] {
  const out: string[] = [];
  for (const t of tokens ?? []) {
    const p = parseTeacherSubjectToken(t);
    out.push(p.level ? teacherSubjectToken(p.level, p.subject) : p.subject);
  }
  return Array.from(new Set(out));
}

/** A standard Cambridge code for a subject at a level, if one exists (else null). */
export function standardCodeForSubject(subject: string, level: SyllabusLevel): string | null {
  const n = normSubjectName(subject);
  const hit = syllabusesForLevel(level).find((s) => normSubjectName(s.subject) === n);
  return hit?.code ?? null;
}

export const EXAM_SERIES = ["March", "June", "November"] as const;
export type ExamSeries = (typeof EXAM_SERIES)[number];
