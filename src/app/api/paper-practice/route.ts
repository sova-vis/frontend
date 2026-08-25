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
  sources: DbSource[] | null;
  source_note: string | null;
  dedup_group: string | null;
};

type DbSource = {
  label?: string | null;
  reference?: string | null;
  translation?: string | null;
  text?: string | null;
  image?: { data_url?: string; url?: string; width?: number | null; height?: number | null } | null;
  arabic_image?: { data_url?: string; width?: number | null; height?: number | null } | null;
};

const QUESTION_COLUMNS =
  "id,question_id,subject,type,exam_year,session,paper,variant,question_number,topic,theme,question_text,marks,options,correct_option,marking_scheme,requires_diagram,images,reference,sources,source_note,dedup_group";

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

// Leading OCR/import artifacts seen at the start of stems and answers:
//   "DFD,, ..."  "DFDDFD,,,, ..."  ",, ..."  ":: ..."
// The "DFD" marker is only stripped when it precedes repeated punctuation, so a
// legitimate "DFD represents a data flow…" (Computer Science) is never touched.
function stripLeadingOcrNoise(value: string): string {
  return value
    .replace(/^\s*(?:DFD)+\s*(?=[,.;:]{2,})/i, "")
    .replace(/^\s*[,.;:]{2,}\s*/, "")
    .trimStart();
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return stripLeadingOcrNoise(value)
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
async function fetchMetaRows(supabase: SupabaseClient, level: string) {
  // Aggregate in the database (grouped counts) rather than streaming every row.
  // The A-Level bank is ~56k rows — pulling them all to the API (even paged /
  // parallelised) took ~10s and surfaced as "failed to fetch" / a practice page
  // that never opened. The `paper_practice_meta` RPC (backed by an index on
  // level,subject,type,exam_year,variant,topic) returns a few thousand grouped
  // rows in <1s.
  const { data, error } = await supabase.rpc("paper_practice_meta", { p_level: level });
  if (error) throw error;
  type RpcRow = { subject: string; qtype: string; exam_year: number; variant: string | null; topic: string | null; n: number };
  return ((data as RpcRow[]) || []).map((r) => ({
    subject: r.subject,
    type: (r.qtype === "mcq" ? "mcq" : "structured") as QuestionType,
    exam_year: r.exam_year,
    variant: r.variant,
    topic: r.topic,
    count: Number(r.n) || 0,
  }));
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
    const n = row.count;   // grouped count from the RPC

    bucket.total += n;
    bucket.years.set(year, (bucket.years.get(year) ?? 0) + n);
    if (variant) bucket.variants.set(variant, (bucket.variants.get(variant) ?? 0) + n);
    bucket.topics.set(topic, (bucket.topics.get(topic) ?? 0) + n);

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
// Metadata cache — the subject/topic aggregate below is an expensive full-table
// scan, but it only changes when the question bank is re-ingested. Cache it
// briefly in memory (per warm server instance) so the practice page's first
// paint is fast, and let the browser reuse the response for a couple of minutes.
// ---------------------------------------------------------------------------
const META_TTL_MS = 5 * 60 * 1000;
const META_CACHE_HEADERS = { "Cache-Control": "private, max-age=120, stale-while-revalidate=600" };
const metaCacheByLevel = new Map<string, { at: number; subjects: ReturnType<typeof buildSubjectMeta> }>();

async function getSubjectsMeta(supabase: SupabaseClient, level: string) {
  const cached = metaCacheByLevel.get(level);
  if (cached && Date.now() - cached.at < META_TTL_MS) return cached.subjects;
  const subjects = buildSubjectMeta(await fetchMetaRows(supabase, level));
  metaCacheByLevel.set(level, { at: Date.now(), subjects });
  return subjects;
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

// Passage-style sources (Islamiyat ayats: translation + Arabic image) that the
// student reads. Text-only sources (Pakistan Studies, already inlined into the
// question text) are dropped so they don't render twice.
function normalizeSources(sources: DbSource[] | null) {
  if (!Array.isArray(sources)) return [];
  return sources
    .map((source) => {
      const image = source.image || source.arabic_image || null;
      const src = image && (image.data_url || (image as { url?: string }).url) ? image.data_url || (image as { url?: string }).url : null;
      const translation = cleanText(source.translation);
      if (!translation && !src) return null;
      return {
        label: cleanText(source.label) || null,
        reference: cleanText(source.reference) || null,
        translation: translation || null,
        image: src ? { src, width: image?.width ?? null, height: image?.height ?? null } : null,
      };
    })
    .filter((source): source is NonNullable<typeof source> => source !== null);
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
    // Stable DB uuid (public.questions.id) — used by the teacher portal to
    // reference a question in an assignment. Additive; the practice UI ignores it.
    uid: question.id,
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
    sources: normalizeSources(question.sources),
    sourceNote: cleanText(question.source_note) || null,
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
  level: string,
) {
  let query = supabase
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("level", level)
    .ilike("subject", subject)
    .eq("type", type)
    .eq("exam_year", year)
    .order("session", { ascending: true })
    .order("paper", { ascending: true })
    .order("variant", { ascending: true })
    .order("question_number", { ascending: true });

  if (variant && variant.toLowerCase() !== "all") query = query.eq("variant", variant);
  if (topic && topic.toLowerCase() !== "all") {
    query = topic.toLowerCase() === "uncategorised" ? query.or("topic.is.null,topic.eq.Uncategorised") : query.eq("topic", topic);
  }

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
  level: string,
) {
  let scan = supabase
    .from("questions")
    .select("id,dedup_group,question_id,exam_year,question_number")
    .eq("level", level)
    .ilike("subject", subject)
    .eq("type", type)
    .order("exam_year", { ascending: false })
    .order("question_number", { ascending: true })
    .range(0, 9999);

  if (topic && topic.toLowerCase() !== "all") {
    scan = topic.toLowerCase() === "uncategorised" ? scan.or("topic.is.null,topic.eq.Uncategorised") : scan.eq("topic", topic);
  }

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
// The "load a whole paper" picker. Built by grouping the questions table for
// this subject + LEVEL, so O-Level and A-Level papers never mix (the
// available_papers view is level-agnostic and would return the wrong paper for
// an A-Level class whose subject name also exists at O-Level).
// ---------------------------------------------------------------------------
async function fetchAvailablePapers(
  supabase: SupabaseClient,
  subject: string,
  type: QuestionType | null,
  year: number | null,
  level: string,
) {
  const rows: Array<{ exam_year: number; session: string | null; paper: string | null; variant: string | null; type: QuestionType }> = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let query = supabase
      .from("questions")
      .select("exam_year,session,paper,variant,type")
      .eq("level", level)
      .ilike("subject", subject)
      .order("question_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (year) query = query.eq("exam_year", year);
    if (type) query = query.eq("type", type);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as typeof rows));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const groups = new Map<string, { year: number; session: string; paper: string; variant: string; count: number; isMcq: boolean }>();
  for (const r of rows) {
    const session = cleanText(r.session);
    const paper = cleanText(r.paper);
    const variant = cleanText(r.variant);
    const key = [r.exam_year, session, paper, variant].join("|");
    const g = groups.get(key) ?? { year: r.exam_year, session, paper, variant, count: 0, isMcq: r.type === "mcq" };
    g.count += 1;
    if (r.type === "mcq") g.isMcq = true;
    groups.set(key, g);
  }

  return Array.from(groups.values())
    .sort((a, b) => b.year - a.year || a.session.localeCompare(b.session) || a.paper.localeCompare(b.paper) || a.variant.localeCompare(b.variant))
    .map((g) => ({
      year: String(g.year),
      session: g.session,
      paper: g.paper,
      variant: g.variant,
      count: g.count,
      isMcq: g.isMcq,
      key: [g.year, g.session, g.paper, g.variant].join("|"),
      label: [g.year, g.session.replace(/_/g, " "), g.paper.replace(/_/g, " "), g.variant.replace(/_/g, " ")].filter(Boolean).join(" · "),
    }));
}

// ---------------------------------------------------------------------------
// One complete ordered paper with parts folded in — LEVEL-filtered directly on
// the questions table (the fetch_paper RPC takes no level and would leak the
// other level's questions for a shared subject name).
// ---------------------------------------------------------------------------
async function fetchWholePaper(
  supabase: SupabaseClient,
  subject: string,
  year: number,
  session: string,
  paper: string,
  variant: string,
  level: string,
) {
  let query = supabase
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("level", level)
    .ilike("subject", subject)
    .eq("exam_year", year)
    .eq("session", session)
    .eq("paper", paper)
    .order("question_number", { ascending: true });
  if (variant && variant.toLowerCase() !== "all") query = query.eq("variant", variant);

  const { data, error } = await query;
  if (error) throw error;
  return withParts(supabase, (data ?? []) as DbQuestion[]);
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
  // Which level's bank to serve (keeps O-Level and A-Level separate). Defaults
  // to olevel so existing/untagged callers see the O-Level content.
  const level = searchParams.get("level") === "alevel" ? "alevel" : "olevel";

  let lastError: unknown = null;

  for (const supabase of supabaseClients) {
    try {
      // ---- Data requests: resolve via ilike, skipping the full metadata scan.
      // The frontend always sends the canonical subject name from the subject list.
      if (rawSubject) {
        // Available-papers picker (available_papers view).
        if (wantPapers) {
          const papers = await fetchAvailablePapers(supabase, rawSubject, typeParam, validYear, level);
          return NextResponse.json({ subject: rawSubject, papers });
        }

        // Topic practice: unique questions for a topic across all years (deduped,
        // paginated so image-heavy subjects stay fast).
        if (mode === "topic" && typeParam && topic) {
          const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "24", 10) || 24, 1), 60);
          const offset = Math.max(Number.parseInt(searchParams.get("offset") || "0", 10) || 0, 0);
          const { questions, total } = await fetchTopicQuestions(supabase, rawSubject, typeParam, topic, limit, offset, level);
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
            level,
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
          const questions = await fetchQuestions(supabase, rawSubject, typeParam, validYear, variant, topic, level);
          return NextResponse.json({ subject: rawSubject, type: typeParam, year: yearParam, questions, total: questions.length });
        }
      }

      // ---- Metadata requests: aggregate the bank for this level (subjects list).
      const subjects = await getSubjectsMeta(supabase, level);
      if (!rawSubject) {
        return NextResponse.json({ subjects }, { headers: META_CACHE_HEADERS });
      }
      const subjectMeta = subjects.find((s) => s.name.toLowerCase() === rawSubject.toLowerCase());
      if (!subjectMeta) {
        return NextResponse.json({ error: "Subject not found." }, { status: 404 });
      }
      return NextResponse.json({ subject: subjectMeta }, { headers: META_CACHE_HEADERS });
    } catch (error) {
      lastError = error;
      console.warn("Paper practice Supabase client failed:", error);
    }
  }

  console.error("Paper practice API error:", lastError);
  return NextResponse.json({ error: "Unable to load paper practice data." }, { status: 500 });
}
