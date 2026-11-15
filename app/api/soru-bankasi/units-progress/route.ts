// app/api/soru-bankasi/units-progress/route.ts
// Soru bankası ders sayfasındaki ünite kartlarının ilerleme çubuğu (bkz. SoruBankasiLessonUnits.tsx):
// dersin TÜM ünitelerini tek istekte döner. Önceden ünite başına ayrı unit-status çağrısı vardı —
// 7 üniteli ders = sayfa açılışı başına 7 fonksiyon (2026-11-15 Vercel CPU ölçümü). Yalnız girişli
// kullanıcı çağırır; misafirde ilerleme gösterilmediği için istemci hiç istek atmaz.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUnitQuestionPoolIds } from '@/app/src/lib/quizQuestions';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getUnitProgress } from '@/app/src/lib/soruBankasiStatus';

const MAX_UNITS = 30;

export async function GET(request: NextRequest) {
  const unitIds = [
    ...new Set(
      (request.nextUrl.searchParams.get('unitIds') || '')
        .split(',')
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ].slice(0, MAX_UNITS);
  if (!unitIds.length) {
    return NextResponse.json({ error: 'unitIds gerekli' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ units: {} });

  const serviceClient = createServiceClient();
  const entries = await Promise.all(
    unitIds.map(async (unitId) => [unitId, await getUnitProgress(serviceClient, user.id, await getUnitQuestionPoolIds(serviceClient, unitId))] as const)
  );
  return NextResponse.json({ units: Object.fromEntries(entries) });
}
