import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Admin'in elle yapması gereken işler — iki tüketicisi var:
//   /admin "Senin yapman gerekenler" kutusu (AdminAlerts, 2026-10-12): AI soruları onaysız yayınlandığı için
//     svgPending      — AI'nin görsel istediği, çizimi henüz eklenmemiş (yayında olmayan) sorular
//     openReports     — öğrencilerin açık "Hatalı soru" bildirimi olan soru sayısı
//     autoHidden      — 3+ "cevap yanlış" bildirimiyle otomatik gizlenmiş sorular
//     failedBatches   — hiç soru üretilemeyen / yayında hata alan konu partileri
//     awaitingReview  — yayından önce inceleme bekleyen (Türkçe) konu partileri
//     recapFiguresPending — şekil tarifi olup SVG'si çizilmemiş hap bilgi örnekleri (çizilene kadar örnek gizli)
//     recapFailed     — 3 denemede hap bilgi kartı üretilemeyen konular (worker artık denemiyor)
//   Admin anasayfası → "Acil uyarılar" (AdminHome, 2026-10-22):
//     pendingTeachers — onay bekleyen öğretmenler. Sıradaki adaylar: başarısız worker/cron, okunmamış hata
//     bildirimleri, sınava yakın yazılılarda eksik soru havuzu.
export const dynamic = 'force-dynamic';

type PendingRow = { id: string; full_name: string | null; school_name: string | null; teacher_lessons: { lessons: { name: string } | null }[] };

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const supabase = createServiceClient();

  const [svg, reports, hidden, failed, awaiting, teachers, recapFigures, recapFailed] = await Promise.all([
    supabase.from('questions').select('id', { count: 'exact', head: true }).not('svg_prompt', 'is', null).is('svg_content', null),
    supabase.from('question_reports').select('question_id').eq('status', 'open').limit(1000),
    supabase.from('questions').select('id', { count: 'exact', head: true }).not('auto_hidden_at', 'is', null),
    supabase.from('ai_topic_question_batches').select('topic_id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('ai_topic_question_batches').select('topic_id', { count: 'exact', head: true }).eq('status', 'awaiting_review'),
    supabase
      .from('profiles')
      .select('id, full_name, school_name, teacher_lessons(lessons(name))')
      .eq('role', 'teacher')
      .eq('is_verified', false)
      .not('is_banned', 'is', true)
      .limit(50),
    supabase
      .from('topic_content_sections')
      .select('id', { count: 'exact', head: true })
      .not('recap_card->example->>figure_prompt', 'is', null)
      .is('recap_card->example->>figure_svg', null),
    supabase.rpc('count_recap_card_failed_topics'),
  ]);
  if (teachers.error) return NextResponse.json({ error: teachers.error.message }, { status: 500 });
  const rows = (teachers.data as unknown as PendingRow[] | null) ?? [];

  // E-posta ve kayıt tarihi auth.users'ta — gerçek öğretmen olup olmadığına karar verirken admin'e yardımcı.
  const users = await Promise.all(rows.map((r) => supabase.auth.admin.getUserById(r.id).then(({ data: u }) => u.user)));
  const pendingTeachers = rows
    .map((r, i) => ({
      id: r.id,
      name: r.full_name?.trim() || 'Adsız',
      email: users[i]?.email ?? null,
      signedUpAt: users[i]?.created_at ?? null,
      school: r.school_name,
      lessons: r.teacher_lessons.flatMap((t) => (t.lessons ? [t.lessons.name] : [])),
    }))
    .sort((a, b) => (a.signedUpAt ?? '').localeCompare(b.signedUpAt ?? ''));

  return NextResponse.json({
    svgPending: svg.count ?? 0,
    openReports: new Set(((reports.data as { question_id: number }[] | null) || []).map((r) => r.question_id)).size,
    autoHidden: hidden.count ?? 0,
    failedBatches: failed.count ?? 0,
    awaitingReview: awaiting.count ?? 0,
    recapFiguresPending: recapFigures.count ?? 0,
    recapFailed: (recapFailed.data as number | null) ?? 0,
    pendingTeachers,
  });
}
