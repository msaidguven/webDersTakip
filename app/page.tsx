//app/page.tsx

import { createAnonClient } from '@/utils/supabase/server-anon';
import HomeClient from './HomeClient';
import { Grade } from './src/models/homeTypes';
import { getGradeColor, getGradeDescription, getGradeIcon } from './src/lib/homeMapping';
import { getSiteStats, getHomeGradeSections, getWeeklyTopicsForGrade, getPublishedUnitContent, type HomeGradeSection, type WeeklyTopicItem } from './src/lib/homeStats';

// ISR: taze veri gerektiren admin ayrımı yok (tamamen public), bu yüzden 1 saatlik
// fallback yeterli — içerik yayınlandığında/soru eklendiğinde zaten admin endpoint'leri
// revalidateHomepage() ile bu sayfayı anında tazeliyor (bkz. topicPageRevalidation.ts).
export const revalidate = 3600;

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

  const [gradeSectionsMap, weeklyTopicsEntries] = await Promise.all([
    getHomeGradeSections(supabase, rows.map((r) => ({ id: r.id, slug: r.slug })), publishedUnitsAll),
    Promise.all(rows.map(async (r) => [r.id, await getWeeklyTopicsForGrade(supabase, r.id, r.slug)] as const)),
  ]);

  const stats = getSiteStats(gradeIds, publishedUnitsAll);

  const gradeSections: Record<string, HomeGradeSection> = {};
  for (const [id, section] of gradeSectionsMap) gradeSections[String(id)] = section;

  const weeklyTopics: Record<string, WeeklyTopicItem[]> = {};
  for (const [id, topics] of weeklyTopicsEntries) weeklyTopics[String(id)] = topics;

  return <HomeClient initialGrades={grades} stats={stats} gradeSections={gradeSections} weeklyTopics={weeklyTopics} />;
}
