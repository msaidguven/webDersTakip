import { MetadataRoute } from 'next';
import { createPublicClient } from '@/utils/supabase/public';
import { SITE_URL } from '@/app/src/lib/site';

export const revalidate = 3600;

type GradeRow = { id: number; slug: string | null };
type LessonRow = { id: number; slug: string | null };
type LessonGradeRow = { lesson_id: number; grade_id: number };
type UnitRow = { id: number; slug: string | null; lesson_id: number; grade_id: number };
type TopicRow = { id: number; slug: string | null; unit_id: number };
type QuestionRow = { id: number; topic_id: number | null };

const excludedSitemapUrls = new Set([
  `${SITE_URL}/5-sinif/fen-bilimleri/isigin-dunyasi/fb-5-4-3-tam-golgenin-olusumu`,
]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/hakkimizda`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/iletisim`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/gizlilik-politikasi`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const supabase = createPublicClient();

    const [
      { data: gradesData },
      { data: lessonsData },
      { data: lessonGradesData },
      { data: unitsData },
      { data: topicsData },
    ] = await Promise.all([
      supabase.from('grades').select('id, slug').eq('is_active', true),
      supabase.from('lessons').select('id, slug').eq('is_active', true),
      supabase.from('lesson_grades').select('lesson_id, grade_id').eq('is_active', true),
      supabase.from('units').select('id, slug, lesson_id, grade_id').eq('is_active', true),
      supabase.from('topics').select('id, slug, unit_id').eq('is_active', true),
    ]);

    const grades = (gradesData as GradeRow[] | null) || [];
    const lessons = (lessonsData as LessonRow[] | null) || [];
    const lessonGrades = (lessonGradesData as LessonGradeRow[] | null) || [];
    const units = (unitsData as UnitRow[] | null) || [];
    const topics = (topicsData as TopicRow[] | null) || [];

    // Ünite testi ve konu kavrama testi sayfaları (ve sitemap girdileri) yalnızca en az
    // bir sorusu olan ünite/konularda gösterilmeli; boş bir testi listelemek 404'e/boş
    // sayfaya götürür. Bağlantı doğrudan questions.topic_id üzerinden (bkz.
    // add_question_scope_and_source.sql) — tek sorgu hem ünite hem konu kontrolünde
    // aşağıda tekrar kullanılıyor.
    const unitIdByTopicId = new Map(topics.map((t) => [t.id, t.unit_id]));
    const topicIds = topics.map((t) => t.id);
    const unitIdsWithQuestions = new Set<number>();
    const topicIdsWithQuestions = new Set<number>();
    if (topicIds.length) {
      const { data: questionsData } = await supabase
        .from('questions')
        .select('id, topic_id')
        .in('topic_id', topicIds);
      for (const q of (questionsData as QuestionRow[] | null) || []) {
        if (q.topic_id == null) continue;
        topicIdsWithQuestions.add(q.topic_id);
        const unitId = unitIdByTopicId.get(q.topic_id);
        if (unitId != null) unitIdsWithQuestions.add(unitId);
      }
    }

    const gradeSlugById = new Map(grades.filter((g) => g.slug).map((g) => [g.id, g.slug as string]));
    const lessonSlugById = new Map(lessons.filter((l) => l.slug).map((l) => [l.id, l.slug as string]));
    // Bir ünite kendi is_active'i true olsa bile, bağlı olduğu ders bu sınıf için
    // yayından kaldırılmışsa (lesson_grades.is_active=false) sitemap'te görünmemeli —
    // yoksa gerçek sayfa 404 verirken sitemap o URL'i listelemeye devam eder.
    const publishedLessonGradeKeys = new Set(lessonGrades.map((lg) => `${lg.lesson_id}:${lg.grade_id}`));

    for (const g of grades) {
      if (g.slug) entries.push({ url: `${SITE_URL}/${g.slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 });
    }

    for (const lg of lessonGrades) {
      const gradeSlug = gradeSlugById.get(lg.grade_id);
      const lessonSlug = lessonSlugById.get(lg.lesson_id);
      if (gradeSlug && lessonSlug) {
        entries.push({
          url: `${SITE_URL}/${gradeSlug}/${lessonSlug}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.85,
        });
      }
    }

    const unitPathById = new Map<number, { gradeSlug: string; lessonSlug: string; unitSlug: string }>();
    for (const u of units) {
      if (!publishedLessonGradeKeys.has(`${u.lesson_id}:${u.grade_id}`)) continue;
      const gradeSlug = gradeSlugById.get(u.grade_id);
      const lessonSlug = lessonSlugById.get(u.lesson_id);
      if (gradeSlug && lessonSlug && u.slug) {
        unitPathById.set(u.id, { gradeSlug, lessonSlug, unitSlug: u.slug });
        if (unitIdsWithQuestions.has(u.id)) {
          entries.push({
            url: `${SITE_URL}/${gradeSlug}/${lessonSlug}/${u.slug}/unite-testi`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.65,
          });
        }
      }
    }

    const topicPathById = new Map<number, string>();
    for (const t of topics) {
      const unitPath = unitPathById.get(t.unit_id);
      if (unitPath && t.slug) {
        topicPathById.set(t.id, `${unitPath.gradeSlug}/${unitPath.lessonSlug}/${unitPath.unitSlug}/${t.slug}`);
        entries.push({
          url: `${SITE_URL}/${unitPath.gradeSlug}/${unitPath.lessonSlug}/${unitPath.unitSlug}/${t.slug}`,
          lastModified: now,
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    }

    // Konu kavrama testi sayfası (alt başlıklar + konu geneli, questions.topic_id tek
    // kaynak) yalnızca gerçekten sorusu olan konularda gösterilmeli.
    for (const [topicId, topicPath] of topicPathById) {
      if (!topicIdsWithQuestions.has(topicId)) continue;
      entries.push({
        url: `${SITE_URL}/${topicPath}/kavrama-testi`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.55,
      });
    }
  } catch (error) {
    console.error('[sitemap] Dinamik URL üretimi başarısız:', error);
  }

  return entries.filter((entry) => !excludedSitemapUrls.has(entry.url));
}
