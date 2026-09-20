import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Admin "TYMM ile birebir eşleşmiyor ama kontrol ettim, doğru" dediğinde bir kazanımı
// karşılaştırma raporundan çıkarmak için (kullanıcının 2026-09-20 isteği). Kaldırmak
// isterse DELETE ile geri alabilir.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { outcomeId?: unknown; tymmText?: unknown } | null;
  const outcomeId = typeof body?.outcomeId === 'number' ? body.outcomeId : Number(body?.outcomeId);
  const tymmText = typeof body?.tymmText === 'string' ? body.tymmText.trim() : '';

  if (!outcomeId || !Number.isInteger(outcomeId)) {
    return NextResponse.json({ error: 'outcomeId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('outcome_tymm_overrides')
    .upsert({ outcome_id: outcomeId, tymm_text: tymmText, created_by: admin.user.id }, { onConflict: 'outcome_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const outcomeId = Number(request.nextUrl.searchParams.get('outcomeId'));
  if (!outcomeId || !Number.isInteger(outcomeId)) {
    return NextResponse.json({ error: 'outcomeId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('outcome_tymm_overrides').delete().eq('outcome_id', outcomeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
