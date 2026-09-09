import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { discoverTymmUnitLinks } from '@/app/src/lib/tymm/discoverUnits';
import { fetchTymmUnit } from '@/app/src/lib/tymm/fetchTymmUnit';
import { diffUnit, dbOnlyUnitDiffs, findDbUnitMatch, type DbUnit, type UnitDiff } from '@/app/src/lib/tymm/compareUnits';

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
    .select('id, title, duration_hours, key_concepts, topics(id, title, learning_outcome, outcomes(id, code, description))')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId);
  if (unitsError) return NextResponse.json({ error: unitsError.message }, { status: 500 });
  const dbUnits = (unitsData as unknown as DbUnit[] | null) || [];

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
    results.push(diffUnit(tymmUnit, f.url, dbMatch));
  }

  results.push(...dbOnlyUnitDiffs(dbUnits, matchedDbIds));

  return NextResponse.json({
    unitsFound: discovered.units.length,
    results,
    fetchErrors,
  });
}
