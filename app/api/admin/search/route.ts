import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const RESULT_LIMIT = 25;

type QuestionRow = {
  id: number;
  question_text: string;
  solution_text: string | null;
  topic_id: number | null;
  topics: { title: string } | { title: string }[] | null;
  question_types: { code: string } | { code: string }[] | null;
};

type Embed<T> = T | T[] | null;

type GradeRef = { slug: string | null };
type LessonRef = { slug: string | null };
type UnitRef = { slug: string | null; grades: Embed<GradeRef>; lessons: Embed<LessonRef> };
type TopicRef = { title: string; slug: string | null; units: Embed<UnitRef> };

type ContentRow = {
  id: number;
  title: string;
  subtitle: string | null;
  body_markdown: string | null;
  is_published: boolean;
  topic_id: number | null;
  topics: Embed<TopicRef>;
};

type ContentResult = {
  id: number;
  title: string;
  subtitle: string | null;
  is_published: boolean;
  topic_id: number | null;
  topicTitle: string | null;
  href: string | null;
};

function one<T>(v: Embed<T>): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] || null : v;
}

function toContentResult(row: ContentRow): ContentResult {
  const topic = one(row.topics);
  const unit = topic ? one(topic.units) : null;
  const grade = unit ? one(unit.grades) : null;
  const lesson = unit ? one(unit.lessons) : null;

  const href =
    grade?.slug && lesson?.slug && unit?.slug && topic?.slug
      ? `/${grade.slug}/${lesson.slug}/${unit.slug}/${topic.slug}`
      : null;

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    is_published: row.is_published,
    topic_id: row.topic_id,
    topicTitle: topic?.title || null,
    href,
  };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const q = request.nextUrl.searchParams.get('q')?.trim() || '';
  if (q.length < 2) {
    return NextResponse.json({ error: 'Arama için en az 2 karakter girin' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const pattern = `%${q}%`;

  const [qByText, qBySolution, cByTitle, cBySubtitle, cByBody] = await Promise.all([
    supabase
      .from('questions')
      .select('id, question_text, solution_text, topic_id, topics(title), question_types(code)')
      .ilike('question_text', pattern)
      .order('created_at', { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from('questions')
      .select('id, question_text, solution_text, topic_id, topics(title), question_types(code)')
      .ilike('solution_text', pattern)
      .order('created_at', { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from('topic_contents')
      .select('id, title, subtitle, body_markdown, is_published, topic_id, topics(title, slug, units(slug, grades(slug), lessons(slug)))')
      .ilike('title', pattern)
      .order('created_at', { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from('topic_contents')
      .select('id, title, subtitle, body_markdown, is_published, topic_id, topics(title, slug, units(slug, grades(slug), lessons(slug)))')
      .ilike('subtitle', pattern)
      .order('created_at', { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from('topic_contents')
      .select('id, title, subtitle, body_markdown, is_published, topic_id, topics(title, slug, units(slug, grades(slug), lessons(slug)))')
      .ilike('body_markdown', pattern)
      .order('created_at', { ascending: false })
      .limit(RESULT_LIMIT),
  ]);

  const firstError = [qByText, qBySolution, cByTitle, cBySubtitle, cByBody].find((r) => r.error)?.error;
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

  const questionsById = new Map<number, QuestionRow>();
  for (const row of [...(qByText.data || []), ...(qBySolution.data || [])] as QuestionRow[]) {
    questionsById.set(row.id, row);
  }

  const contentsById = new Map<number, ContentRow>();
  for (const row of [...(cByTitle.data || []), ...(cBySubtitle.data || []), ...(cByBody.data || [])] as ContentRow[]) {
    contentsById.set(row.id, row);
  }

  return NextResponse.json({
    questions: Array.from(questionsById.values()).slice(0, RESULT_LIMIT),
    contents: Array.from(contentsById.values()).slice(0, RESULT_LIMIT).map(toContentResult),
  });
}
