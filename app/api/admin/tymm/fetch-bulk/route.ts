import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { discoverTymmUnitLinks } from '@/app/src/lib/tymm/discoverUnits';
import { fetchTymmUnit } from '@/app/src/lib/tymm/fetchTymmUnit';
import { buildTymmTopicDiffs } from '@/app/src/lib/tymm/buildTopicDiffs';

// SADECE ÇEKME (yazma yok): bir "ders/sınıf" TYMM sayfasındaki tüm ünite linklerini bulur,
// her birini ayrı ayrı çekip ayrıştırır — hiçbiri DB'ye yazılmaz. Admin listeyi görüp
// ünite ünite düzeltip onaylayarak /api/admin/tymm/save ile tek tek kaydeder (ya da "Yeni
// Yıllık Plan Ekle" modunda hepsini birden).
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { pageUrl?: unknown; lessonId?: unknown; gradeId?: unknown } | null;
  const pageUrl = typeof body?.pageUrl === 'string' ? body.pageUrl.trim() : '';
  if (!pageUrl) return NextResponse.json({ error: 'pageUrl zorunlu' }, { status: 400 });
  const lessonId = typeof body?.lessonId === 'number' ? body.lessonId : null;
  const gradeId = typeof body?.gradeId === 'number' ? body.gradeId : null;

  const discovered = await discoverTymmUnitLinks(pageUrl);
  if (!discovered.ok) return NextResponse.json({ error: discovered.error }, { status: 400 });

  const results = await Promise.all(
    discovered.units.map(async (u) => {
      const fetched = await fetchTymmUnit(u.url);
      if (!fetched.ok) return { url: u.url, title: u.title, ok: false as const, error: fetched.error };
      // Tek ünite akışıyla (fetch/route.ts) AYNI konu bazlı fark özeti — "Karşılaştır ve
      // Onayla" toplu akışta da gerçek bir eski|yeni karşılaştırması göstersin diye
      // (kullanıcının 2026-09-22 bulduğu bug: bu hesap toplu akışta hiç yapılmıyordu, admin
      // direkt kaydet ekranına düşüyordu, hiçbir şey karşılaştıramıyordu).
      const topicDiffs = lessonId != null && gradeId != null ? await buildTymmTopicDiffs(fetched.result.unit, lessonId, gradeId) : undefined;
      return {
        url: u.url,
        title: u.title,
        ok: true as const,
        unit: fetched.result.unit,
        unmatchedLines: fetched.result.unmatchedLines,
        boundaryWarnings: fetched.result.boundaryWarnings,
        rawSections: fetched.result.rawSections,
        topicDiffs,
      };
    })
  );

  return NextResponse.json({ unitsFound: discovered.units.length, results });
}
