import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Bir kazanımın hangi öğretim haftası/haftalarında işlendiğini (outcome_weeks) tek bir
// aralığa sabitleyerek günceller. Var olan satır(lar) silinip yeni tek bir aralık eklenir —
// yıllık plan tekrar tekrar import edilirken bazı kazanımlarda birden fazla/çakışan satır
// birikmiş olabilir, admin panelden düzenlemek bunu da tek aralığa indirger.
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { outcomeId?: unknown; startWeek?: unknown; endWeek?: unknown } | null;
  const outcomeId = Number(body?.outcomeId);
  const startWeek = Number(body?.startWeek);
  const endWeek = Number(body?.endWeek);

  if (!Number.isFinite(outcomeId)) return NextResponse.json({ error: 'Geçersiz kazanım' }, { status: 400 });
  if (!Number.isFinite(startWeek) || startWeek < 1 || startWeek > 52) {
    return NextResponse.json({ error: 'Başlangıç haftası 1-52 arasında olmalı' }, { status: 400 });
  }
  if (!Number.isFinite(endWeek) || endWeek < startWeek || endWeek > 52) {
    return NextResponse.json({ error: 'Bitiş haftası başlangıçtan küçük olamaz (1-52 arası)' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error: deleteError } = await supabase.from('outcome_weeks').delete().eq('outcome_id', outcomeId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  const { error: insertError } = await supabase
    .from('outcome_weeks')
    .insert({ outcome_id: outcomeId, start_week: startWeek, end_week: endWeek });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
