// app/[gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]/page.tsx
// Konu okuma sayfası — ünite ve konu, haftaya göre değil doğrudan slug'a göre bulunur.

import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { parseGradeSegment, getCurrentCurriculumWeek } from '@/app/src/lib/routeParsing';
import { getLessonWeekData } from '@/app/src/lib/lessonWeekData';
import { getCurriculumCalendar } from '@/app/src/lib/curriculumCalendar';
import { SITE_URL, stripHtml } from '@/app/src/lib/site';
import DersClient from '../../../../ders/DersClient';

// Bu sayfa artık taslak/admin önizlemesi göstermiyor (o iş /ders?... + admin paneli
// üzerinden yapılıyor) — yani her zaman herkese aynı, tamamen public içerik döner. Bu
// sayede ISR ile cache'lenebiliyor: saatlik fallback + admin bir konuyu düzenlediğinde
// ilgili sayfanın anında güncellenmesi için revalidateTopicPage/revalidateUnitPages
// (bkz. app/src/lib/topicPageRevalidation.ts) admin kayıt endpoint'lerinden çağrılıyor.
export const revalidate = 3600;

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  topicSlug: string;
}

// ÖNEMLİ: Bu projedeki Next.js 16.1.6 kurulumunda, generateStaticParams tanımlı
// OLMAYAN dinamik segmentli sayfalar hiçbir zaman ISR cache'ine girmiyor —
// yukarıdaki revalidate ayarı sessizce yok sayılıyor (her istek "Cache-Control:
// no-store" ile geliyor). Boş bir generateStaticParams bile bu davranışı düzeltip
// ilk ziyaretten sonra sayfanın gerçekten cache'lenmesini sağlıyor (dynamicParams
// varsayılan olarak true olduğu için burada listelenmeyen slug'lar da normal
// şekilde ilk istekte üretilip cache'e alınıyor). İleride en çok görüntülenen
// konuları burada döndürerek deploy anında build-time prerender de yapılabilir.
export async function generateStaticParams(): Promise<Params[]> {
  return [];
}

interface PageProps {
  params: Promise<Params>;
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
type GradeRow = { id: number; name: string; slug: string | null };
type LessonRow = { id: number; name: string; slug: string | null };

function buildTopicPath(data: NonNullable<Awaited<ReturnType<typeof getTopicPageData>>>) {
  return `/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}/${data.topicSlug}`;
}

function buildBreadcrumbJsonLd(data: NonNullable<Awaited<ReturnType<typeof getTopicPageData>>>) {
  const topicPath = buildTopicPath(data);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: data.gradeName, item: `${SITE_URL}/${data.gradeSlug}` },
      { '@type': 'ListItem', position: 3, name: data.lessonName, item: `${SITE_URL}/${data.gradeSlug}/${data.lessonSlug}` },
      { '@type': 'ListItem', position: 4, name: data.unitName, item: `${SITE_URL}/${data.gradeSlug}/${data.lessonSlug}#${data.unitSlug}` },
      { '@type': 'ListItem', position: 5, name: data.topicTitle, item: `${SITE_URL}${topicPath}` },
    ],
  };
}

type Supabase = ReturnType<typeof createAnonClient>;

async function resolveGrade(supabase: Supabase, decodedGradeSlug: string): Promise<GradeRow | null> {
  const { data: gradeBySlug } = await supabase
    .from('grades')
    .select('id, name, slug')
    .eq('slug', decodedGradeSlug)
    .maybeSingle();
  if (gradeBySlug) return gradeBySlug as GradeRow;

  const gradeOrderNo = parseGradeSegment(decodedGradeSlug);
  const gradeId = Number(decodedGradeSlug);
  const gradeQueryValue = gradeOrderNo ?? (Number.isFinite(gradeId) ? gradeId : null);
  if (!gradeQueryValue) return null;

  const { data: gradeByFallback } = await supabase
    .from('grades')
    .select('id, name, slug')
    .eq(gradeOrderNo ? 'order_no' : 'id', gradeQueryValue)
    .maybeSingle();
  return gradeByFallback as GradeRow | null;
}

async function resolveLesson(supabase: Supabase, decodedLessonSlug: string): Promise<LessonRow | null> {
  const { data: lessonBySlug } = await supabase
    .from('lessons')
    .select('id, name, slug')
    .eq('slug', decodedLessonSlug)
    .maybeSingle();
  if (lessonBySlug) return lessonBySlug as LessonRow;

  const lessonId = Number(decodedLessonSlug);
  if (!Number.isFinite(lessonId)) return null;

  const { data: lessonById } = await supabase
    .from('lessons')
    .select('id, name, slug')
    .eq('id', lessonId)
    .maybeSingle();
  return lessonById as LessonRow | null;
}

// "Ünite Testi" bağlantısı yalnızca gerçekten sorusu olan ünitelerde gösterilmeli; sidebar
// üzerinden ünite değiştirmek sayfayı yeniden yüklemediği için bunu tüm üniteler için tek
// seferde (topics -> questions.topic_id) hesaplayıp Unit'e ekliyoruz. Admin için buton
// yanında gerçek soru sayısını da göstermek üzere ayrıca sayıyoruz.
async function computeQuestionCountByUnit(supabase: Supabase, units: UnitRow[]): Promise<Map<number, number>> {
  const questionCountByUnit = new Map<number, number>();
  const unitIds = units.map((u) => u.id);
  if (!unitIds.length) return questionCountByUnit;

  const { data: allTopicsData } = await supabase
    .from('topics')
    .select('id, unit_id')
    .in('unit_id', unitIds)
    .eq('is_active', true);
  const unitIdByTopicId = new Map(((allTopicsData as { id: number; unit_id: number }[] | null) || []).map((t) => [t.id, t.unit_id]));
  const topicIds = Array.from(unitIdByTopicId.keys());
  if (!topicIds.length) return questionCountByUnit;

  const { data: questionsData } = await supabase
    .from('questions')
    .select('id, topic_id')
    .in('topic_id', topicIds)
    .eq('is_active', true);
  for (const q of (questionsData as { id: number; topic_id: number }[] | null) || []) {
    const unitId = unitIdByTopicId.get(q.topic_id);
    if (unitId == null) continue;
    questionCountByUnit.set(unitId, (questionCountByUnit.get(unitId) ?? 0) + 1);
  }
  return questionCountByUnit;
}

type GradeLessonRow = { id: number; name: string; slug: string | null; icon: string | null };

// Konu sayfasındaki yeni "Ders Değiştir" dropdown'u için — o sınıftaki TÜM aktif dersler.
// Öğrenci sayfadan hiç çıkmadan başka bir derse geçebilsin diye (bkz. kullanıcının
// 2026-09-05 isteği: "koca sayfada hangi ders belli değil, hızlı ders/ünite değiştirebilse iyi olur").
async function fetchGradeLessons(supabase: Supabase, gradeId: number): Promise<GradeLessonRow[]> {
  const { data } = await supabase
    .from('lesson_grades')
    .select('lesson_id, lessons(id, name, slug, icon, is_active)')
    .eq('grade_id', gradeId)
    .eq('is_active', true);

  type Row = { lesson_id: number; lessons: GradeLessonRow & { is_active: boolean } | (GradeLessonRow & { is_active: boolean })[] | null };
  const lessons: GradeLessonRow[] = [];
  for (const row of ((data as Row[] | null) || [])) {
    const lessonRow = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
    if (!lessonRow || lessonRow.is_active === false) continue;
    lessons.push({ id: lessonRow.id, name: lessonRow.name, slug: lessonRow.slug, icon: lessonRow.icon });
  }
  lessons.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  return lessons;
}

function normalizeDescription(text: string, maxLength = 158) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const sliced = clean.slice(0, maxLength - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${sliced.slice(0, lastSpace > 120 ? lastSpace : sliced.length).trimEnd()}…`;
}

function buildMetaDescription(data: NonNullable<Awaited<ReturnType<typeof getTopicPageData>>>, bodyText: string | null) {
  const prefix = `${data.topicTitle} konusu; ${data.gradeName} ${data.lessonName} ${data.unitName} ünitesi için`;
  const detail = bodyText
    ? ` ${bodyText}`
    : ' konu anlatımı, örnekler ve interaktif alıştırmalarla öğrenmeyi destekler.';
  return normalizeDescription(`${prefix}${detail}`);
}

const getTopicPageData = cache(async function getTopicPageData(gradeSlug: string, lessonSlug: string, unitSlug: string, topicSlug: string) {
  const supabase = createAnonClient();

  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();
  const decodedLessonSlug = decodeURIComponent(lessonSlug || '').trim();
  const decodedUnitSlug = decodeURIComponent(unitSlug || '').trim();
  const decodedTopicSlug = decodeURIComponent(topicSlug || '').trim();

  // Sınıf, ders ve müfredat takvimi birbirinden BAĞIMSIZ — art arda (sıralı) değil
  // paralel çekiyoruz. Bu tek değişiklik, sayfa açılışındaki ~13 ardışık Supabase
  // round-trip'ini birkaç paralel dalgaya indirerek asıl yavaşlığın kaynağını (round-trip
  // SAYISI, veri boyutu değil) hedefliyor — bkz. getLessonWeekData'daki activeTopic notu.
  const [grade, lesson, calendar] = await Promise.all([
    resolveGrade(supabase, decodedGradeSlug),
    resolveLesson(supabase, decodedLessonSlug),
    getCurriculumCalendar(supabase),
  ]);

  if (!grade || !lesson) {
    return null;
  }

  const gId = grade.id;
  const lId = lesson.id;

  // Bu sayfa artık taslak göstermiyor: is_active/is_published filtreleri koşulsuz
  // uygulanır (admin dahil kimse taslağı buradan göremez — önizleme /ders?... üzerinden).
  const unitsQuery = supabase
    .from('units')
    .select('id, title, slug, order_no, start_week, end_week, is_active')
    .eq('lesson_id', lId)
    .eq('grade_id', gId)
    .eq('is_active', true)
    .order('order_no', { ascending: true });

  // lesson_grades ve units de birbirinden bağımsız — ikisi de sadece gId/lId'ye bağlı.
  const [{ data: lessonGradeData }, { data: unitsData }] = await Promise.all([
    supabase
      .from('lesson_grades')
      .select('is_active')
      .eq('lesson_id', lId)
      .eq('grade_id', gId)
      .maybeSingle(),
    unitsQuery,
  ]);

  if ((lessonGradeData as { is_active: boolean } | null)?.is_active === false) {
    return null;
  }

  const units = (unitsData as UnitRow[] | null) || [];

  const activeUnit = units.find((u) => u.slug === decodedUnitSlug) ?? null;
  if (!activeUnit) {
    return null;
  }

  const totalWeeks = (() => {
    const maxFromUnits = units.reduce((max, u) => Math.max(max, u.end_week ?? u.start_week ?? 0), 0);
    return Math.max(1, Math.min(52, maxFromUnits || 30));
  })();

  // Görüntüleme/ilerleme amaçlı temsili hafta: ünitenin haftaya denk gelen aralığı
  const unitStart = activeUnit.start_week ?? 1;
  const unitEnd = activeUnit.end_week ?? totalWeeks;
  const { termStartDate, termEndDate, breaks } = calendar;
  const suggestedWeek = getCurrentCurriculumWeek(totalWeeks, termStartDate, breaks);
  const week = Math.min(unitEnd, Math.max(unitStart, suggestedWeek));

  // Soru sayacı (tüm üniteler, "Ünite Testi" butonu için) ile aktif konunun içeriği de
  // birbirinden bağımsız — paralel çekiyoruz. Konu içeriğini (alt başlıklar, ders notu,
  // kazanımlar) SUNUCU tarafında çekiyoruz ki Google ve diğer arama motorları sayfayı ilk
  // yüklemede tam içerikle görsün. Ünitedeki diğer konuların ağır içeriğini burada
  // ÇEKMİYORUZ — sadece açılan konu (decodedTopicSlug) tam yüklenir, diğerleri sidebar
  // için hafif kalır ve client tarafında ihtiyaç oldukça (DersClient ->
  // ensureTopicContentLoaded) yüklenir.
  const [questionCountByUnit, { outcomes, contents }, gradeLessons] = await Promise.all([
    computeQuestionCountByUnit(supabase, units),
    getLessonWeekData(supabase, activeUnit.id, week, false, { slug: decodedTopicSlug }),
    fetchGradeLessons(supabase, gId),
  ]);

  const unitsWithQuestionFlag = units.map((u) => {
    const testQuestionCount = questionCountByUnit.get(u.id) ?? 0;
    return { ...u, has_questions: testQuestionCount > 0, test_question_count: testQuestionCount };
  });

  const activeTopic = contents.find((c) => c.slug === decodedTopicSlug) ?? null;
  if (!activeTopic) {
    return null;
  }

  return {
    gradeId: gId.toString(),
    lessonId: lId.toString(),
    gradeName: grade.name,
    lessonName: lesson.name,
    unitName: activeUnit.title,
    outcomes,
    contents,
    units: unitsWithQuestionFlag,
    gradeLessons,
    totalWeeks,
    week,
    termStartDate,
    termEndDate,
    breaks,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    unitSlug: activeUnit.slug,
    topicTitle: activeTopic.title,
    topicSlug: activeTopic.slug,
  };
});

export default async function TopicPage({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;

  const data = await getTopicPageData(gradeSlug, lessonSlug, unitSlug, topicSlug);

  if (!data) {
    notFound();
  }

  return (
    <>
      <script
        id="structured-data-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbJsonLd(data)).replace(/</g, '\\u003c'),
        }}
      />
      <DersClient
        initialData={data}
        gradeId={data.gradeId}
        lessonId={data.lessonId}
        week={data.week}
      />
    </>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;
  const data = await getTopicPageData(gradeSlug, lessonSlug, unitSlug, topicSlug);

  if (!data) {
    return { title: 'Konu Bulunamadı' };
  }

  const activeContent = data.contents.find((c) => c.slug === data.topicSlug);
  const firstSectionHtml = activeContent?.sections.find((s) => s.html)?.html || null;
  const bodyText = firstSectionHtml
    ? stripHtml(firstSectionHtml, 120)
    : activeContent?.content
      ? stripHtml(activeContent.content, 120)
      : null;
  const description = buildMetaDescription(data, bodyText);

  const title = `${data.topicTitle} — ${data.gradeName} ${data.lessonName}`;
  const canonicalPath = buildTopicPath(data);
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}
