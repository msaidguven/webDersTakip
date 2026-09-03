import { NextRequest, NextResponse } from 'next/server';
import { getQuestionsByIdsInTopicPool, getTopicTestQuestions } from '@/app/src/lib/quizQuestions';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  if (!topicId) {
    return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });
  }

  // ids verilmişse: sayfa SSR'da sadece ilk soruyu çözüp kalan id'leri client'a vermişti,
  // bu istek o kalan soruların içeriğini arka planda getirir (bkz. QuizClient). Kişiselleştirme
  // sorgusu tekrar çalışmaz — hangi id'lerin geleceği zaten server'da belirlenmişti.
  const idsParam = request.nextUrl.searchParams.get('ids');
  if (idsParam) {
    const ids = idsParam
      .split(',')
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    const questions = await getQuestionsByIdsInTopicPool(topicId, ids);
    return NextResponse.json({ questions });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { questions, allCaughtUp } = await getTopicTestQuestions(topicId, user?.id ?? null);

  return NextResponse.json({ questions, allCaughtUp });
}
