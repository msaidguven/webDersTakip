// app/api/soru-bankasi/topic-status/route.ts
// Soru bankası konu sayfasındaki "Teste Başla"/"Devam Et" kartı client-side bunu çağırır
// (bkz. TestStatusCard.tsx) — sayfanın ana içeriği ISR ile statik/herkese aynı kalsın diye
// (SEO), kullanıcıya özel kısım ayrı bir istek olarak geliyor (DersClientCards.tsx'teki
// topicCount fetch'iyle aynı desen).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getTopicQuestionPoolIds } from '@/app/src/lib/quizQuestions';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getSoruBankasiTestStatus } from '@/app/src/lib/soruBankasiStatus';

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  const unitId = request.nextUrl.searchParams.get('unitId');
  if (!topicId || !unitId || !Number.isFinite(Number(topicId)) || !Number.isFinite(Number(unitId))) {
    return NextResponse.json({ error: 'topicId ve unitId gerekli' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const serviceClient = createServiceClient();
  const questionIds = await getTopicQuestionPoolIds(serviceClient, topicId);
  const status = await getSoruBankasiTestStatus(serviceClient, user?.id ?? null, {
    unitId: Number(unitId),
    topicId: Number(topicId),
    questionIds,
  });

  return NextResponse.json(status);
}
