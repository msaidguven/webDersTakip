import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { fetchLessonTymmTopics } from '@/app/src/lib/tymm/fetchLessonTymmTopics';

// SADECE OKUMA — Konu Yönetimi panelinin "TYMM'deki güncel konular" referans listesi için.
// DB'ye hiçbir şey yazmaz, sadece TYMM'in canlı sayfasını çekip başlıkları döner.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { lessonId?: unknown; gradeId?: unknown } | null;
  const lessonId = typeof body?.lessonId === 'number' ? body.lessonId : Number(body?.lessonId);
  const gradeId = typeof body?.gradeId === 'number' ? body.gradeId : Number(body?.gradeId);
  if (!Number.isInteger(lessonId) || !Number.isInteger(gradeId)) {
    return NextResponse.json({ ok: false, error: 'Geçersiz istek' }, { status: 400 });
  }

  const result = await fetchLessonTymmTopics(lessonId, gradeId);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
