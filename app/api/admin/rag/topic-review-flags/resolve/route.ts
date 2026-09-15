import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Bir "Tutarsızlık Notu" veya "Doğruluk Kontrolü" bulgusunu (rag_topic_review_flags)
// gözden geçirilmiş/uygulanmış olarak işaretler — satırı silmiyoruz, kim ne zaman
// çözdüğü kalsın diye.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('rag_topic_review_flags')
    .update({ resolved_at: new Date().toISOString(), resolved_by: admin.user.id })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
