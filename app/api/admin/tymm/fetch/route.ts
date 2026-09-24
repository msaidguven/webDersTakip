import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { fetchTymmUnit } from '@/app/src/lib/tymm/fetchTymmUnit';
import { buildTymmTopicDiffs } from '@/app/src/lib/tymm/buildTopicDiffs';

// SADECE ÇEKME (yazma yok): tek bir TYMM ünite sayfasını çeker, ayrıştırır ve olduğu gibi
// döner — admin önizleyip düzeltebilsin diye. DB'ye kaydetme /api/admin/tymm/save ile,
// admin bu önizlemeyi elle onayladıktan sonra ayrı bir istekle yapılır.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { tymmUrl?: unknown; lessonId?: unknown; gradeId?: unknown } | null;
  const tymmUrl = typeof body?.tymmUrl === 'string' ? body.tymmUrl.trim() : '';
  if (!tymmUrl) return NextResponse.json({ error: 'tymmUrl zorunlu' }, { status: 400 });
  const lessonId = typeof body?.lessonId === 'number' ? body.lessonId : null;
  const gradeId = typeof body?.gradeId === 'number' ? body.gradeId : null;

  const fetched = await fetchTymmUnit(tymmUrl);
  if (!fetched.ok) return NextResponse.json({ error: fetched.error }, { status: 400 });

  // lessonId/gradeId verilmişse (admin Sınıf/Ders seçtiyse) DB ile kıyaslayıp önizleme
  // için konu bazlı fark özeti çıkar — aynı hesap app/api/admin/tymm/fetch-bulk/route.ts
  // tarafından da kullanılıyor (bkz. buildTopicDiffs.ts, kullanıcının 2026-09-22 bulduğu bug:
  // toplu akışta bu hesap hiç yapılmıyordu).
  const topicDiffs = lessonId != null && gradeId != null ? await buildTymmTopicDiffs(fetched.result.unit, lessonId, gradeId) : undefined;

  return NextResponse.json({
    unit: fetched.result.unit,
    unmatchedLines: fetched.result.unmatchedLines,
    boundaryWarnings: fetched.result.boundaryWarnings,
    rawSections: fetched.result.rawSections,
    topicDiffs,
  });
}
