import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// "AI Anahtar Kavramlar" sekmesi — pg_cron+pg_net'in beklemediği
// generate-topic-highlights sonuçlarını görünür kılar (bkz.
// supabase/migrations/ai_topic_highlights_worker_runs_admin_rpc.sql).
const RUN_LIMIT = 20;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const [runsRes, pendingRes] = await Promise.all([
    supabase.rpc('get_ai_topic_highlights_worker_runs', { p_limit: RUN_LIMIT }),
    supabase.rpc('count_topics_missing_highlights'),
  ]);

  if (runsRes.error) return NextResponse.json({ error: runsRes.error.message }, { status: 500 });

  return NextResponse.json({
    runs: runsRes.data || [],
    pendingCount: pendingRes.error ? null : (pendingRes.data as number | null),
  });
}
