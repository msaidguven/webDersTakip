import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { saveTymmUnit } from '@/app/src/lib/tymm/importUnit';
import type { TymmUnit } from '@/app/src/lib/tymm/tymmParser';

// DB'YE YAZAN tek adım: admin'in /api/admin/tymm/fetch(-bulk) ile önizleyip elle
// düzeltmiş olabileceği ünite verisini olduğu gibi kaydeder — kendisi TYMM'e hiç istek
// atmaz. Bilerek her ünite için ayrı ve admin'in tıkladığı bir istek: otomatik toplu
// kaydetme yok (bkz. proje sohbeti: aynı ünitenin iki kez otomatik kaydedilip mükerrer
// kazanım oluşturduğu olay).
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as
    | { unit?: unknown; gradeId?: unknown; lessonId?: unknown; curriculumYear?: unknown }
    | null;
  const unit = body?.unit as TymmUnit | undefined;
  const gradeId = Number(body?.gradeId);
  const lessonId = Number(body?.lessonId);
  const curriculumYear = typeof body?.curriculumYear === 'string' && body.curriculumYear.trim() ? body.curriculumYear.trim() : null;

  if (!unit || !unit.unitTitle || !Array.isArray(unit.learningOutcomes) || !Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'unit, gradeId, lessonId zorunlu' }, { status: 400 });
  }

  const result = await saveTymmUnit({ unit, gradeId, lessonId, curriculumYear });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
