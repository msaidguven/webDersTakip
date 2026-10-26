import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Admin'in bir "Hatalı soru" bildirimine cevabı (question_report_messages.sql). Bildirimin durumuna
// (açık/kapalı) dokunmaz — soru kararı ayrı (../route.ts POST). Öğrenciye zil bildirimi gider,
// /profil/bildirdigim-sorular'daki o bildirime götürür. { reportId, skip: true } → öğrencinin son mesajı cevap gerektirmiyor
// ("teşekkürler" gibi): yalnız admin uyarısı (awaiting_admin_at) düşer, mesaj/bildirim yok.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { reportId?: unknown; body?: unknown; skip?: unknown } | null;
  const reportId = Number(body?.reportId);
  if (body?.skip === true && Number.isInteger(reportId)) {
    const { error } = await createServiceClient().from('question_reports').update({ awaiting_admin_at: null }).eq('id', reportId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!Number.isInteger(reportId) || text.length < 1 || text.length > 2000) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: report, error: rError } = await supabase.from('question_reports').select('id, user_id').eq('id', reportId).maybeSingle();
  if (rError || !report) return NextResponse.json({ error: 'Bildirim bulunamadı' }, { status: 404 });

  const { error: mError } = await supabase.from('question_report_messages').insert({ report_id: reportId, sender: 'admin', body: text });
  if (mError) return NextResponse.json({ error: mError.message }, { status: 500 });
  const { error: uError } = await supabase.from('question_reports').update({ awaiting_admin_at: null }).eq('id', reportId);
  if (uError) return NextResponse.json({ error: uError.message }, { status: 500 });

  const { error: notifyError } = await supabase.from('notifications').insert({
    user_id: (report as { user_id: string }).user_id,
    type: 'question_report_reply',
    title: 'Bildirdiğin soruya cevap geldi',
    body: text.length > 120 ? `${text.slice(0, 117)}…` : text,
    link: `/profil/bildirdigim-sorular?bildirim=${reportId}`,
  });
  // Mesaj asıl iş; bildirim gitmezse geri alınmaz, öğrenci sayfada yine görür.
  if (notifyError) console.error('[question-reports/reply] bildirim eklenemedi:', notifyError.message);

  return NextResponse.json({ ok: true });
}
