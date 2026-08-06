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

export const EXAM_SERIES = ["March", "June", "November"] as const;
export type ExamSeries = (typeof EXAM_SERIES)[number];
