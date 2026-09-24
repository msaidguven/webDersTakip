import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { compareLessonTopics } from '@/app/src/lib/tymm/compareTopicsOnly';

// SADECE OKUMA: bir ders/sınıfın DB'deki konu BAŞLIKLARINI, TYMM'in güncel (tüm üniteler
// birleşimi) konu başlıklarıyla kıyaslar — hiçbir şey yazmaz. Bkz. compareTopicsOnly.ts.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { lessonId?: unknown; gradeId?: unknown } | null;
  const lessonId = typeof body?.lessonId === 'number' ? body.lessonId : null;
  const gradeId = typeof body?.gradeId === 'number' ? body.gradeId : null;
  if (!lessonId || !gradeId) return NextResponse.json({ ok: false, error: 'lessonId ve gradeId zorunlu' }, { status: 400 });

  const result = await compareLessonTopics(lessonId, gradeId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
