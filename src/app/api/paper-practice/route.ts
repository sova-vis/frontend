import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { access, readdir, readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

type RawImage = {
  role?: string;
  position?: string;
  path?: string;
  alt?: string;
  exists?: boolean;
  data_url?: string;
  public_url?: string;
  url?: string;
  storage_path?: string;
  embedded?: boolean;
  option?: string;
};

type ImageDimensions = {
  width: number;
  height: number;
};

type RawQuestion = {
  subject?: string;
  year?: string;
  session?: string;
  paper?: string;
  variant?: string;
  question_number?: string;
  sub_question?: string | null;
  marks?: number;
  topic_syllabus?: string | null;
  topic_general?: string | null;
  question_text?: string;
  marking_scheme?: string | null;
  correct_option?: string | null;
  requires_diagram?: boolean;
  images?: RawImage[];
  syllabus_ref?: Record<string, unknown> | null;
  reference?: Record<string, unknown> | null;
  options?: unknown;
};

type DbQuestion = {
  id: string;
  subject: string;
  subject_slug: string;
  year: number;
  session: string | null;
  paper: string | null;
  variant: string | null;
  question_number: string;
  sub_question: string | null;
  marks: number | null;
  topic_syllabus: string | null;
  topic_general: string | null;
  question_text: string;
  stem: string | null;
  question_kind: string;
  options: PracticeOption[];
  marking_scheme: string | null;
  correct_option: string | null;
  requires_diagram: boolean;
  images: RawImage[];
  syllabus_ref: Record<string, unknown> | null;
  reference: Record<string, unknown> | null;
  source: Record<string, unknown> | null;
};

type PracticeOption = {
  label: string;
  text: string;
};

type YearFile = {
  subject?: string;
  year?: string;
  total_mcqs?: number;
  mcqs?: RawQuestion[];
};

const SUBJECT_ALIASES: Record<string, string> = {
  maths: "Mathematics",
  math: "Mathematics",
  mathematics: "Mathematics",
  chemistry: "Chemistry",
  physics: "Physics",
};

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type PaperPracticeSupabaseClient = NonNullable<ReturnType<typeof getSupabaseClient>>;

async function pathExists(candidate: string) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function getDataRoot() {
  const candidates = [
    path.resolve(process.cwd(), "..", "O_Level_jsons"),
    path.resolve(process.cwd(), "O_Level_jsons"),
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }

  return candidates[0];
}

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeSubjectName(value: string, availableSubjects: string[]) {
  const decoded = decodeURIComponent(value).trim();
  const alias = SUBJECT_ALIASES[decoded.toLowerCase()] ?? decoded;
  return availableSubjects.find((subject) => subject.toLowerCase() === alias.toLowerCase() || slugify(subject) === slugify(alias));
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .replace(/\u00e2\u20ac\u201c/g, "-")
    .replace(/\u00e2\u20ac\u201d/g, "-")
    .replace(/\u00e2\u20ac\u02dc/g, "'")
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac\u0153/g, '"')
    .replace(/\u00e2\u20ac\u009d/g, '"')
    .replace(/\u00e2\u2030\u00a4/g, "<=")
    .replace(/\u00e2\u2030\u00a5/g, ">=")
    .replace(/\u00e2\u0081\u00bb/g, "-")
    .replace(/\u00c2/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function topicName(question: RawQuestion) {
  return cleanText(question.topic_syllabus) || cleanText(question.topic_general) || "Uncategorised";
}

async function getSubjects(dataRoot: string) {
  const entries = await readdir(dataRoot, { withFileTypes: true });
  const subjects: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const mcqDir = path.join(dataRoot, entry.name, "mcqs_by_year");
    if (await pathExists(mcqDir)) subjects.push(entry.name);
  }

  return subjects.sort((a, b) => a.localeCompare(b));
}

async function getYearFiles(dataRoot: string, subject: string) {
  const subjectDir = path.join(dataRoot, subject, "mcqs_by_year");
  const files = await readdir(subjectDir);
  return files
    .filter((file) => /^\d{4}\.json$/.test(file))
    .sort((a, b) => Number.parseInt(b) - Number.parseInt(a));
}

async function loadYearFile(dataRoot: string, subject: string, year: string): Promise<YearFile> {
  const filePath = path.join(dataRoot, subject, "mcqs_by_year", `${year}.json`);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as YearFile;
}

function optionArrayFromUnknown(options: unknown) {
  if (!options) return [];

  if (Array.isArray(options)) {
    return options
      .map((item, index) => {
        if (typeof item === "string") return { label: String.fromCharCode(65 + index), text: cleanText(item) };
        if (item && typeof item === "object") {
          const object = item as Record<string, unknown>;
          return {
            label: cleanText(object.label ?? object.option ?? String.fromCharCode(65 + index)).toUpperCase(),
            text: cleanText(object.text ?? object.value ?? object.answer ?? ""),
          };
        }
        return null;
      })
      .filter((item): item is { label: string; text: string } => Boolean(item?.label && item?.text));
  }

  if (typeof options === "object") {
    return Object.entries(options as Record<string, unknown>)
      .map(([label, text]) => ({ label: label.toUpperCase(), text: cleanText(text) }))
      .filter((item) => /^[A-D]$/.test(item.label) && item.text);
  }

  return [];
}

function parseMcqText(questionText: string, explicitOptions: unknown) {
  const explicit = optionArrayFromUnknown(explicitOptions);
  if (explicit.length >= 2) return { stem: questionText, options: explicit };

  const matches = Array.from(questionText.matchAll(/(?:^|\s)([A-D])\s+(?=\S)/g));

  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const first = matches[i];
    if (first[1] !== "A") continue;

    const sequence = ["A", "B", "C", "D"].map((label, offset) => {
      const match = matches.slice(i + offset).find((candidate) => candidate[1] === label);
      return match ? { label, index: match.index ?? 0, tokenLength: match[0].length } : null;
    });

    if (sequence.some((item) => !item)) continue;

    const positions = sequence as { label: string; index: number; tokenLength: number }[];
    if (!positions.every((item, index) => index === 0 || item.index > positions[index - 1].index)) continue;

    const options = positions.map((position, index) => {
      const start = position.index + position.tokenLength;
      const end = positions[index + 1]?.index ?? questionText.length;
      return {
        label: position.label,
        text: questionText.slice(start, end).trim(),
      };
    });

    if (options.every((option) => option.text.length > 0)) {
      return {
        stem: questionText.slice(0, positions[0].index).trim(),
        options,
      };
    }
  }

  return { stem: questionText, options: [] };
}

function assetUrlFor(image: RawImage) {
  const direct = image.data_url || image.public_url || image.url;
  if (direct) return direct;

  const storagePath = image.storage_path || image.path;
  if (!storagePath) return null;
  if (/^(https?:|data:|\/)/.test(storagePath)) return storagePath;

  const base = process.env.NEXT_PUBLIC_QUESTION_ASSET_BASE_URL;
  return base ? `${base.replace(/\/$/, "")}/${storagePath.replace(/^\/+/, "")}` : null;
}

function dataUrlDimensions(dataUrl?: string): ImageDimensions | null {
  const match = dataUrl?.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!match) return null;

  const buffer = Buffer.from(match[2], "base64");
  const type = match[1].toLowerCase();

  if (type === "png" && buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if ((type === "jpeg" || type === "jpg") && buffer.length > 4) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }

  return null;
}

function imageDisplayMode(image: RawImage, dimensions: ImageDimensions | null) {
  const descriptor = [image.role, image.position, image.path, image.storage_path, image.alt].filter(Boolean).join(" ").toLowerCase();
  const labelledAsPage = /\b(full[-_\s]?page|source[-_\s]?page|paper[-_\s]?page|page[-_\s]?\d+|scan)\b/.test(descriptor);
  const labelledAsDiagram = /\b(diagram|figure|graph|option|stem)\b/.test(descriptor);
  const looksLikePortraitPage = Boolean(dimensions && dimensions.width >= 650 && dimensions.height >= 900 && dimensions.height / dimensions.width > 1.15);

  if ((labelledAsPage && !labelledAsDiagram) || looksLikePortraitPage) {
    return "source-page";
  }

  return "diagram";
}

function normalizeImageRecord(image: RawImage, question: { question_number?: string | null }, index: number) {
  const dimensions = dataUrlDimensions(image.data_url);
  const displayMode = imageDisplayMode(image, dimensions);

  return {
    role: image.role ?? "stem",
    position: image.position ?? "after_question_text",
    option: image.option,
    path: image.path ?? image.storage_path ?? null,
    src: assetUrlFor(image),
    alt: cleanText(image.alt) || `Question ${question.question_number ?? index + 1} image`,
    exists: image.exists ?? Boolean(image.data_url || image.public_url || image.url),
    embedded: Boolean(image.embedded || image.data_url),
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    displayMode,
    warning: displayMode === "source-page" ? "This image looks like a full source page and may include nearby questions." : null,
  };
}

function looseToken(value: unknown) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function imageMatchesQuestion(image: RawImage, question: { year?: number | string | null; session?: string | null; paper?: string | null; variant?: string | null }) {
  if (image.data_url) return true;

  const imagePath = image.path || image.storage_path || "";
  if (!imagePath) return true;

  const normalizedPath = imagePath.toLowerCase();
  const pathToken = looseToken(imagePath);
  const year = question.year ? String(question.year) : "";
  const paper = looseToken(question.paper);
  const variant = looseToken(question.variant);

  if (year && /\b(?:19|20)\d{2}\b/.test(normalizedPath) && !normalizedPath.includes(year)) {
    return false;
  }

  if (paper && /paper\d+/.test(pathToken) && !pathToken.includes(paper)) {
    return false;
  }

  if (variant && /variant\d+/.test(pathToken) && !pathToken.includes(variant)) {
    return false;
  }

  return true;
}

function normalizeQuestion(question: RawQuestion, subject: string, fallbackYear: string, index: number) {
  const text = cleanText(question.question_text);
  const parsed = parseMcqText(text, question.options);
  const images = Array.isArray(question.images) ? question.images : [];
  const normalizedImages = images
    .map((image) => normalizeImageRecord(image, question, index))
    .filter((image) => image.src);

  return {
    id: [
      subject,
      question.year ?? fallbackYear,
      question.session,
      question.paper,
      question.variant,
      question.question_number,
      question.sub_question,
      index,
    ].filter(Boolean).join("-"),
    subject,
    year: cleanText(question.year) || fallbackYear,
    session: cleanText(question.session),
    paper: cleanText(question.paper),
    variant: cleanText(question.variant),
    questionNumber: cleanText(question.question_number) || String(index + 1),
    subQuestion: cleanText(question.sub_question),
    marks: question.marks ?? null,
    topicSyllabus: cleanText(question.topic_syllabus),
    topicGeneral: cleanText(question.topic_general),
    questionText: text,
    stem: parsed.stem,
    options: parsed.options,
    markingScheme: cleanText(question.marking_scheme),
    correctOption: cleanText(question.correct_option).toUpperCase() || null,
    requiresDiagram: Boolean(question.requires_diagram || normalizedImages.length),
    images: normalizedImages,
    syllabusRef: question.syllabus_ref ?? null,
    reference: question.reference ?? null,
  };
}

function normalizeDbQuestion(question: DbQuestion, index: number) {
  const fallbackParsed = parseMcqText(cleanText(question.question_text), question.options);
  const images = Array.isArray(question.images) ? question.images : [];
  const normalizedImages = images
    .filter((image) => imageMatchesQuestion(image, question))
    .map((image) => normalizeImageRecord(image, question, index))
    .filter((image) => image.src);

  return {
    id: question.id,
    subject: question.subject,
    year: String(question.year),
    session: cleanText(question.session),
    paper: cleanText(question.paper),
    variant: cleanText(question.variant),
    questionNumber: cleanText(question.question_number) || String(index + 1),
    subQuestion: cleanText(question.sub_question),
    marks: question.marks ?? null,
    topicSyllabus: cleanText(question.topic_syllabus),
    topicGeneral: cleanText(question.topic_general),
    questionText: cleanText(question.question_text),
    stem: cleanText(question.stem) || fallbackParsed.stem,
    options: optionArrayFromUnknown(question.options).length ? optionArrayFromUnknown(question.options) : fallbackParsed.options,
    markingScheme: cleanText(question.marking_scheme),
    correctOption: cleanText(question.correct_option).toUpperCase() || null,
    requiresDiagram: Boolean(question.requires_diagram || normalizedImages.length),
    images: normalizedImages,
    syllabusRef: question.syllabus_ref ?? null,
    reference: question.reference ?? null,
    questionKind: question.question_kind,
  };
}

function mergePracticeQuestions<T extends ReturnType<typeof normalizeDbQuestion>>(questions: T[]) {
  const merged = new Map<string, T>();

  for (const question of questions) {
    const key = [
      question.subject,
      question.year,
      question.session,
      question.paper,
      question.variant,
      question.questionNumber,
      question.subQuestion,
    ]
      .map((value) => String(value || "").toLowerCase())
      .join("|");

    const current = merged.get(key);
    if (!current) {
      merged.set(key, question);
      continue;
    }

    const imageKeys = new Set(current.images.map((image) => image.src || image.path || image.alt));
    const extraImages = question.images.filter((image) => {
      const imageKey = image.src || image.path || image.alt;
      if (imageKeys.has(imageKey)) return false;
      imageKeys.add(imageKey);
      return true;
    });

    current.images.push(...extraImages);

    if (question.questionText.length > current.questionText.length) current.questionText = question.questionText;
    if (question.stem.length > current.stem.length) current.stem = question.stem;
    if (!current.markingScheme && question.markingScheme) current.markingScheme = question.markingScheme;
    if (!current.correctOption && question.correctOption) current.correctOption = question.correctOption;
    if (current.marks === null && question.marks !== null) current.marks = question.marks;
    current.requiresDiagram = current.requiresDiagram || question.requiresDiagram;
  }

  return Array.from(merged.values());
}

async function fetchAllDbQuestionsForMeta(supabase: PaperPracticeSupabaseClient) {
  const rows: Array<{
    subject: string;
    subject_slug: string;
    year: number;
    topic_syllabus: string | null;
    topic_general: string | null;
    requires_diagram: boolean;
    syllabus_ref: Record<string, unknown> | null;
  }> = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("o_level_questions")
      .select("subject,subject_slug,year,topic_syllabus,topic_general,requires_diagram,syllabus_ref")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function buildDbMeta(supabase: PaperPracticeSupabaseClient) {
  const rows = await fetchAllDbQuestionsForMeta(supabase);
  if (rows.length === 0) return null;

  const subjects = new Map<
    string,
    {
      name: string;
      slug: string;
      years: Map<string, number>;
      topics: Map<string, { name: string; general: string; count: number; years: Set<string>; syllabusRef: unknown }>;
      totalQuestions: number;
      imageQuestions: number;
    }
  >();

  for (const row of rows) {
    const subject = subjects.get(row.subject_slug) ?? {
      name: row.subject,
      slug: row.subject_slug,
      years: new Map<string, number>(),
      topics: new Map<string, { name: string; general: string; count: number; years: Set<string>; syllabusRef: unknown }>(),
      totalQuestions: 0,
      imageQuestions: 0,
    };
    const year = String(row.year);
    const name = cleanText(row.topic_syllabus) || cleanText(row.topic_general) || "Uncategorised";
    const topicKey = name.toLowerCase();
    const topic = subject.topics.get(topicKey) ?? {
      name,
      general: cleanText(row.topic_general),
      count: 0,
      years: new Set<string>(),
      syllabusRef: row.syllabus_ref ?? null,
    };

    topic.count += 1;
    topic.years.add(year);
    if (!topic.general) topic.general = cleanText(row.topic_general);
    if (!topic.syllabusRef && row.syllabus_ref) topic.syllabusRef = row.syllabus_ref;

    subject.topics.set(topicKey, topic);
    subject.years.set(year, (subject.years.get(year) ?? 0) + 1);
    subject.totalQuestions += 1;
    if (row.requires_diagram) subject.imageQuestions += 1;
    subjects.set(row.subject_slug, subject);
  }

  return Array.from(subjects.values())
    .map((subject) => ({
      name: subject.name,
      slug: subject.slug,
      years: Array.from(subject.years.entries())
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => Number.parseInt(b.year) - Number.parseInt(a.year)),
      topics: Array.from(subject.topics.values())
        .map((topic) => ({
          name: topic.name,
          general: topic.general,
          count: topic.count,
          years: Array.from(topic.years).sort((a, b) => Number.parseInt(b) - Number.parseInt(a)),
          syllabusRef: topic.syllabusRef,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      totalQuestions: subject.totalQuestions,
      imageQuestions: subject.imageQuestions,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getDbSubjectQuestions(supabase: PaperPracticeSupabaseClient, subjectSlug: string, year: string, topic: string | null) {
  let query = supabase
    .from("o_level_questions")
    .select(
      "id,subject,subject_slug,year,session,paper,variant,question_number,sub_question,marks,topic_syllabus,topic_general,question_text,stem,question_kind,options,marking_scheme,correct_option,requires_diagram,images,syllabus_ref,reference,source",
    )
    .eq("subject_slug", subjectSlug)
    .eq("year", Number.parseInt(year, 10))
    .order("session", { ascending: true })
    .order("paper", { ascending: true })
    .order("variant", { ascending: true })
    .order("question_number", { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as DbQuestion[];
  const filtered = rows.filter((question) => {
    if (!topic || topic === "all") return true;
    const questionTopic = cleanText(question.topic_syllabus) || cleanText(question.topic_general) || "Uncategorised";
    return questionTopic.toLowerCase() === topic.toLowerCase();
  });

  const questions = mergePracticeQuestions(filtered.map((question, index) => normalizeDbQuestion(question, index)));
  const topics = Array.from(
    new Set(rows.map((question) => cleanText(question.topic_syllabus) || cleanText(question.topic_general) || "Uncategorised")),
  ).sort((a, b) => a.localeCompare(b));

  return { questions, topics };
}

async function buildSubjectMeta(dataRoot: string, subject: string) {
  const files = await getYearFiles(dataRoot, subject);
  const years = [];
  const topics = new Map<string, { name: string; general: string; count: number; years: Set<string>; syllabusRef: unknown }>();
  let totalQuestions = 0;
  let imageQuestions = 0;

  for (const file of files) {
    const year = file.replace(".json", "");
    const data = await loadYearFile(dataRoot, subject, year);
    const questions = Array.isArray(data.mcqs) ? data.mcqs : [];
    totalQuestions += questions.length;
    years.push({ year, count: questions.length });

    for (const question of questions) {
      const name = topicName(question);
      const key = name.toLowerCase();
      const current = topics.get(key) ?? {
        name,
        general: cleanText(question.topic_general),
        count: 0,
        years: new Set<string>(),
        syllabusRef: question.syllabus_ref ?? null,
      };
      current.count += 1;
      current.years.add(year);
      if (!current.general) current.general = cleanText(question.topic_general);
      if (!current.syllabusRef && question.syllabus_ref) current.syllabusRef = question.syllabus_ref;
      topics.set(key, current);

      if (question.requires_diagram || (Array.isArray(question.images) && question.images.length > 0)) {
        imageQuestions += 1;
      }
    }
  }

  return {
    name: subject,
    slug: slugify(subject),
    years,
    topics: Array.from(topics.values())
      .map((topic) => ({
        name: topic.name,
        general: topic.general,
        count: topic.count,
        years: Array.from(topic.years).sort((a, b) => Number.parseInt(b) - Number.parseInt(a)),
        syllabusRef: topic.syllabusRef,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    totalQuestions,
    imageQuestions,
  };
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const dbSubjects = await buildDbMeta(supabase);
        if (dbSubjects && dbSubjects.length > 0) {
          const { searchParams } = new URL(request.url);
          const rawSubject = searchParams.get("subject");

          if (!rawSubject) {
            return NextResponse.json({ subjects: dbSubjects, source: "supabase" });
          }

          const subject = normalizeSubjectName(rawSubject, dbSubjects.map((item) => item.name));
          const subjectMeta = dbSubjects.find((item) => item.name === subject);
          if (!subjectMeta) {
            return NextResponse.json({ error: "Subject not found." }, { status: 404 });
          }

          const year = searchParams.get("year");
          if (!year || !/^\d{4}$/.test(year)) {
            return NextResponse.json({ subject: subjectMeta, source: "supabase" });
          }

          const topic = searchParams.get("topic");
          const result = await getDbSubjectQuestions(supabase, subjectMeta.slug, year, topic);

          return NextResponse.json({
            subject: subjectMeta.name,
            year,
            topics: result.topics,
            questions: result.questions,
            total: result.questions.length,
            source: "supabase",
          });
        }
      } catch (dbError) {
        console.warn("Paper practice Supabase fallback:", dbError);
      }
    }

    const dataRoot = await getDataRoot();
    const subjects = await getSubjects(dataRoot);
    const { searchParams } = new URL(request.url);
    const rawSubject = searchParams.get("subject");

    if (!rawSubject) {
      const subjectMeta = await Promise.all(subjects.map((subject) => buildSubjectMeta(dataRoot, subject)));
      return NextResponse.json({ subjects: subjectMeta });
    }

    const subject = normalizeSubjectName(rawSubject, subjects);
    if (!subject) {
      return NextResponse.json({ error: "Subject not found." }, { status: 404 });
    }

    const year = searchParams.get("year");
    if (!year || !/^\d{4}$/.test(year)) {
      const meta = await buildSubjectMeta(dataRoot, subject);
      return NextResponse.json({ subject: meta });
    }

    const topic = searchParams.get("topic");
    const data = await loadYearFile(dataRoot, subject, year);
    const questions = (Array.isArray(data.mcqs) ? data.mcqs : [])
      .filter((question) => !topic || topic === "all" || topicName(question).toLowerCase() === topic.toLowerCase())
      .map((question, index) => normalizeQuestion(question, subject, year, index));

    const topics = Array.from(new Set((data.mcqs ?? []).map(topicName))).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      subject,
      year,
      topics,
      questions,
      total: questions.length,
    });
  } catch (error) {
    console.error("Paper practice API error:", error);
    return NextResponse.json({ error: "Unable to load paper practice data." }, { status: 500 });
  }
}
