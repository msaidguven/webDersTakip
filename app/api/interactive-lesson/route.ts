import { NextRequest, NextResponse } from 'next/server';
import { getCachedLesson } from '@/app/src/lib/interactiveLesson/hydrate';

// Etkileşimli ders (herkese açık, 2026-11-03): ders tanımı + soru adımları havuzdaki sorularla doldurulmuş. Soru
// motoruyla (QuizClient) aynı model: anında dönüt için doğru şık istemciye gider; ders hiçbir sonuç kaydetmez.
// Sunucu önbelleğinden gelir; push ya da içerik değişince yenilenir (hydrate.ts getCachedLesson). Yalnız sesleri tamamlanmış dersler.
export async function GET(request: NextRequest) {
  const topicId = Number(request.nextUrl.searchParams.get('topicId'));
  if (!Number.isInteger(topicId) || topicId <= 0) {
    return NextResponse.json({ error: 'Geçersiz konu' }, { status: 400 });
  }
  let result: Awaited<ReturnType<typeof getCachedLesson>>;
  try {
    result = await getCachedLesson(topicId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Yüklenemedi' }, { status: 500 });
  }
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.lesson);
}
