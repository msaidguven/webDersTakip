import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getYaziliExam } from '@/app/src/lib/yazili/publicData';
import { buildPlanItems, validatePlan } from '@/app/src/lib/yazili/papers';
import { buildAttemptView, countAttemptsToday, DAILY_ATTEMPT_LIMIT, loadAttemptHistory, loadAttemptRow, loadSolvedQuestionIds } from '@/app/src/lib/yazili/attempts';

// "Yeni yazılı aç" (2026-10-26): giriş yapmış öğrenci için rastgele soruyla yazılı açar. 2026-10-28: dağılımı
// öğrenci seçer (MEB senaryosu ya da değiştirdiği hali). Senaryoya birebir uyan plan o senaryo numarasıyla,
// değiştirilmiş plan senaryosuz ("Kendi dağılımın") kaydedilir.
// Günde DAILY_ATTEMPT_LIMIT hak; açık (puanlanmamış) deneme varsa o döner, ek hak harcanmaz.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function currentUserId(): Promise<string | null> {
  const { data: { user } } = await (await createClient()).auth.getUser();
  return user?.id ?? null;
}

const slugOf = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 100 ? v : null);

// Bugünkü hak durumu + varsa açık deneme.
export async function GET(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const [sinif, ders, yazili] = [slugOf(sp.get('sinif')), slugOf(sp.get('ders')), slugOf(sp.get('yazili'))];
  if (!sinif || !ders || !yazili) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const data = await getYaziliExam(sinif, ders, yazili);
  if (!data) return NextResponse.json({ error: 'Yazılı bulunamadı' }, { status: 404 });

  const { data: open } = await createServiceClient()
    .from('yazili_attempts').select('id').eq('user_id', userId).eq('exam_id', data.exam.id).neq('status', 'graded')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  const loaded = open ? await loadAttemptRow((open as { id: number }).id) : null;
  return NextResponse.json({
    used: await countAttemptsToday(userId),
    limit: DAILY_ATTEMPT_LIMIT,
    attempt: loaded ? await buildAttemptView(loaded.attempt, loaded.answers, data) : null,
    history: await loadAttemptHistory(userId, data.exam.id),
  });
}

export async function POST(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { sinif?: unknown; ders?: unknown; yazili?: unknown; plan?: unknown } | null;
  const [sinif, ders, yazili] = [slugOf(body?.sinif), slugOf(body?.ders), slugOf(body?.yazili)];
  if (!sinif || !ders || !yazili) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const data = await getYaziliExam(sinif, ders, yazili);
  if (!data) return NextResponse.json({ error: 'Yazılı bulunamadı' }, { status: 404 });

  const raw = Array.isArray(body?.plan) ? (body.plan as unknown[]) : [];
  const parsed = raw.every((r) => Array.isArray(r) && r.length === 2 && typeof r[0] === 'string' && typeof r[1] === 'number')
    ? validatePlan(raw as [string, number][], data.loOptions)
    : null;
  if (!parsed) return NextResponse.json({ error: 'Dağılım geçersiz. Her satırda en az 1 soru olmalı, toplam en çok 15.' }, { status: 400 });

  const planMap = new Map(parsed);
  const scenario = Array.from({ length: data.scenarioCount }, (_, i) => i + 1).find((s) => {
    const rows = data.scenarios.filter((r) => r.counts[s]);
    return rows.length === planMap.size && rows.every((r) => planMap.get(r.loCode) === r.counts[s]);
  }) ?? null;
  const items = buildPlanItems(
    parsed,
    data.topics.flatMap((t) => t.questions).map((q) => ({ id: q.id, loCode: q.loCode, difficulty: q.difficulty })),
    await loadSolvedQuestionIds(userId, data.exam.id)
  );

  const { data: rpc, error } = await createServiceClient().rpc('start_yazili_attempt', {
    p_user_id: userId,
    p_exam_id: data.exam.id,
    p_scenario: scenario,
    p_variant: null,
    p_items: items.map((i) => ({ question_id: i.questionId, points: i.points })),
    p_daily_limit: DAILY_ATTEMPT_LIMIT,
  });
  const row = (rpc as { attempt_id: number | null; used_today: number; limit_reached: boolean }[] | null)?.[0];
  if (error || !row) {
    console.error('[yazili/deneme] start_yazili_attempt:', error?.message);
    return NextResponse.json({ error: 'Yazılı açılamadı' }, { status: 500 });
  }
  if (row.limit_reached || row.attempt_id == null) {
    return NextResponse.json({ error: `Bugünkü ${DAILY_ATTEMPT_LIMIT} yazılı hakkın doldu. Yarın yeniden dene.`, used: row.used_today, limit: DAILY_ATTEMPT_LIMIT }, { status: 429 });
  }

  const loaded = await loadAttemptRow(row.attempt_id);
  if (!loaded) return NextResponse.json({ error: 'Yazılı açılamadı' }, { status: 500 });
  return NextResponse.json({ used: row.used_today, limit: DAILY_ATTEMPT_LIMIT, attempt: await buildAttemptView(loaded.attempt, loaded.answers, data) });
}
