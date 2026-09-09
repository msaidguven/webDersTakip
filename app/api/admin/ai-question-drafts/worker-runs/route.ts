import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// AI Soru Taslakları panelindeki "Son Çalışmalar" bölümü — pg_cron+pg_net'in
// beklemediği generate-practice-question sonuçlarını görünür kılar (bkz.
// supabase/migrations/ai_question_draft_worker_runs.sql).
const RUN_LIMIT = 20;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ai_question_draft_worker_runs')
    .select('id, generated, reason, draft_id, created_at')
    .order('created_at', { ascending: false })
    .limit(RUN_LIMIT);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: data || [] });
}
