import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const PAGE_SIZE = 25;
const PREVIEW_SIZE = 8;
// Çoklu-kolon (question_text/solution_text, title/subtitle/body_markdown) ilike aramaları
// tek bir PostgREST sorgusunda birleştirilemediği için her kolon ayrı çekilip JS'te
// birleştirilip sıralanıyor. Bu tavan, birleştirme öncesi kolon başına çekilen satır sayısını
// sınırlar — müfredat ölçeğindeki veri için yeterli, aşılırsa `truncated: true` dönülür.
const COLUMN_FETCH_CAP = 300;

type Scope = 'all' | 'questions' | 'contents';

type Embed<T> = T | T[] | null;

function one<T>(v: Embed<T>): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] || null : v;
}

type GradeRef = { slug: string | null };
type LessonRef = { slug: string | null };
type UnitRef = { slug: string | null; grades: Embed<GradeRef>; lessons: Embed<LessonRef> };
type TopicRef = { title: string; slug: string | null; units: Embed<UnitRef> };

// Konu -> ünite -> ders/sınıf slug zincirini çözer; herkese açık site linkleri
// (ders sayfası, soru bankası) bu dört slug'ın tamamını gerektirir.
function resolveSlugChain(topics: Embed<TopicRef>): { gradeSlug: string; lessonSlug: string; unitSlug: string; topicSlug: string; topicTitle: string | null } | null {
  const topic = one(topics);
  const unit = topic ? one(topic.units) : null;
  const grade = unit ? one(unit.grades) : null;
  const lesson = unit ? one(unit.lessons) : null;
  const topicTitle = topic?.title || null;
  if (!grade?.slug || !lesson?.slug || !unit?.slug || !topic?.slug) return null;
  return { gradeSlug: grade.slug, lessonSlug: lesson.slug, unitSlug: unit.slug, topicSlug: topic.slug, topicTitle };
}

type QuestionRow = {
  id: number;
  question_text: string;
  solution_text: string | null;
  topic_id: number | null;
  created_at: string;
  topics: Embed<TopicRef>;
  question_types: Embed<{ code: string }>;
};

type QuestionResult = {
  id: number;
  question_text: string;
  solution_text: string | null;
  topic_id: number | null;
  topicTitle: string | null;
  typeCode: string | null;
  href: string | null;
};

function toQuestionResult(row: QuestionRow): QuestionResult {
  const chain = resolveSlugChain(row.topics);
  const type = one(row.question_types);
  const href = chain
    ? `/soru-bankasi/${chain.gradeSlug}/${chain.lessonSlug}/${chain.unitSlug}/${chain.topicSlug}?soru=${row.id}`
    : null;

  return {
    id: row.id,
    question_text: row.question_text,
    solution_text: row.solution_text,
    topic_id: row.topic_id,
    topicTitle: chain?.topicTitle || null,
    typeCode: type?.code || null,
    href,
  };
}

type ContentRow = {
  id: number;
  title: string;
  subtitle: string | null;
  body_markdown: string | null;
  is_published: boolean;
  topic_id: number | null;
  created_at: string;
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

function toContentResult(row: ContentRow): ContentResult {
  const chain = resolveSlugChain(row.topics);
  const href = chain ? `/${chain.gradeSlug}/${chain.lessonSlug}/${chain.unitSlug}/${chain.topicSlug}` : null;

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    is_published: row.is_published,
    topic_id: row.topic_id,
    topicTitle: chain?.topicTitle || null,
    href,
  };
}

function mergeDedupSort<T extends { id: number; created_at: string }>(lists: T[][]): { merged: T[]; truncated: boolean } {
  const byId = new Map<number, T>();
  let truncated = false;
  for (const list of lists) {
    if (list.length >= COLUMN_FETCH_CAP) truncated = true;
    for (const row of list) byId.set(row.id, row);
  }
  const merged = Array.from(byId.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { merged, truncated };
}

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

async function resolveTopicIds(supabase: SupabaseClient, gradeId: string, lessonId: string): Promise<number[] | null> {
  if (!gradeId && !lessonId) return null;

  let unitQuery = supabase.from('units').select('id');
  if (gradeId) unitQuery = unitQuery.eq('grade_id', gradeId);
  if (lessonId) unitQuery = unitQuery.eq('lesson_id', lessonId);
  const { data: unitRows, error: unitErr } = await unitQuery;
  if (unitErr) throw new Error(unitErr.message);
  const unitIds = ((unitRows as { id: number }[] | null) || []).map((u) => u.id);
  if (!unitIds.length) return [];

  const { data: topicRows, error: topicErr } = await supabase.from('topics').select('id').in('unit_id', unitIds);
  if (topicErr) throw new Error(topicErr.message);
  return ((topicRows as { id: number }[] | null) || []).map((t) => t.id);
}

async function searchQuestions(supabase: SupabaseClient, pattern: string, topicIds: number[] | null, page: number, pageSize: number) {
  const select = 'id, question_text, solution_text, topic_id, created_at, topics(title, slug, units(slug, grades(slug), lessons(slug))), question_types(code)';
  let textQuery = supabase.from('questions').select(select).ilike('question_text', pattern).order('created_at', { ascending: false }).limit(COLUMN_FETCH_CAP);
  let solutionQuery = supabase.from('questions').select(select).ilike('solution_text', pattern).order('created_at', { ascending: false }).limit(COLUMN_FETCH_CAP);
  if (topicIds) {
    textQuery = textQuery.in('topic_id', topicIds);
    solutionQuery = solutionQuery.in('topic_id', topicIds);
  }

  const [textRes, solutionRes] = await Promise.all([textQuery, solutionQuery]);
  if (textRes.error) throw new Error(textRes.error.message);
  if (solutionRes.error) throw new Error(solutionRes.error.message);

  const { merged, truncated } = mergeDedupSort<QuestionRow>([
    (textRes.data as QuestionRow[]) || [],
    (solutionRes.data as QuestionRow[]) || [],
  ]);

  return { items: paginate(merged, page, pageSize).map(toQuestionResult), total: merged.length, truncated };
}

async function searchContents(supabase: SupabaseClient, pattern: string, topicIds: number[] | null, page: number, pageSize: number) {
  const select = 'id, title, subtitle, body_markdown, is_published, topic_id, created_at, topics(title, slug, units(slug, grades(slug), lessons(slug)))';
  let titleQuery = supabase.from('topic_contents').select(select).ilike('title', pattern).order('created_at', { ascending: false }).limit(COLUMN_FETCH_CAP);
  let subtitleQuery = supabase.from('topic_contents').select(select).ilike('subtitle', pattern).order('created_at', { ascending: false }).limit(COLUMN_FETCH_CAP);
  let bodyQuery = supabase.from('topic_contents').select(select).ilike('body_markdown', pattern).order('created_at', { ascending: false }).limit(COLUMN_FETCH_CAP);
  if (topicIds) {
    titleQuery = titleQuery.in('topic_id', topicIds);
    subtitleQuery = subtitleQuery.in('topic_id', topicIds);
    bodyQuery = bodyQuery.in('topic_id', topicIds);
  }

  const [titleRes, subtitleRes, bodyRes] = await Promise.all([titleQuery, subtitleQuery, bodyQuery]);
  if (titleRes.error) throw new Error(titleRes.error.message);
  if (subtitleRes.error) throw new Error(subtitleRes.error.message);
  if (bodyRes.error) throw new Error(bodyRes.error.message);

  const { merged, truncated } = mergeDedupSort<ContentRow>([
    (titleRes.data as ContentRow[]) || [],
    (subtitleRes.data as ContentRow[]) || [],
    (bodyRes.data as ContentRow[]) || [],
  ]);

  return { items: paginate(merged, page, pageSize).map(toContentResult), total: merged.length, truncated };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const params = request.nextUrl.searchParams;
  const q = params.get('q')?.trim() || '';
  if (q.length < 2) {
    return NextResponse.json({ error: 'Arama için en az 2 karakter girin' }, { status: 400 });
  }

  const scope: Scope = params.get('scope') === 'questions' || params.get('scope') === 'contents' ? (params.get('scope') as Scope) : 'all';
  const gradeId = params.get('gradeId') || '';
  const lessonId = params.get('lessonId') || '';
  const isAll = scope === 'all';
  const page = isAll ? 1 : Math.max(1, Number(params.get('page')) || 1);
  const pageSize = isAll ? PREVIEW_SIZE : PAGE_SIZE;

  const supabase = createServiceClient();
  const pattern = `%${q}%`;

  try {
    const topicIds = await resolveTopicIds(supabase, gradeId, lessonId);
    const noTopicMatch = topicIds !== null && topicIds.length === 0;

    const [questions, contents] = await Promise.all([
      scope !== 'contents' && !noTopicMatch
        ? searchQuestions(supabase, pattern, topicIds, page, pageSize)
        : Promise.resolve({ items: [], total: 0, truncated: false }),
      scope !== 'questions' && !noTopicMatch
        ? searchContents(supabase, pattern, topicIds, page, pageSize)
        : Promise.resolve({ items: [], total: 0, truncated: false }),
    ]);

    return NextResponse.json({ scope, page, pageSize: isAll ? null : PAGE_SIZE, questions, contents });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Arama başarısız' }, { status: 500 });
  }
}
