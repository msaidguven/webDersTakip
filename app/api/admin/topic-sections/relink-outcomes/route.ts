// Kazanımsız kalmış alt başlıkları yeniden kazanıma bağlar (bkz. relinkSectionOutcomes.ts).
// Body: { topicId?: number, force?: boolean }
//   topicId verilirse sadece o konu; verilmezse içeriği olup HİÇBİR bölümü bağlı olmayan tüm
//   konular sırayla (her biri bir Gemini çağrısı). force: bağlantıları olsa bile yeniden kur.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { findTopicsNeedingOutcomeRelink, relinkSectionOutcomes, type RelinkResult } from '@/app/src/lib/relinkSectionOutcomes';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { topicId?: number | string; force?: boolean } | null;
  const supabase = createServiceClient();

  const topicId = body?.topicId != null ? Number(body.topicId) : null;
  if (topicId != null && !Number.isInteger(topicId)) return NextResponse.json({ error: 'Geçersiz konu' }, { status: 400 });

  const topicIds = topicId != null ? [topicId] : await findTopicsNeedingOutcomeRelink(supabase);
  const results: RelinkResult[] = [];
  for (const id of topicIds) results.push(await relinkSectionOutcomes(supabase, id, { force: !!body?.force }));

  return NextResponse.json({ ok: true, results });
}
