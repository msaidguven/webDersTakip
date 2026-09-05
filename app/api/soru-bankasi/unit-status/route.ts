// app/api/soru-bankasi/unit-status/route.ts
// Soru bankası ünite sayfasındaki "Ünite Testi'ni Başlat"/"Devam Et" kartı için — kardeş
// dosya: topic-status/route.ts.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUnitQuestionPoolIds } from '@/app/src/lib/quizQuestions';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getSoruBankasiTestStatus } from '@/app/src/lib/soruBankasiStatus';

export async function GET(request: NextRequest) {
  const unitId = request.nextUrl.searchParams.get('unitId');
  if (!unitId || !Number.isFinite(Number(unitId))) {
    return NextResponse.json({ error: 'unitId gerekli' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const serviceClient = createServiceClient();
  const questionIds = await getUnitQuestionPoolIds(serviceClient, unitId);
  const status = await getSoruBankasiTestStatus(serviceClient, user?.id ?? null, {
    unitId: Number(unitId),
    topicId: null,
    questionIds,
  });

  return NextResponse.json(status);
}
