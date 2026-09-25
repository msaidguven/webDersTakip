import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import {
  classifyFailure,
  describeTopic,
  statsWindowStartIso,
  summarizeWindows,
  STATS_WINDOW_DAYS,
  TOPIC_LINK_SELECT,
  type EmbeddedTopic,
} from '@/app/src/lib/workerRunStats';

// "AI Anahtar Kavramlar" sekmesi — worker onaysız yayınladığı için detay yok, sadece başarı
// oranı + hangi konuyu ürettiği ve o konunun public sayfasına link (kullanıcının 2026-09-25
// isteği). Konu etiketi ve slug'lar tek sorguda FK embedding ile geliyor.
const RECENT_LIMIT = 20;

type RunRow = {
  id: number;
  generated: boolean;
  reason: string | null;
  topic_id: number | null;
  created_at: string;
  topics: EmbeddedTopic;
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const [runsRes, pendingRes] = await Promise.all([
    supabase
      .from('ai_topic_highlights_worker_runs')
      .select(`id, generated, reason, topic_id, created_at, ${TOPIC_LINK_SELECT}`)
      .gte('created_at', statsWindowStartIso())
      .order('created_at', { ascending: false }),
    supabase.rpc('count_topics_missing_highlights'),
  ]);

  if (runsRes.error) return NextResponse.json({ error: runsRes.error.message }, { status: 500 });

  const rows = (runsRes.data || []) as unknown as RunRow[];

  return NextResponse.json({
    windowDays: STATS_WINDOW_DAYS,
    ...summarizeWindows(rows),
    pendingCount: pendingRes.error ? null : (pendingRes.data as number | null),
    recent: rows.slice(0, RECENT_LIMIT).map((r) => ({
      id: r.id,
      generated: r.generated,
      reason: r.reason,
      failureKind: r.generated ? null : classifyFailure(r.reason),
      created_at: r.created_at,
      topic_id: r.topic_id,
      ...describeTopic(r.topics),
    })),
  });
}
