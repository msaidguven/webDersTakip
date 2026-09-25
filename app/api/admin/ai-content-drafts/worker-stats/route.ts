import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { CONTENT_WORKER_PROFILES, type ContentWorkerId } from '@/app/src/lib/contentWorkerProfiles';
import {
  classifyFailure,
  describeTopic,
  statsWindowStartIso,
  summarizeWindows,
  STATS_WINDOW_DAYS,
  TOPIC_LINK_SELECT,
  type EmbeddedTopic,
} from '@/app/src/lib/workerRunStats';

// "Model Performansı" sekmesi — içerik worker'larının (primary/secondary) son 7 gündeki
// başarı oranı ve başarısızlık nedenleri. Tablo saatte ~2 satır büyüyor, 7 günlük pencere
// (~340 satır) JS'te toplamak için yeterince küçük.
const RECENT_LIMIT = 10;

type RunRow = {
  id: number;
  generated: boolean;
  reason: string | null;
  worker: ContentWorkerId;
  created_at: string;
  // draft_id → taslak → konu; taslak üretilemediyse null.
  topic_section_content_drafts: { topic_id: number; topics: EmbeddedTopic } | null;
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ai_content_draft_worker_runs')
    .select(`id, generated, reason, worker, created_at, topic_section_content_drafts(topic_id, ${TOPIC_LINK_SELECT})`)
    .gte('created_at', statsWindowStartIso())
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as unknown as RunRow[];

  const workers = Object.values(CONTENT_WORKER_PROFILES).map((profile) => {
    const own = rows.filter((r) => r.worker === profile.id);
    return {
      id: profile.id,
      model: profile.model,
      cronMinute: profile.cronMinute,
      ...summarizeWindows(own),
      recent: own.slice(0, RECENT_LIMIT).map((r) => ({
        id: r.id,
        generated: r.generated,
        reason: r.reason,
        failureKind: r.generated ? null : classifyFailure(r.reason),
        created_at: r.created_at,
        topic_id: r.topic_section_content_drafts?.topic_id ?? null,
        ...describeTopic(r.topic_section_content_drafts?.topics ?? null),
      })),
    };
  });

  return NextResponse.json({ windowDays: STATS_WINDOW_DAYS, workers });
}
