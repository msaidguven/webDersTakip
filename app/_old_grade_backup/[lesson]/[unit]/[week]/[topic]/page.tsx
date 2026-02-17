import { createClient } from '@/utils/supabase/server';
import DersClient from '@/app/ders/DersClient';
import Link from 'next/link';
import {
  normalizeSlugWithGrade,
  parseGradeSegment,
  parseWeekSegment,
} from '@/app/src/lib/routeParsing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: {
    grade: string;
    lesson: string;
    unit: string;
    week: string;
    topic: string;
  };
}

interface WeeklyTopicData {
  gradeName: string;
  lessonName: string;
  unitName: string;
  outcomes: OutcomeItem[];
  contents: ContentItem[];
  topicSlug: string | null;
  lessonId: number | null;
}

interface OutcomeItem {
  id: number;
  description: string;
  topicTitle: string;
}

interface ContentItem {
  id: number;
  title: string;
  content: string;
  orderNo: number | null;
}

interface GradeRow {
  name: string;
}

interface LessonRow {
  id: number;
  name: string;
  slug: string | null;
}

interface UnitRow {
  id: number;
  title: string;
  slug: string | null;
  lesson_id: number;
}

interface UnitGradeRow {
  unit_id: number;
}

interface TopicRow {
  id: number;
  title: string;
  slug: string | null;
  unit_id: number;
}

interface TopicContentRow {
  id: number;
  title: string;
  content: string;
  order_no: number | null;
  topic_id: number;
  topics: TopicRow | null;
}

interface WeekContentRow {
  topic_content_id: number;
  topic_contents: TopicContentRow | null;
}

interface OutcomeWeekRow {
  outcome_id: number;
  start_week: number;
  end_week: number;
}

interface OutcomeRow {
  id: number;
  description: string;
  topic_id: number;
  topics: {
    title: string;
    unit_id: number;
    units: {
      id: number;
      lesson_id: number;
    } | null;
  } | null;
}

async function getWeeklyTopicData(
  gradeId: number,
  lessonSlug: string,
  unitSlug: string,
  week: number
): Promise<{ data: WeeklyTopicData | null; error: string | null }> {
  const supabase = await createClient();

  const [
    { data: grade, error: gradeError },
    { data: lesson, error: lessonError },
  ] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gradeId).single(),
    supabase.from('lessons').select('id, name, slug').eq('slug', lessonSlug).single(),
  ]);

  if (gradeError) {
    console.error('[WeeklyRoute] Grade sorgu hatasi:', gradeError);
  }
  if (lessonError) {
    console.error('[WeeklyRoute] Lesson sorgu hatasi:', lessonError);
  }

  const gradeData = grade as GradeRow | null;
  const lessonData = lesson as LessonRow | null;

  if (!gradeData || !lessonData) {
    return { data: null, error: 'Sinif veya ders bulunamadi.' };
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id, title, slug, lesson_id')
    .eq('slug', unitSlug)
    .eq('lesson_id', lessonData.id)
    .single();

  if (unitError) {
    console.error('[WeeklyRoute] Unit sorgu hatasi:', unitError);
  }
  const unitData = unit as UnitRow | null;
  if (!unitData) {
    return { data: null, error: 'Unite bulunamadi.' };
  }

  const { data: unitGrade, error: unitGradeError } = await supabase
    .from('unit_grades')
    .select('unit_id')
    .eq('unit_id', unitData.id)
    .eq('grade_id', gradeId)
    .single();

  if (unitGradeError) {
    console.error('[WeeklyRoute] Unit-grade sorgu hatasi:', unitGradeError);
  }
  const unitGradeData = unitGrade as UnitGradeRow | null;
  if (!unitGradeData) {
    return { data: null, error: 'Unite bu sinifta bulunamadi.' };
  }

  const { data: weekContents, error: weekContentsError } = await supabase
    .from('topic_content_weeks')
    .select('topic_content_id, topic_contents!inner(id, title, content, order_no, topic_id, topics!inner(id, title, slug, unit_id))')
    .eq('curriculum_week', week);

  if (weekContentsError) {
    console.error('[WeeklyRoute] Hafta icerik sorgu hatasi:', weekContentsError);
  }

  const weekContentRows = (weekContents as WeekContentRow[] | null) || [];
  const contentItems = weekContentRows
    .map((w) => w.topic_contents)
    .filter((tc): tc is TopicContentRow => Boolean(tc && tc.topics && tc.topics.unit_id === unitData.id))
    .sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0));

  const firstContent = contentItems[0] || null;

  const { data: weekOutcomes, error: weekOutcomesError } = await supabase
    .from('outcome_weeks')
    .select('outcome_id, start_week, end_week')
    .lte('start_week', week)
    .gte('end_week', week);

  if (weekOutcomesError) {
    console.error('[WeeklyRoute] Hafta kazanim sorgu hatasi:', weekOutcomesError);
  }

  let outcomes: OutcomeItem[] = [];
  const outcomeWeekRows = (weekOutcomes as OutcomeWeekRow[] | null) || [];
  if (outcomeWeekRows.length) {
    const outcomeIds = outcomeWeekRows.map((w) => w.outcome_id);
    const { data: outcomesData, error: outcomesError } = await supabase
      .from('outcomes')
      .select('id, description, topic_id, topics!inner(title, unit_id, units!inner(id, lesson_id))')
      .in('id', outcomeIds);

    if (outcomesError) {
      console.error('[WeeklyRoute] Kazanim detay sorgu hatasi:', outcomesError);
    }

    const outcomeRows = (outcomesData as OutcomeRow[] | null) || [];
    const filteredOutcomes = outcomeRows.filter((o) =>
      o.topics?.units?.id === unitData.id && o.topics?.units?.lesson_id === lessonData.id
    );

    outcomes = filteredOutcomes.map((o) => ({
      id: o.id,
      description: o.description,
      topicTitle: o.topics?.title || '',
    }));
  }

  const contents: ContentItem[] = firstContent
    ? [
        {
          id: firstContent.id,
          title: firstContent.title,
          content: firstContent.content,
          orderNo: firstContent.order_no,
        },
      ]
    : [];

  return {
    data: {
      gradeName: gradeData.name || '',
      lessonName: lessonData.name || '',
      unitName: unitData.title || '',
      outcomes,
      contents,
      topicSlug: firstContent?.topics?.slug || null,
      lessonId: lessonData.id || null,
    },
    error: null,
  };
}

export default async function WeeklyTopicPage({ params }: PageProps) {
  const gradeId = parseGradeSegment(params.grade);
  const week = parseWeekSegment(params.week);

  if (!gradeId || !week) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">URL formatı hatalı. Örnek: 5-sınıf/.../hafta-12/...</p>
      </div>
    );
  }

  const lessonSlug = normalizeSlugWithGrade(params.lesson, gradeId);
  const unitSlug = normalizeSlugWithGrade(params.unit, gradeId);
  const topicSlugParam = normalizeSlugWithGrade(params.topic, gradeId);

  const { data, error } = await getWeeklyTopicData(gradeId, lessonSlug, unitSlug, week);

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">{error || 'Icerik bulunamadi.'}</p>
      </div>
    );
  }

  if (data.contents.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted">Bu hafta için içerik bulunamadı.</p>
          <p className="text-xs text-gray-500">Hafta: {week}</p>
          <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-500">
            Anasayfaya dön
          </Link>
        </div>
      </div>
    );
  }

  if (data.topicSlug && topicSlugParam && data.topicSlug !== topicSlugParam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-2">Konu slug uyusmuyor.</p>
          <p className="text-xs text-gray-500">Beklenen: {data.topicSlug}</p>
        </div>
      </div>
    );
  }

  if (!data.lessonId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Ders bilgisi eksik.</p>
      </div>
    );
  }

  return (
    <DersClient
      initialData={{
        gradeName: data.gradeName,
        lessonName: data.lessonName,
        unitName: data.unitName,
        outcomes: data.outcomes,
        contents: data.contents,
      }}
      gradeId={String(gradeId)}
      lessonId={String(data.lessonId)}
      week={week}
    />
  );
}
