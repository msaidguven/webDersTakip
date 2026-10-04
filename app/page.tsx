//app/page.tsx

import { createAnonClient } from '@/utils/supabase/server-anon';
import HomeClient from './HomeClient';
import { getPublicWeeklyTopStudents, stripIsReal } from './src/lib/leaderboard';
import { Grade } from './src/models/homeTypes';
import { getGradeColor, getGradeDescription, getGradeIcon } from './src/lib/homeMapping';
import { getSiteStats, getHomeGradeSections, getPublishedUnitContent, getPublicMemberCount, type HomeGradeSection } from './src/lib/homeStats';
import { getDailyQuestionSet, getRecentlyPublishedTopics, getRecentlyPublishedTopicsByGrade, getThisWeekTopicsByGrade } from './src/lib/homeHighlights';

// ISR (tamamen public). 7 gün (2026-10-04, Vercel Fluid Active CPU sınırı aşıldı; eskiden 1 saat):
// içerik yayınlandığında/soru eklendiğinde admin endpoint'leri revalidateHomepage() ile sayfayı
// anında tazeliyor (bkz. topicPageRevalidation.ts). Günün Sorusu (haftanın 7 sorusundan) ve "YENİ"
// rozeti tarayıcıda hesaplandığı için günlük yenileme yok; tüm sayfalar pazar 10:00 TR'de yenilenir
// — bkz. app/src/lib/scheduledCacheRefresh.ts.
export const revalidate = 604800;

type GradeRow = { id: number; name: string; order_no: number; is_active: boolean; slug: string | null };

async function getGrades(supabase: ReturnType<typeof createAnonClient>): Promise<{ grades: Grade[]; rows: GradeRow[] }> {
  const { data, error } = await supabase
    .from('grades')
    .select('id, name, order_no, is_active, slug')
    .eq('is_active', true)
    .order('order_no', { ascending: true });

  if (error) {
    console.error('[getGrades] HATA:', error);
    return { grades: [], rows: [] };
  }

  const rows = (data as GradeRow[] | null) || [];
  const grades = rows.map((g) => ({
    id: g.id.toString(),
    level: g.order_no,
    name: g.name,
    slug: g.slug || `${g.order_no}-sinif`,
    description: getGradeDescription(g.order_no),
    icon: getGradeIcon(g.order_no),
    color: getGradeColor(g.order_no),
  }));

  return { grades, rows };
}

export default async function HomePage() {
  const supabase = createAnonClient();
  const { grades, rows } = await getGrades(supabase);
  const gradeIds = rows.map((r) => r.id);

  // publishedUnitsAll, hem istatistik sayaçları hem ders kartları için ORTAK girdi —
  // eskiden ikisi de bu ünite/konu/soru taramasını AYRI AYRI yapıyordu (aynı sorgular
  // iki kere atılıyordu); tek seferde hesaplayıp ikisine de paylaştırıyoruz. Haftanın
  // konuları da stats/gradeSections'a bağlı olmadığı için aynı Promise.all'a alındı.
  const publishedUnitsAll = await getPublishedUnitContent(supabase, gradeIds);

  // Anasayfanın "canlı" bölümleri (Günün Sorusu, Okulda bu hafta, Yeni eklenenler — bkz.
  // homeHighlights.ts) diğer sorgularla paralel; hepsi anon client, sayfa ISR'da kalır.
  const [gradeSectionsMap, memberCount, topStudents, dailyQuestionSet, recentTopics, recentByGrade, thisWeek] = await Promise.all([
    getHomeGradeSections(supabase, rows.map((r) => ({ id: r.id, slug: r.slug })), publishedUnitsAll),
    getPublicMemberCount(supabase),
    getPublicWeeklyTopStudents(supabase),
    getDailyQuestionSet(supabase),
    getRecentlyPublishedTopics(supabase),
    // Girişli öğrenci sadece kendi sınıfının son 5 konusunu görür (2026-10-02).
    getRecentlyPublishedTopicsByGrade(supabase, gradeIds),
    getThisWeekTopicsByGrade(supabase),
  ]);

  const stats = getSiteStats(gradeIds, publishedUnitsAll, memberCount);

  const gradeSections: Record<string, HomeGradeSection> = {};
  for (const [id, section] of gradeSectionsMap) gradeSections[String(id)] = section;

  return <HomeClient initialGrades={grades} stats={stats} gradeSections={gradeSections} topStudents={stripIsReal(topStudents)} dailyQuestionSet={dailyQuestionSet} recentTopics={recentTopics} recentByGrade={recentByGrade} thisWeek={thisWeek} />;
}
