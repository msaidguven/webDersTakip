import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { getCachedLesson, hydrateLesson } from '@/app/src/lib/interactiveLesson/hydrate';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Etkileşimli ders (herkese açık, 2026-11-03): ders tanımı + soru adımları havuzdaki sorularla doldurulmuş. Soru
// motoruyla (QuizClient) aynı model: anında dönüt için doğru şık istemciye gider; ders hiçbir sonuç kaydetmez.
// Sunucu önbelleğinden gelir; push ya da içerik değişince yenilenir (hydrate.ts getCachedLesson). Yalnız sesleri tamamlanmış dersler.
// Adminler için ?preview=1 (sesi henüz üretilmemiş status='ready' dersleri açar) ve ?check=1 (buton görünürlüğü) desteklenir.
export async function GET(request: NextRequest) {
  const topicId = Number(request.nextUrl.searchParams.get('topicId'));
  if (!Number.isInteger(topicId) || topicId <= 0) {
    return NextResponse.json({ error: 'Geçersiz konu' }, { status: 400 });
  }

  const isCheck = request.nextUrl.searchParams.get('check') === '1';
  const isPreview = request.nextUrl.searchParams.get('preview') === '1';

  if (isCheck || isPreview) {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;

    if (isCheck) {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from('interactive_lessons')
        .select('topic_id, voice_done')
        .eq('topic_id', topicId)
        .eq('status', 'ready')
        .maybeSingle();
      return NextResponse.json({
        available: Boolean(data),
        voiceDone: Boolean((data as { voice_done?: boolean } | null)?.voice_done),
      });
    }

    try {
      const result = await hydrateLesson(topicId, { includeUnvoiced: true });
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json(result.lesson);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Yüklenemedi' }, { status: 500 });
    }
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
