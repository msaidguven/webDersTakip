import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { classifyFailure, statsWindowStartIso, summarizeWindows, STATS_WINDOW_DAYS } from '@/app/src/lib/workerRunStats';

// "AI Anahtar Kavramlar" sekmesi — worker onaysız yayınladığı için detay yok, sadece başarı
// oranı + hangi konuyu ürettiği ve o konunun public sayfasına link (kullanıcının 2026-09-25
// isteği). Konu etiketi ve slug'lar tek sorguda FK embedding ile geliyor.
const RECENT_LIMIT = 20;

type Slugged = { slug: string | null };
type RunRow = {
  id: number;
  generated: boolean;
  reason: string | null;
  topic_id: number | null;
  created_at: string;
  topics: {
    title: string;
    slug: string | null;
    units: (Slugged & { title: string; lessons: (Slugged & { name: string }) | null; grades: (Slugged & { name: string }) | null }) | null;
  } | null;
};

function topicHref(t: RunRow['topics']): string | null {
  const u = t?.units;
  if (!t?.slug || !u?.slug || !u.lessons?.slug || !u.grades?.slug) return null;
  return `/${u.grades.slug}/${u.lessons.slug}/${u.slug}/${t.slug}`;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const [runsRes, pendingRes] = await Promise.all([
    supabase
      .from('ai_topic_highlights_worker_runs')
      .select('id, generated, reason, topic_id, created_at, topics(title, slug, units(title, slug, lessons(name, slug), grades(name, slug)))')
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
      topic_title: r.topics?.title ?? null,
      context: r.topics?.units
        ? [r.topics.units.grades?.name, r.topics.units.lessons?.name, r.topics.units.title].filter(Boolean).join(' · ')
        : null,
      href: topicHref(r.topics),
    })),
  });
}
