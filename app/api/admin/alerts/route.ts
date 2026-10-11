import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Admin ana sayfasındaki uyarı kutusu (2026-10-12): AI soruları onaysız yayınlandığı için admin'in
// elle yapması gereken işler tek bakışta görünsün.
//   svgPending      — AI'nin görsel istediği, çizimi henüz eklenmemiş (yayında olmayan) sorular
//   openReports     — öğrencilerin açık "Hatalı soru" bildirimi olan soru sayısı
//   autoHidden      — 3+ "cevap yanlış" bildirimiyle otomatik gizlenmiş sorular
//   failedBatches   — hiç soru üretilemeyen / yayında hata alan konu partileri
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const supabase = createServiceClient();

  const [svg, reports, hidden, failed] = await Promise.all([
    supabase.from('questions').select('id', { count: 'exact', head: true }).not('svg_prompt', 'is', null).is('svg_content', null),
    supabase.from('question_reports').select('question_id').eq('status', 'open').limit(1000),
    supabase.from('questions').select('id', { count: 'exact', head: true }).not('auto_hidden_at', 'is', null),
    supabase.from('ai_topic_question_batches').select('topic_id', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);

  return NextResponse.json({
    svgPending: svg.count ?? 0,
    openReports: new Set(((reports.data as { question_id: number }[] | null) || []).map((r) => r.question_id)).size,
    autoHidden: hidden.count ?? 0,
    failedBatches: failed.count ?? 0,
  });
}
