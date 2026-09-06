// app/[gradeSlug]/[lessonSlug]/page.tsx
// Bu dosya, mevcut page.tsx'in YERİNİ ALIR. Eski page.tsx içeriği
// app/[gradeSlug]/[lessonSlug]/icerik/page.tsx dosyasına taşındı.

import { cache } from 'react';
import type { Metadata } from 'next';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { parseGradeSegment, getCurrentCurriculumWeek } from '@/app/src/lib/routeParsing';
import { getGradeIcon } from '@/app/src/lib/homeMapping';
import { getCurriculumCalendar } from '@/app/src/lib/curriculumCalendar';
import { getQuestionCountsByTopicId } from '@/app/src/lib/questionCounts';
import MufredatOverviewClient, { Unit } from '../../ders/Mufredatoverviewclient';

// Bu sayfa taslak/admin önizlemesi göstermiyor (o iş /ders?... + admin paneli üzerinden
// yapılıyor) — tamamen public içerik, bu yüzden ISR ile cache'lenebiliyor. ?hafta= sorgu
// parametresi artık SUNUCUDA okunmuyor (searchParams okumak Next'i sayfayı dinamik render
// etmeye zorlardı) — MufredatOverviewClient zaten client-side useSearchParams() kullanıyor,
// "hafta" override'ı oraya taşındı (bkz. Mufredatoverviewclient.tsx).
export const revalidate = 3600;

interface Params {
  gradeSlug: string;
  lessonSlug: string;
}

interface PageProps {
  params: Promise<Params>;
}

export async function generateStaticParams(): Promise<Params[]> {
  return [];
}

type UnitRow = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number;
  start_week: number | null;
  end_week: number | null;
  is_active: boolean;
};
type TopicRow = { id: number; unit_id: number; title: string; slug: string | null; order_no: number };
type GradeRow = { id: number; name: string; order_no: number; slug: string | null };
type LessonRow = { id: number; name: string; slug: string | null; icon: string | null };
type LessonGradeRow = { lesson_id: number };
type GradeLessonOption = { id: number; name: string; slug: string | null; icon: string | null };

const getMufredatOverviewData = cache(async function getMufredatOverviewData(gradeSlug: string, lessonSlug: string) {
  const supabase = createAnonClient();

  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();
  const decodedLessonSlug = decodeURIComponent(lessonSlug || '').trim();

  let grade: GradeRow | null = null;
  let lesson: LessonRow | null = null;

  const { data: gradeBySlug } = await supabase
    .from('grades')
    .select('id, name, order_no, slug')
    .eq('slug', decodedGradeSlug)
    .maybeSingle();
  grade = gradeBySlug as GradeRow | null;

  if (!grade) {
    const gradeOrderNo = parseGradeSegment(decodedGradeSlug);
    const gradeId = Number(decodedGradeSlug);
    const gradeQueryValue = gradeOrderNo ?? (Number.isFinite(gradeId) ? gradeId : null);

    if (gradeQueryValue) {
      const { data: gradeByFallback } = await supabase
        .from('grades')
        .select('id, name, order_no, slug')
        .eq(gradeOrderNo ? 'order_no' : 'id', gradeQueryValue)
        .maybeSingle();
      grade = gradeByFallback as GradeRow | null;
    }
  }

  const { data: lessonBySlug } = await supabase
    .from('lessons')
    .select('id, name, slug, icon')
    .eq('slug', decodedLessonSlug)
    .maybeSingle();
  lesson = lessonBySlug as LessonRow | null;

  if (!lesson) {
    const lessonId = Number(decodedLessonSlug);
    if (Number.isFinite(lessonId)) {
      const { data: lessonById } = await supabase
        .from('lessons')
        .select('id, name, slug, icon')
        .eq('id', lessonId)
        .maybeSingle();
      lesson = lessonById as LessonRow | null;
    }
  }

  if (!grade || !lesson) {
    return null;
  }

  const gId = grade.id;
  const lId = lesson.id;

  const { data: lessonGradeData } = await supabase
    .from('lesson_grades')
    .select('is_active')
    .eq('lesson_id', lId)
    .eq('grade_id', gId)
    .maybeSingle();

  if ((lessonGradeData as { is_active: boolean } | null)?.is_active === false) {
    return null;
  }

  const unitsQuery = supabase
    .from('units')
    .select('id, title, slug, order_no, start_week, end_week, is_active')
    .eq('lesson_id', lId)
    .eq('grade_id', gId)
    .eq('is_active', true)
    .order('order_no', { ascending: true });
  const { data: unitsData } = await unitsQuery;

  const units = (unitsData as UnitRow[] | null) || [];

  const totalWeeks = (() => {
    const maxFromUnits = units.reduce((max, u) => Math.max(max, u.end_week ?? u.start_week ?? 0), 0);
    return Math.max(1, Math.min(52, maxFromUnits || 30));
  })();

  // Her ünite için konu listesi (sayı etiketi + doğrudan görünen liste). heroImageUrl
  // (kullanıcının 2026-09-06 isteği: "bu sayfalara da küçük resimler eklenebilir mi") —
  // ünite tanıtım sayfasındaki/soru bankasındaki AYNI topic_contents.hero_image_url.
  const unitIds = units.map((u) => u.id);
  let topicsByUnit: Record<
    number,
    { id: number; title: string; slug: string | null; order_no: number; questionCount: number; hasContent: boolean; heroImageUrl: string | null }[]
  > = {};
  if (unitIds.length > 0) {
    const { data: topicsData } = await supabase
      .from('topics')
      .select('id, unit_id, title, slug, order_no')
      .in('unit_id', unitIds)
      .eq('is_active', true)
      .order('order_no', { ascending: true });

    const topicRows = (topicsData as TopicRow[] | null) || [];
    const topicIds = topicRows.map((t) => t.id);
    const [questionCountsByTopic, { data: contentRows }] = await Promise.all([
      getQuestionCountsByTopicId(supabase, topicIds, { activeOnly: true }),
      topicIds.length
        ? supabase.from('topic_contents').select('topic_id, hero_image_url').in('topic_id', topicIds).eq('is_published', true)
        : Promise.resolve({ data: [] as { topic_id: number; hero_image_url: string | null }[] }),
    ]);
    const contentByTopicId = new Map(
      ((contentRows as { topic_id: number; hero_image_url: string | null }[] | null) || []).map((r) => [r.topic_id, r.hero_image_url])
    );

    topicsByUnit = topicRows.reduce(
      (acc, t) => {
        if (!acc[t.unit_id]) acc[t.unit_id] = [];
        acc[t.unit_id].push({
          id: t.id,
          title: t.title,
          slug: t.slug,
          order_no: t.order_no,
          questionCount: questionCountsByTopic.get(t.id) ?? 0,
          hasContent: contentByTopicId.has(t.id),
          heroImageUrl: contentByTopicId.get(t.id) ?? null,
        });
        return acc;
      },
      {} as Record<
        number,
        { id: number; title: string; slug: string | null; order_no: number; questionCount: number; hasContent: boolean; heroImageUrl: string | null }[]
      >
    );
  }

  const unitsWithTopicCount: Unit[] = units.map((u) => ({
    ...u,
    topicCount: topicsByUnit[u.id]?.length ?? null,
    topics: topicsByUnit[u.id] ?? [],
    questionCount: (topicsByUnit[u.id] ?? []).reduce((sum, t) => sum + t.questionCount, 0),
  }));

  // Sınıf değiştirme dropdown'u — TÜM aktif sınıflar HER ZAMAN listelenir, hiçbiri
  // gizlenmez (kullanıcının 2026-09-05 kesin isteği). Daha önce burada dersin o sınıfta
  // aktif olup olmadığına göre sınıfı gizleyen iki versiyon denendi, ikisi de veri
  // seyrekliği/güvenilirliği yüzünden gerçek sınıfları kaybettirdi. Doğru çözüm sınıfı
  // gizlemek değil: seçilen sınıfta BU ders yoksa link doğrudan aynı ders slug'ına değil,
  // o sınıfta GERÇEKTEN var olan bir derse gider (varsa aynı ders, yoksa o sınıfın ilk
  // dersi) — böylece hiçbir zaman "Ders bulunamadı" ölü ucuna düşülmez.
  const { data: allGradesData } = await supabase
    .from('grades')
    .select('id, name, slug, order_no')
    .eq('is_active', true)
    .order('order_no', { ascending: true });
  const activeGradeRows = (allGradesData as { id: number; name: string; slug: string | null; order_no: number }[] | null) || [];
  const activeGradeIds = activeGradeRows.map((g) => g.id);

  const { data: gradeLessonRows } = activeGradeIds.length
    ? await supabase
        .from('lesson_grades')
        .select('grade_id, lesson_id, lessons(slug, name, is_active)')
        .in('grade_id', activeGradeIds)
        .eq('is_active', true)
    : { data: [] as { grade_id: number; lesson_id: number; lessons: { slug: string | null; name: string; is_active: boolean } | { slug: string | null; name: string; is_active: boolean }[] | null }[] };

  type GradeLessonRow = { grade_id: number; lesson_id: number; lessons: { slug: string | null; name: string; is_active: boolean } | { slug: string | null; name: string; is_active: boolean }[] | null };
  const lessonsByGrade = new Map<number, { lessonId: number; slug: string | null; name: string }[]>();
  for (const row of ((gradeLessonRows as GradeLessonRow[] | null) || [])) {
    const lessonRow = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
    if (!lessonRow || lessonRow.is_active === false || !lessonRow.slug) continue;
    const list = lessonsByGrade.get(row.grade_id) || [];
    list.push({ lessonId: row.lesson_id, slug: lessonRow.slug, name: lessonRow.name });
    lessonsByGrade.set(row.grade_id, list);
  }
  for (const list of lessonsByGrade.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  const allGrades = activeGradeRows.map((g) => {
    const gradeLessonList = lessonsByGrade.get(g.id) || [];
    const sameLesson = gradeLessonList.find((l) => l.lessonId === lId);
    const targetLessonSlug = sameLesson?.slug ?? gradeLessonList[0]?.slug ?? null;
    return {
      id: g.id,
      name: g.name,
      slug: g.slug,
      icon: getGradeIcon(g.order_no),
      lessonSlug: targetLessonSlug,
    };
  });

  // Aynı sınıftaki diğer dersler (hızlı ders değiştirme menüsü için)
  const siblingLessonGradesQuery = supabase
    .from('lesson_grades')
    .select('lesson_id')
    .eq('grade_id', gId)
    .eq('is_active', true);
  const { data: lessonGradesData } = await siblingLessonGradesQuery;

  const siblingLessonIds = ((lessonGradesData as LessonGradeRow[] | null) || []).map((lg) => lg.lesson_id);
  let gradeLessons: GradeLessonOption[] = [];
  if (siblingLessonIds.length) {
    const { data: siblingLessonsData } = await supabase
      .from('lessons')
      .select('id, name, slug, icon, order_no')
      .in('id', siblingLessonIds)
      .eq('is_active', true)
      .order('order_no', { ascending: true });
    gradeLessons = ((siblingLessonsData as (LessonRow & { order_no: number | null })[] | null) || []).map((l) => ({
      id: l.id,
      name: l.name,
      slug: l.slug,
      icon: l.icon,
    }));
  }

  return {
    gradeId: gId.toString(),
    lessonId: lId.toString(),
    gradeName: grade.name,
    lessonName: lesson.name,
    lessonIcon: lesson.icon,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    units: unitsWithTopicCount,
    totalWeeks,
    ...(await getCurriculumCalendar(supabase)),
    gradeLessons,
    allGrades,
  };
});

export default async function LessonOverviewPage({ params }: PageProps) {
  const { gradeSlug, lessonSlug } = await params;

  const data = await getMufredatOverviewData(gradeSlug, lessonSlug);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Ders bulunamadı.</p>
      </div>
    );
  }

  // ?hafta= artık burada değil, client'ta (useSearchParams ile) okunuyor — bkz. dosya
  // başındaki not. Burada sadece o parametre YOKSA kullanılacak varsayılanı hesaplıyoruz.
  const hafta = getCurrentCurriculumWeek(data.totalWeeks, data.termStartDate, data.breaks);

  return (
    <MufredatOverviewClient
      gradeName={data.gradeName}
      lessonName={data.lessonName}
      lessonIcon={data.lessonIcon}
      gradeSlug={data.gradeSlug}
      lessonSlug={data.lessonSlug}
      gradeId={data.gradeId}
      lessonId={data.lessonId}
      units={data.units}
      currentWeek={hafta}
      totalWeeks={data.totalWeeks}
      gradeLessons={data.gradeLessons}
      allGrades={data.allGrades}
    />
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gradeSlug, lessonSlug } = await params;
  const data = await getMufredatOverviewData(gradeSlug, lessonSlug);

  if (!data) {
    return { title: 'Ders Bulunamadı' };
  }

  // Başlık/açıklamaya "Yeni Müfredat" ifadesi HER sınıf/ders için eklendi (kullanıcının
  // 2026-09-06 isteği, SEO amaçlı — bkz. Mufredatoverviewclient.tsx'teki aynı H1 değişikliği).
  const unitTitles = data.units.map((u) => u.title).join(', ');
  const title = `${data.gradeName} ${data.lessonName} Yeni Müfredat Konuları ve Üniteler`;
  const description = unitTitles
    ? `${data.gradeName} ${data.lessonName} yeni müfredatına göre üniteler: ${unitTitles}. Konu anlatımları ve testlerle çalış.`
    : `${data.gradeName} ${data.lessonName} yeni müfredatına göre konu anlatımları ve testleri.`;
  const canonicalPath = `/${data.gradeSlug}/${data.lessonSlug}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: canonicalPath },
  };
}