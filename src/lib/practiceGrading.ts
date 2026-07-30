/* ============================================================
   PROPEL — Practice paper AI marking client
   Sends the loaded questions (which already carry their marking
   schemes) plus the student's answers to /practice-grading/grade,
   and turns the returned report into a downloadable document.
   ============================================================ */

import { PracticeProgress, PracticeReport, GradedQuestion, SolveMode, prettyPaperName } from "./practiceProgress";

export type { PracticeReport, GradedQuestion };

type GetTokenFn = () => Promise<string | null>;

export interface GradeQuestionInput {
  id: string;
  questionNumber: string;
  type: "mcq" | "structured";
  questionText: string;
  maxMarks: number;
  correctOption?: string | null;
  markingScheme?: string | null;
  parts?: { label: string; body: string; marks: number | null; answer: string | null }[];
  studentOption?: string | null;
  studentParts?: Record<string, string>;
  studentAnswer?: string | null;
}

export interface GradeRequest {
  paperKey: string;
  subject: string;
  year: string;
  session: string;
  paper: string;
  variant: string;
  isMcq: boolean;
  solveMode: SolveMode;
  questions: GradeQuestionInput[];
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

export async function gradePractice(
  request: GradeRequest,
  getToken?: GetTokenFn,
): Promise<{ report: PracticeReport; item: PracticeProgress }> {
  const token = getToken ? await getToken() : null;
  const response = await fetch(`${apiBase()}/practice-grading/grade`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Grading failed. Please try again.");
  }
  return (await response.json()) as { report: PracticeReport; item: PracticeProgress };
}

export async function gradeOneQuestion(
  subject: string,
  question: GradeQuestionInput,
  getToken?: GetTokenFn,
): Promise<GradedQuestion> {
  const token = getToken ? await getToken() : null;
  const response = await fetch(`${apiBase()}/practice-grading/grade-one`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ subject, question }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Grading failed. Please try again.");
  }
  const data = (await response.json()) as { result: GradedQuestion };
  return data.result;
}

/** Grade one topic-drill question from a photo of a handwritten answer. */
export async function gradeOneImage(
  subject: string,
  question: GradeQuestionInput,
  file: File,
  getToken?: GetTokenFn,
): Promise<GradedQuestion> {
  const token = getToken ? await getToken() : null;
  const body = new FormData();
  body.append("subject", subject);
  body.append("question", JSON.stringify(question));
  body.append("file", file, file.name);
  const response = await fetch(`${apiBase()}/practice-grading/grade-one-image`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Grading failed. Please try again.");
  }
  const data = (await response.json()) as { result: GradedQuestion };
  return data.result;
}

export function verdictColor(verdict: GradedQuestion["verdict"]): { fg: string; bg: string; label: string } {
  switch (verdict) {
    case "correct": return { fg: "var(--teal-deep)", bg: "var(--teal-soft)", label: "Correct" };
    case "partial": return { fg: "var(--amber-deep)", bg: "var(--amber-soft)", label: "Partial" };
    case "unanswered": return { fg: "var(--ink-faint)", bg: "var(--surface-2)", label: "Not answered" };
    default: return { fg: "var(--coral-bright)", bg: "var(--coral-soft)", label: "Needs work" };
  }
}

/* ---------------- downloadable report ---------------- */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Build a self-contained, printable HTML report and download it. */
export function downloadReport(
  report: PracticeReport,
  meta: Pick<PracticeProgress, "subject" | "year" | "session" | "paper" | "variant">,
): void {
  const title = prettyPaperName(meta);
  const gradedDate = new Date(report.gradedAt || Date.now()).toLocaleString();
  const pill = (v: GradedQuestion["verdict"]) => {
    const map: Record<GradedQuestion["verdict"], [string, string, string]> = {
      correct: ["#0f7a5e", "#e6f6f0", "Correct"],
      partial: ["#9a6a00", "#fbf1d9", "Partial"],
      weak: ["#b02a1a", "#fbe6e2", "Needs work"],
      unanswered: ["#6b6b6b", "#efece8", "Not answered"],
    };
    const [fg, bg, label] = map[v];
    return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:600;color:${fg};background:${bg}">${label}</span>`;
  };
  const schemeTag = (q: GradedQuestion) =>
    q.gradingSource === "deterministic"
      ? ""
      : q.schemeUsed
        ? `<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:99px;font-size:11px;font-weight:600;color:#0f7a5e;background:#e6f6f0">✓ Mark scheme</span>`
        : `<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:99px;font-size:11px;font-weight:600;color:#6b5f57;background:#efece8">Examiner judgement</span>`;
  const norm = (value: string) => value.trim().toLowerCase();
  const keyOf = (list: string[]) => list.map(norm).filter(Boolean).sort().join("|");
  const pointsHtml = (q: GradedQuestion) => {
    const missing = q.missingPoints ?? [];
    const expected = q.expectedPoints ?? [];
    // When a ~0 answer makes both lists identical, show a single block (fix B).
    if (missing.length > 0 && keyOf(missing) === keyOf(expected)) {
      return `<div style="margin-top:6px;font-size:13px;color:#9a3b2a"><b>Key points you needed:</b> ${expected.map(escapeHtml).join("; ")}</div>`;
    }
    return `${missing.length ? `<div style="margin-top:6px;font-size:13px;color:#9a3b2a"><b>Improve:</b> ${missing.map(escapeHtml).join("; ")}</div>` : ""}${expected.length ? `<div style="margin-top:4px;font-size:13px;color:#3a3a3a"><b>Key points:</b> ${expected.map(escapeHtml).join("; ")}</div>` : ""}`;
  };
  const rows = report.perQuestion.map((q) => `
    <tr>
      <td style="font-weight:600;white-space:nowrap">Q${escapeHtml(q.questionNumber)}</td>
      <td style="font-weight:700;white-space:nowrap">${q.earned} / ${q.max}</td>
      <td style="white-space:nowrap">${pill(q.verdict)}${schemeTag(q)}</td>
      <td>
        <div>${escapeHtml(q.feedback)}</div>
        ${pointsHtml(q)}
      </td>
    </tr>`).join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Marking report — ${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1c1714;margin:0;background:#faf6f0;padding:32px}
  .wrap{max-width:900px;margin:0 auto;background:#fff;border:1px solid #eadfd4;border-radius:16px;overflow:hidden}
  .head{padding:28px 32px;background:linear-gradient(135deg,#a8123c,#760b28);color:#fff}
  .head h1{margin:0 0 4px;font-size:22px}
  .head .sub{opacity:.85;font-size:14px}
  .score{display:flex;gap:28px;flex-wrap:wrap;padding:24px 32px;border-bottom:1px solid #eee;align-items:center}
  .score .big{font-size:44px;font-weight:800;color:#a8123c;line-height:1}
  .score .grade{font-size:18px;font-weight:700}
  .muted{color:#6b5f57;font-size:13px}
  .summary{padding:20px 32px;font-size:15px;line-height:1.6;border-bottom:1px solid #eee}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:12px 32px;vertical-align:top;font-size:14px;border-bottom:1px solid #f0eae3}
  th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#8a7d73;background:#faf6f0}
  .foot{padding:16px 32px;font-size:12px;color:#8a7d73}
  ul{margin:6px 0 0;padding-left:18px}
  @media print{body{background:#fff;padding:0}.wrap{border:none}}
</style></head>
<body><div class="wrap">
  <div class="head">
    <h1>${escapeHtml(title)}</h1>
    <div class="sub">Marking report · ${report.solveMode === "handwritten" ? "Handwritten attempt" : "Digital attempt"} · ${escapeHtml(gradedDate)}</div>
  </div>
  <div class="score">
    <div><div class="big">${report.earned} / ${report.total}</div><div class="muted">total marks</div></div>
    <div><div class="grade">${report.percent}%</div><div class="muted">${escapeHtml(report.grade)}</div></div>
  </div>
  <div class="summary"><b>Examiner summary.</b> ${escapeHtml(report.summary)}
    ${report.improvements.length ? `<div style="margin-top:10px"><b>Focus next on:</b><ul>${report.improvements.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul></div>` : ""}
  </div>
  <table>
    <thead><tr><th>Q</th><th>Marks</th><th>Verdict</th><th>Feedback</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="foot">Graded by Propel with ${escapeHtml(report.model)}. Grades are indicative and for practice guidance only.</div>
</div></body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const safe = title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const link = document.createElement("a");
  link.href = url;
  link.download = `Propel-report-${safe}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
