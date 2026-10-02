import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Admin "Sesli Anlatım" sekmesi — pg_cron'un beklemediği /api/narration/worker sonuçlarını
// (topic_narration_worker_runs) ve hazır anlatım özetini (topic_narrations) gösterir.
const RUN_LIMIT = 20;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const [runsRes, narrationsRes] = await Promise.all([
    supabase
      .from('topic_narration_worker_runs')
      .select('id, topic_id, outcome, screens_made, screens_reused, reason, created_at, topics(title, units(title, grades(name), lessons(name)))')
      .order('created_at', { ascending: false })
      .limit(RUN_LIMIT),
    supabase.from('topic_narrations').select('duration_seconds'),
  ]);

  if (runsRes.error) return NextResponse.json({ error: runsRes.error.message }, { status: 500 });
  if (narrationsRes.error) return NextResponse.json({ error: narrationsRes.error.message }, { status: 500 });

  const narrations = (narrationsRes.data as { duration_seconds: number }[] | null) || [];
  return NextResponse.json({
    runs: runsRes.data || [],
    readyTopics: narrations.length,
    totalMinutes: Math.round(narrations.reduce((n, r) => n + Number(r.duration_seconds), 0) / 60),
  });
}
