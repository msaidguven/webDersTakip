import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { discoverTymmUnitLinks } from '@/app/src/lib/tymm/discoverUnits';
import { fetchTymmUnit } from '@/app/src/lib/tymm/fetchTymmUnit';

// SADECE ÇEKME (yazma yok): bir "ders/sınıf" TYMM sayfasındaki tüm ünite linklerini bulur,
// her birini ayrı ayrı çekip ayrıştırır — hiçbiri DB'ye yazılmaz. Admin listeyi görüp
// ünite ünite düzeltip onaylayarak /api/admin/tymm/save ile tek tek kaydeder.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { pageUrl?: unknown } | null;
  const pageUrl = typeof body?.pageUrl === 'string' ? body.pageUrl.trim() : '';
  if (!pageUrl) return NextResponse.json({ error: 'pageUrl zorunlu' }, { status: 400 });

  const discovered = await discoverTymmUnitLinks(pageUrl);
  if (!discovered.ok) return NextResponse.json({ error: discovered.error }, { status: 400 });

  const results = await Promise.all(
    discovered.units.map(async (u) => {
      const fetched = await fetchTymmUnit(u.url);
      if (!fetched.ok) return { url: u.url, title: u.title, ok: false as const, error: fetched.error };
      return { url: u.url, title: u.title, ok: true as const, unit: fetched.result.unit, unmatchedLines: fetched.result.unmatchedLines };
    })
  );

  return NextResponse.json({ unitsFound: discovered.units.length, results });
}
