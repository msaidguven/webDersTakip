import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { discoverTymmUnitLinks } from '@/app/src/lib/tymm/discoverUnits';
import { fetchTymmUnit } from '@/app/src/lib/tymm/fetchTymmUnit';
import { diffUnit, dbOnlyUnitDiffs, findDbUnitMatch, type DbUnit, type UnitDiff, type OverrideMap } from '@/app/src/lib/tymm/compareUnits';

// SADECE OKUMA: bir ders/sınıfın TYMM sayfasındaki TÜM ünitelerini canlı çekip, aynı
// ders/sınıfın DB'deki mevcut ünite/konu/kazanımlarıyla tek seferde kıyaslar. Hiçbir şey
// yazmaz — "ne zaman/nereden yüklendiği unutulmuş" içeriğin güncel TYMM ile aynı olup
// olmadığını görmek için, admin tek tek ünite girmeden toplu fark raporu alır.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { pageUrl?: unknown; lessonId?: unknown; gradeId?: unknown } | null;
  const pageUrl = typeof body?.pageUrl === 'string' ? body.pageUrl.trim() : '';
  const lessonId = Number(body?.lessonId);
  const gradeId = Number(body?.gradeId);
  if (!pageUrl) return NextResponse.json({ error: 'pageUrl zorunlu' }, { status: 400 });
  if (!Number.isFinite(lessonId) || !Number.isFinite(gradeId)) return NextResponse.json({ error: 'lessonId ve gradeId zorunlu' }, { status: 400 });

  const discovered = await discoverTymmUnitLinks(pageUrl);
  if (!discovered.ok) return NextResponse.json({ error: discovered.error }, { status: 400 });

  const fetched = await Promise.all(
    discovered.units.map(async (u) => {
      const result = await fetchTymmUnit(u.url);
      return { url: u.url, title: u.title, result };
    })
  );

  const supabase = createServiceClient();
  const { data: unitsData, error: unitsError } = await supabase
    .from('units')
    .select(
      'id, title, duration_hours, key_concepts, ' +
        'topics(id, title, learning_outcome, outcomes(id, code, description), ' +
        'topic_learning_outcomes(id, code, title, outcomes(id, code, description)))'
    )
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    // Eski yıldan arşivlenmiş (is_current=false) kazanımlar bu karşılaştırmaya hiç girmesin —
    // aksi halde metni değişmiş eski satır DB tarafında "TYMM'de yok" gibi görünür.
    .eq('topics.outcomes.is_current', true)
    .eq('topics.topic_learning_outcomes.outcomes.is_current', true);
  if (unitsError) return NextResponse.json({ error: unitsError.message }, { status: 500 });
  // PostgREST embed'i tablo adıyla (topic_learning_outcomes) dönüyor — compareUnits.ts'nin
  // DbTopic tipiyle eşleşsin diye learningOutcomeGroups'a çeviriyoruz. Grup içindeki
  // kazanımları id'ye göre (=eklenme/orijinal sırası) sıralıyoruz — pozisyonel kıyas (bkz.
  // diffOutcomesPositional) sıraya güveniyor, PostgREST embed sırası garanti değil.
  type RawTopic = { topic_learning_outcomes?: DbUnit['topics'][number]['learningOutcomeGroups'] } & DbUnit['topics'][number];
  const dbUnits = ((unitsData as unknown as (Omit<DbUnit, 'topics'> & { topics: RawTopic[] })[] | null) || []).map((u) => ({
    ...u,
    topics: u.topics.map((t) => ({
      ...t,
      learningOutcomeGroups: (t.topic_learning_outcomes || []).map((g) => ({ ...g, outcomes: [...g.outcomes].sort((a, b) => a.id - b.id) })),
    })),
  })) as DbUnit[];

  const allOutcomeIds = dbUnits.flatMap((u) => u.topics.flatMap((t) => t.outcomes.map((o) => o.id)));
  const overrides: OverrideMap = new Map();
  if (allOutcomeIds.length) {
    const { data: overrideRows } = await supabase
      .from('outcome_tymm_overrides')
      .select('outcome_id, tymm_text')
      .in('outcome_id', allOutcomeIds);
    for (const row of (overrideRows as { outcome_id: number; tymm_text: string }[] | null) || []) {
      overrides.set(row.outcome_id, row.tymm_text);
    }
  }

  const results: UnitDiff[] = [];
  const fetchErrors: { url: string; title: string; error: string }[] = [];
  const matchedDbIds = new Set<number>();

  for (const f of fetched) {
    if (!f.result.ok) {
      fetchErrors.push({ url: f.url, title: f.title, error: f.result.error });
      continue;
    }
    const tymmUnit = f.result.result.unit;
    const dbMatch = findDbUnitMatch(dbUnits, tymmUnit.unitTitle);
    if (dbMatch) matchedDbIds.add(dbMatch.id);
    results.push(diffUnit(tymmUnit, f.url, dbMatch, overrides));
  }

  results.push(...dbOnlyUnitDiffs(dbUnits, matchedDbIds, overrides));

  return NextResponse.json({
    unitsFound: discovered.units.length,
    results,
    fetchErrors,
  });
}
