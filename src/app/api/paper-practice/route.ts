import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Next.js patches global fetch with an on-disk Data Cache. supabase-js uses fetch,
// so without this every query would be cached and serve stale rows after a re-ingest.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

/**
 * Paper Practice API — schema v2 (subject-agnostic).
 *
 *   GET /api/paper-practice
 *     -> { subjects: SubjectMeta[] }
 *
 *   GET /api/paper-practice?subject=Physics
 *     -> { subject: SubjectMeta }   (years/variants/topics per type, for the dropdowns)
 *
 *   GET /api/paper-practice?subject=Physics&type=mcq|structured&year=2024
 *       [&variant=Variant_1][&topic=Waves]
 *     -> { subject, type, year, questions: PracticeQuestion[], total }
 *
 * Tables: public.questions (type 'mcq'|'structured'), public.question_parts, public.topics.
 */

type QuestionType = "mcq" | "structured";

type TopicMap = Map<string, number>;

type TypeMeta = {
  total: number;
  years: { year: string; count: number }[];
  variants: { variant: string; count: number }[];
  topics: { name: string; count: number }[];
};

type DbPart = {
  question_uid: string;
  label: string | null;
  order_index: number;
  body: string | null;
  marks: number | null;
  answer: string | null;
};

type DbImage = {
  role?: string;
  caption?: string;
  alt?: string;
  width?: number | null;
  height?: number | null;
  embedded?: boolean;
  data_url?: string;
  public_url?: string;
  url?: string;
  storage_path?: string;
  option?: string;
};

type DbQuestion = {
  id: string;
  question_id: string;
  subject: string;
  type: QuestionType;
  exam_year: number;
  session: string | null;
  paper: string | null;
  variant: string | null;
  question_number: number;
  topic: string | null;
  theme: string | null;
  question_text: string | null;
  marks: number | null;
  options: Record<string, unknown> | unknown[] | null;
  correct_option: string | null;
  marking_scheme: string | null;
  requires_diagram: boolean;
  images: DbImage[] | null;
  reference: Record<string, unknown> | null;
  dedup_group: string | null;
};

const QUESTION_COLUMNS =
  "id,question_id,subject,type,exam_year,session,paper,variant,question_number,topic,theme,question_text,marks,options,correct_option,marking_scheme,requires_diagram,images,reference,dedup_group";

function getSupabaseClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const keys = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ].filter((key): key is string => Boolean(key));

  if (!url || keys.length === 0) return [];

  return Array.from(new Set(keys)).map((key) =>
    createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: noStoreFetch },
    }),
  );
}

type SupabaseClient = ReturnType<typeof getSupabaseClients>[number];

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    // strip non-printable control chars (PDF-extraction artifacts), keep tabs and newlines
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function normalizeType(value: string | null): QuestionType | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === "mcq" || v === "mcqs") return "mcq";
  if (v === "structured" || v === "questions" || v === "written" || v === "batch") return "structured";
  return null;
}

function sortYearDesc<T extends { year: string }>(items: T[]) {
  return items.sort((a, b) => Number.parseInt(b.year, 10) - Number.parseInt(a.year, 10));
}

// ---------------------------------------------------------------------------
// Metadata: aggregate counts per subject -> per type -> years/variants/topics.
// ---------------------------------------------------------------------------
async function fetchMetaRows(supabase: SupabaseClient) {
  const rows: Array<{ subject: string; type: QuestionType; exam_year: number; variant: string | null; topic: string | null }> = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("questions")
      .select("subject,type,exam_year,variant,topic")
      // order by a UNIQUE column so range pagination never overlaps/skips rows
      .order("question_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as typeof rows));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function buildSubjectMeta(rows: Awaited<ReturnType<typeof fetchMetaRows>>) {
  type Acc = {
    name: string;
    types: Record<QuestionType, { total: number; years: TopicMap; variants: TopicMap; topics: TopicMap }>;
  };

  const subjects = new Map<string, Acc>();

  for (const row of rows) {
    const subject =
      subjects.get(row.subject) ?? {
        name: row.subject,
        types: {
          mcq: { total: 0, years: new Map(), variants: new Map(), topics: new Map() },
          structured: { total: 0, years: new Map(), variants: new Map(), topics: new Map() },
        },
      };

    const bucket = subject.types[row.type];
    const year = String(row.exam_year);
    const variant = cleanText(row.variant);
    const topic = cleanText(row.topic) || "Uncategorised";

    bucket.total += 1;
    bucket.years.set(year, (bucket.years.get(year) ?? 0) + 1);
    if (variant) bucket.variants.set(variant, (bucket.variants.get(variant) ?? 0) + 1);
    bucket.topics.set(topic, (bucket.topics.get(topic) ?? 0) + 1);

    subjects.set(row.subject, subject);
  }

  const finalizeType = (t: { total: number; years: TopicMap; variants: TopicMap; topics: TopicMap }): TypeMeta => ({
    total: t.total,
    years: sortYearDesc(Array.from(t.years, ([year, count]) => ({ year, count }))),
    variants: Array.from(t.variants, ([variant, count]) => ({ variant, count })).sort((a, b) =>
      a.variant.localeCompare(b.variant, undefined, { numeric: true }),
    ),
    topics: Array.from(t.topics, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
  });

  return Array.from(subjects.values())
    .map((subject) => ({
      name: subject.name,
      types: {
        mcq: finalizeType(subject.types.mcq),
        structured: finalizeType(subject.types.structured),
      },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Question normalization for the client.
// ---------------------------------------------------------------------------
function imageSrc(image: DbImage) {
  return image.data_url || image.public_url || image.url || image.storage_path || null;
}

function normalizeImages(images: DbImage[] | null, questionNumber: number) {
  if (!Array.isArray(images)) return [];
  return images
    .map((image, index) => ({
      role: image.role ?? "figure",
      option: image.option ?? null,
      src: imageSrc(image),
      alt: cleanText(image.alt) || cleanText(image.caption) || `Question ${questionNumber} figure ${index + 1}`,
      caption: cleanText(image.caption) || null,
      width: image.width ?? null,
      height: image.height ?? null,
    }))
    .filter((image) => image.src);
}

function normalizeOptions(options: DbQuestion["options"]) {
  if (!options) return [] as { label: string; text: string }[];

  if (Array.isArray(options)) {
    return options
      .map((item, index) => {
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          return {
            label: cleanText(o.label ?? o.option ?? String.fromCharCode(65 + index)).toUpperCase(),
            text: cleanText(o.text ?? o.value ?? ""),
          };
        }
        return { label: String.fromCharCode(65 + index), text: cleanText(item) };
      })
      .filter((o) => o.label && o.text);
  }

  return Object.entries(options as Record<string, unknown>)
    .map(([label, text]) => ({ label: label.toUpperCase(), text: cleanText(text) }))
    .filter((o) => o.label && o.text)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function normalizeQuestion(question: DbQuestion, parts: DbPart[]) {
  return {
    id: question.question_id || question.id,
    subject: question.subject,
    type: question.type,
    year: String(question.exam_year),
    session: cleanText(question.session),
    paper: cleanText(question.paper),
    variant: cleanText(question.variant),
    questionNumber: String(question.question_number ?? ""),
    topic: cleanText(question.topic),
    theme: cleanText(question.theme),
    questionText: cleanText(question.question_text),
    marks: question.marks ?? null,
    options: question.type === "mcq" ? normalizeOptions(question.options) : [],
    correctOption: cleanText(question.correct_option).toUpperCase() || null,
    markingScheme: cleanText(question.marking_scheme),
    requiresDiagram: Boolean(question.requires_diagram),
    images: normalizeImages(question.images, question.question_number),
    reference: question.reference ?? null,
    dedupGroup: question.dedup_group ?? null,
    parts: parts
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((part) => ({
        label: cleanText(part.label),
        body: cleanText(part.body),
        marks: part.marks ?? null,
        answer: cleanText(part.answer) || null,
      })),
  };
}

// Fetch + fold in parts for any set of structured questions, then normalize.
async function withParts(supabase: SupabaseClient, questions: DbQuestion[]) {
  const partsByUid = new Map<string, DbPart[]>();
  const structuredUids = questions.filter((q) => q.type === "structured").map((q) => q.id);

  if (structuredUids.length > 0) {
    const { data: partData, error: partError } = await supabase
      .from("question_parts")
      .select("question_uid,label,order_index,body,marks,answer")
      .in("question_uid", structuredUids)
      .order("order_index", { ascending: true });
    if (partError) throw partError;
    for (const part of (partData ?? []) as DbPart[]) {
      const list = partsByUid.get(part.question_uid) ?? [];
      list.push(part);
      partsByUid.set(part.question_uid, list);
    }
  }

  return questions.map((question) => normalizeQuestion(question, partsByUid.get(question.id) ?? []));
}

async function fetchQuestions(
  supabase: SupabaseClient,
  subject: string,
  type: QuestionType,
  year: number,
  variant: string | null,
  topic: string | null,
) {
  let query = supabase
    .from("questions")
    .select(QUESTION_COLUMNS)
    .ilike("subject", subject)
    .eq("type", type)
    .eq("exam_year", year)
    .order("session", { ascending: true })
    .order("paper", { ascending: true })
    .order("variant", { ascending: true })
    .order("question_number", { ascending: true });

  if (variant && variant.toLowerCase() !== "all") query = query.eq("variant", variant);
  if (topic && topic.toLowerCase() !== "all") query = query.eq("topic", topic);

  const { data, error } = await query;
  if (error) throw error;

  return withParts(supabase, (data ?? []) as DbQuestion[]);
}

// Topic view: every UNIQUE question for a subject+type+topic across ALL years,
// deduped on dedup_group (keeps the most recent year's copy as representative).
//
// Two-phase to stay under the DB statement timeout: image-heavy subjects (e.g.
// Mathematics carries a question image + an answer image per question) blow the
// timeout if every matching row's base64 is read just to be deduped away. So we
// first scan lightweight columns to choose representatives, then fetch the full
// rows (with images) only for those, in chunks.
async function fetchTopicQuestions(
  supabase: SupabaseClient,
  subject: string,
  type: QuestionType,
  topic: string,
  limit: number,
  offset: number,
) {
  let scan = supabase
    .from("questions")
    .select("id,dedup_group,question_id,exam_year,question_number")
    .ilike("subject", subject)
    .eq("type", type)
    .order("exam_year", { ascending: false })
    .order("question_number", { ascending: true })
    .range(0, 9999);

  if (topic && topic.toLowerCase() !== "all") scan = scan.eq("topic", topic);

  const { data: lite, error: scanError } = await scan;
  if (scanError) throw scanError;

  const seen = new Set<string>();
  const repIds: string[] = [];
  for (const row of (lite ?? []) as Array<{ id: string; dedup_group: string | null; question_id: string }>) {
    const key = row.dedup_group || row.question_id;
    if (seen.has(key)) continue;
    seen.add(key);
    repIds.push(row.id);
  }

  const total = repIds.length;
  const pageIds = repIds.slice(offset, offset + limit);
  if (pageIds.length === 0) return { questions: [], total };

  const rank = new Map(pageIds.map((id, index) => [id, index]));
  const chunkSize = 40;
  const rows: DbQuestion[] = [];
  for (let i = 0; i < pageIds.length; i += chunkSize) {
    const { data, error } = await supabase.from("questions").select(QUESTION_COLUMNS).in("id", pageIds.slice(i, i + chunkSize));
    if (error) throw error;
    rows.push(...((data ?? []) as DbQuestion[]));
  }

  rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  return { questions: await withParts(supabase, rows), total };
}

// ---------------------------------------------------------------------------
// available_papers view -> the "load a whole paper" picker.
// ---------------------------------------------------------------------------
async function fetchAvailablePapers(
  supabase: SupabaseClient,
  subject: string,
  type: QuestionType | null,
  year: number | null,
) {
  let query = supabase
    .from("available_papers")
    .select("subject,exam_year,session,paper,variant,question_count,is_mcq")
    .ilike("subject", subject)
    .order("exam_year", { ascending: false })
    .order("session", { ascending: true })
    .order("paper", { ascending: true })
    .order("variant", { ascending: true });

  if (year) query = query.eq("exam_year", year);
  if (type === "mcq") query = query.eq("is_mcq", true);
  if (type === "structured") query = query.eq("is_mcq", false);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    year: String(row.exam_year),
    session: cleanText(row.session),
    paper: cleanText(row.paper),
    variant: cleanText(row.variant),
    count: row.question_count,
    isMcq: Boolean(row.is_mcq),
    key: [row.exam_year, row.session, row.paper, row.variant].join("|"),
    label: [row.exam_year, cleanText(row.session).replace(/_/g, " "), cleanText(row.paper).replace(/_/g, " "), cleanText(row.variant).replace(/_/g, " ")]
      .filter(Boolean)
      .join(" · "),
  }));
}

// ---------------------------------------------------------------------------
// fetch_paper RPC -> one complete ordered paper with parts folded in.
// ---------------------------------------------------------------------------
async function fetchWholePaper(
  supabase: SupabaseClient,
  subject: string,
  year: number,
  session: string,
  paper: string,
  variant: string,
) {
  const { data, error } = await supabase.rpc("fetch_paper", {
    p_subject: subject,
    p_year: year,
    p_session: session,
    p_paper: paper,
    p_variant: variant,
  });
  if (error) throw error;

  const rows = Array.isArray(data) ? (data as Array<DbQuestion & { parts?: DbPart[] }>) : [];
  return rows.map((row) => normalizeQuestion(row, Array.isArray(row.parts) ? row.parts : []));
}

export async function GET(request: Request) {
  const supabaseClients = getSupabaseClients();
  if (supabaseClients.length === 0) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const rawSubject = searchParams.get("subject");
  const typeParam = normalizeType(searchParams.get("type"));
  const yearParam = searchParams.get("year");
  const variant = searchParams.get("variant");
  const topic = searchParams.get("topic");
  const session = searchParams.get("session");
  const paper = searchParams.get("paper");
  const wantPapers = searchParams.get("papers") === "1";
  const mode = searchParams.get("mode");
  const validYear = yearParam && /^\d{4}$/.test(yearParam) ? Number.parseInt(yearParam, 10) : null;

  let lastError: unknown = null;

  for (const supabase of supabaseClients) {
    try {
      // ---- Data requests: resolve via ilike, skipping the full metadata scan.
      // The frontend always sends the canonical subject name from the subject list.
      if (rawSubject) {
        // Available-papers picker (available_papers view).
        if (wantPapers) {
          const papers = await fetchAvailablePapers(supabase, rawSubject, typeParam, validYear);
          return NextResponse.json({ subject: rawSubject, papers });
        }

        // Topic practice: unique questions for a topic across all years (deduped,
        // paginated so image-heavy subjects stay fast).
        if (mode === "topic" && typeParam && topic) {
          const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "24", 10) || 24, 1), 60);
          const offset = Math.max(Number.parseInt(searchParams.get("offset") || "0", 10) || 0, 0);
          const { questions, total } = await fetchTopicQuestions(supabase, rawSubject, typeParam, topic, limit, offset);
          return NextResponse.json({ subject: rawSubject, type: typeParam, topic, questions, total, offset, limit, mode: "topic" });
        }

        // Whole paper via the fetch_paper RPC.
        if (validYear && session && paper) {
          const questions = await fetchWholePaper(
            supabase,
            rawSubject,
            validYear,
            session,
            paper,
            variant && variant.toLowerCase() !== "all" ? variant : "",
          );
          return NextResponse.json({
            subject: rawSubject,
            year: yearParam,
            session,
            paper,
            variant,
            questions,
            total: questions.length,
            mode: "paper",
          });
        }

        // Year + type browse (still available; the two-mode UI uses topic/paper).
        if (typeParam && validYear) {
          const questions = await fetchQuestions(supabase, rawSubject, typeParam, validYear, variant, topic);
          return NextResponse.json({ subject: rawSubject, type: typeParam, year: yearParam, questions, total: questions.length });
        }
      }

      // ---- Metadata requests: aggregate the whole bank (subjects list / dropdowns).
      const subjects = buildSubjectMeta(await fetchMetaRows(supabase));
      if (!rawSubject) {
        return NextResponse.json({ subjects });
      }
      const subjectMeta = subjects.find((s) => s.name.toLowerCase() === rawSubject.toLowerCase());
      if (!subjectMeta) {
        return NextResponse.json({ error: "Subject not found." }, { status: 404 });
      }
      return NextResponse.json({ subject: subjectMeta });
    } catch (error) {
      lastError = error;
      console.warn("Paper practice Supabase client failed:", error);
    }
  }

  console.error("Paper practice API error:", lastError);
  return NextResponse.json({ error: "Unable to load paper practice data." }, { status: 500 });
}
