import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { fetchTymmUnit } from '@/app/src/lib/tymm/fetchTymmUnit';

// SADECE ÇEKME (yazma yok): tek bir TYMM ünite sayfasını çeker, ayrıştırır ve olduğu gibi
// döner — admin önizleyip düzeltebilsin diye. DB'ye kaydetme /api/admin/tymm/save ile,
// admin bu önizlemeyi elle onayladıktan sonra ayrı bir istekle yapılır.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { tymmUrl?: unknown } | null;
  const tymmUrl = typeof body?.tymmUrl === 'string' ? body.tymmUrl.trim() : '';
  if (!tymmUrl) return NextResponse.json({ error: 'tymmUrl zorunlu' }, { status: 400 });

  const fetched = await fetchTymmUnit(tymmUrl);
  if (!fetched.ok) return NextResponse.json({ error: fetched.error }, { status: 400 });

  return NextResponse.json({ unit: fetched.result.unit, unmatchedLines: fetched.result.unmatchedLines });
}
