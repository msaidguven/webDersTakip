// app/api/soru-bankasi/unit-topic-status/route.ts
// Soru bankası ünite sayfasındaki "Konu Bazlı Analizler" bölümü client-side bunu çağırır —
// sayfanın ana içeriği ISR ile statik/herkese aynı kalsın diye (SEO), kullanıcıya özel
// kısım (konu başına çözülen/doğru/yanlış) ayrı bir istek olarak geliyor (bkz.
// topic-status/unit-status route'larıyla aynı desen).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getUnitTopicStats } from '@/app/src/lib/soruBankasiStatus';

export async function GET(request: NextRequest) {
  const unitId = request.nextUrl.searchParams.get('unitId');
  const topicIdsParam = request.nextUrl.searchParams.get('topicIds');
  if (!unitId || !Number.isFinite(Number(unitId)) || !topicIdsParam) {
    return NextResponse.json({ error: 'unitId ve topicIds gerekli' }, { status: 400 });
  }
  const topicIds = topicIdsParam
    .split(',')
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  if (!topicIds.length) {
    return NextResponse.json({ error: 'geçerli topicId yok' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const serviceClient = createServiceClient();
  const topics = await getUnitTopicStats(serviceClient, user?.id ?? null, topicIds);

  return NextResponse.json({ loggedIn: !!user, topics });
}
