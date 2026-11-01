import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { hydrateLesson } from '@/app/src/lib/interactiveLesson/hydrate';

// Etkileşimli ders (yalnızca admin önizlemesi): ders tanımı + soru adımları havuzdaki sorularla doldurulmuş.
// Soru motoruyla (QuizClient) aynı model: anında dönüt için doğru şık istemciye gider; kayıt yapılmaz.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = Number(request.nextUrl.searchParams.get('topicId'));
  if (!Number.isInteger(topicId) || topicId <= 0) {
    return NextResponse.json({ error: 'Geçersiz konu' }, { status: 400 });
  }
  const result = await hydrateLesson(topicId);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.lesson);
}
