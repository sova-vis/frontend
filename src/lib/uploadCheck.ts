/* ============================================================
   PROPEL — Upload & Mark client
   Standalone flow: the student uploads photos/PDF of their solved
   work; Grok reads it, marks it, annotates the pages, and returns a
   report + a signed URL to the annotated PDF.
   ============================================================ */

export type PaperType = "topical" | "questions" | "mcqs" | "mixed";

export const PAPER_TYPE_LABEL: Record<PaperType, string> = {
  topical: "Topical",
  questions: "Questions",
  mcqs: "MCQs",
  mixed: "Mixed paper",
};

export interface UploadGradedQuestion {
  questionNumber: string;
  page: number;
  question: string;
  studentAnswer: string;
  verdict: "correct" | "partial" | "weak" | "unanswered";
  earned: number;
  max: number;
  correctAnswer: string;
  corrections: string[];
  suggestions: string[];
  annotation: string;
}

export interface UploadCheckReport {
  subject: string;
  paperType: PaperType;
  earned: number;
  total: number;
  percent: number;
  grade: string;
  summary: string;
  shortcomings: string[];
  suggestions: string[];
  questions: UploadGradedQuestion[];
  pageCount: number;
  model: string;
  gradedAt: string;
}

export interface UploadCheckResult {
  checkId: string;
  report: UploadCheckReport;
  annotatedUrl: string;
}

type GetTokenFn = () => Promise<string | null>;

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

/** Send the uploaded work for marking; resolves to report + annotated PDF url. */
export async function runUploadCheck(
  subject: string,
  paperType: PaperType,
  files: File[],
  getToken?: GetTokenFn,
): Promise<UploadCheckResult> {
  const token = getToken ? await getToken() : null;
  const body = new FormData();
  body.append("subject", subject);
  body.append("paperType", paperType);
  for (const file of files) body.append("files", file, file.name);

  const response = await fetch(`${apiBase()}/upload-check`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Marking failed. Please try again.");
  }
  return (await response.json()) as UploadCheckResult;
}

export async function loadUploadCheckHistory(getToken?: GetTokenFn): Promise<UploadCheckResult[]> {
  const token = getToken ? await getToken() : null;
  if (!token) return [];
  try {
    const response = await fetch(`${apiBase()}/upload-check/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { items?: UploadCheckResult[] };
    return Array.isArray(payload.items) ? payload.items : [];
  } catch {
    return [];
  }
}

export function verdictTone(verdict: UploadGradedQuestion["verdict"]): { fg: string; bg: string; label: string } {
  switch (verdict) {
    case "correct": return { fg: "var(--teal-deep)", bg: "var(--teal-soft)", label: "Correct" };
    case "partial": return { fg: "var(--amber-deep)", bg: "var(--amber-soft)", label: "Partial" };
    case "unanswered": return { fg: "var(--ink-faint)", bg: "var(--surface-2)", label: "Not answered" };
    default: return { fg: "var(--coral-bright)", bg: "var(--coral-soft)", label: "Needs work" };
  }
}

/* ---------------- downloadable HTML report ---------------- */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function downloadUploadReport(report: UploadCheckReport): void {
  const title = `${report.subject} · ${PAPER_TYPE_LABEL[report.paperType]}`;
  const gradedDate = new Date(report.gradedAt || Date.now()).toLocaleString();
  const pill = (v: UploadGradedQuestion["verdict"]) => {
    const map: Record<UploadGradedQuestion["verdict"], [string, string, string]> = {
      correct: ["#0f7a5e", "#e6f6f0", "Correct"],
      partial: ["#9a6a00", "#fbf1d9", "Partial"],
      weak: ["#b02a1a", "#fbe6e2", "Needs work"],
      unanswered: ["#6b6b6b", "#efece8", "Not answered"],
    };
    const [fg, bg, label] = map[v];
    return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:600;color:${fg};background:${bg}">${label}</span>`;
  };
  const rows = report.questions.map((q) => `
    <tr>
      <td style="font-weight:600;white-space:nowrap">Q${escapeHtml(q.questionNumber)}<div style="font-size:11px;color:#8a7d73">p${q.page}</div></td>
      <td style="font-weight:700;white-space:nowrap">${q.earned} / ${q.max}</td>
      <td>${pill(q.verdict)}</td>
      <td>
        ${q.question ? `<div style="font-weight:600">${escapeHtml(q.question)}</div>` : ""}
        ${q.correctAnswer ? `<div style="margin-top:4px;font-size:13px;color:#0f7a5e"><b>Expected:</b> ${escapeHtml(q.correctAnswer)}</div>` : ""}
        ${q.corrections.length ? `<div style="margin-top:4px;font-size:13px;color:#9a3b2a"><b>Corrections:</b> ${q.corrections.map(escapeHtml).join("; ")}</div>` : ""}
        ${q.suggestions.length ? `<div style="margin-top:4px;font-size:13px;color:#3a3a3a"><b>Suggestions:</b> ${q.suggestions.map(escapeHtml).join("; ")}</div>` : ""}
      </td>
    </tr>`).join("");

  const list = (items: string[]) => items.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Marking report — ${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1c1714;margin:0;background:#faf6f0;padding:32px}
  .wrap{max-width:900px;margin:0 auto;background:#fff;border:1px solid #eadfd4;border-radius:16px;overflow:hidden}
  .head{padding:28px 32px;background:linear-gradient(135deg,#a8123c,#760b28);color:#fff}
  .head h1{margin:0 0 4px;font-size:22px}.head .sub{opacity:.85;font-size:14px}
  .score{display:flex;gap:28px;flex-wrap:wrap;padding:24px 32px;border-bottom:1px solid #eee;align-items:center}
  .score .big{font-size:44px;font-weight:800;color:#a8123c;line-height:1}.score .grade{font-size:18px;font-weight:700}
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
  <div class="head"><h1>${escapeHtml(title)}</h1><div class="sub">Marking report · ${escapeHtml(gradedDate)}</div></div>
  <div class="score">
    <div><div class="big">${report.earned} / ${report.total}</div><div class="muted">total marks</div></div>
    <div><div class="grade">${report.percent}%</div><div class="muted">${escapeHtml(report.grade)}</div></div>
  </div>
  <div class="summary"><b>Examiner summary.</b> ${escapeHtml(report.summary)}
    ${report.shortcomings.length ? `<div style="margin-top:10px"><b>Where you lost marks:</b><ul>${list(report.shortcomings)}</ul></div>` : ""}
    ${report.suggestions.length ? `<div style="margin-top:10px"><b>How to improve:</b><ul>${list(report.suggestions)}</ul></div>` : ""}
  </div>
  <table><thead><tr><th>Q</th><th>Marks</th><th>Verdict</th><th>Feedback</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="foot">Marked by Propel with ${escapeHtml(report.model)}. Indicative marks for practice guidance only.</div>
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
