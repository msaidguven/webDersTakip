import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

interface Params {
  draftId: string;
}

// Taslağın DURUMUNU günceller — sorular BURADAN kaydedilmez, admin tuttuğu soruları
// normal /api/admin/topic-sections/section/[sectionId]/questions rotasına (mevcut AI
// soru üretim akışıyla AYNI endpoint) kendisi gönderir.
//
// ÖNEMLİ (kullanıcının 2026-09-08 bulduğu bug: "2 defa kaydet dedim, sorular tekrarlı
// kaydedildi"): mark_saved/mark_saved_want_more için bu endpoint artık soru ekleme
// isteğinden ÖNCE, ATOMİK bir "kilitleme" adımı olarak çağrılıyor (bkz.
// AiQuestionDraftsPanel.tsx) — UPDATE ... WHERE status='pending' sadece durum HÂLÂ
// pending'se satırı günceller (process-queue/route.ts'teki kuyruk-claim'iyle AYNI
// desen). İkinci bir çağrı (çift tık, iki sekme, vb.) 0 satır günceller — bunu
// `.select()`le geri okuyup boşsa "claimed:false" döndürüyoruz, client bu durumda
// soruları HİÇ eklemiyor. Reject'te bu risk yok (veri eklemiyor), eskisi gibi kalıyor.
export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { draftId } = await params;
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  const action = body?.action;

  if (action !== 'reject' && action !== 'mark_saved' && action !== 'mark_saved_want_more') {
    return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 });
  }

  const status = action === 'reject' ? 'rejected' : action === 'mark_saved' ? 'saved' : 'saved_want_more';

  const supabase = createServiceClient();
  const { data: claimedRows, error } = await supabase
    .from('ai_question_drafts')
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: admin.user.id })
    .eq('id', draftId)
    .eq('status', 'pending')
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const claimed = ((claimedRows as { id: number }[] | null) || []).length > 0;
  return NextResponse.json({ ok: true, claimed });
}
