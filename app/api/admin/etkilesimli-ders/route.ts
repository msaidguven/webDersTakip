import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { HAND_WRITTEN_TOPIC_IDS, getLessonDefinition } from '@/app/src/lib/interactiveLesson/registry';
import { isLessonV2 } from '@/app/src/lib/interactiveLesson/typesV2';
import { isLessonV3 } from '@/app/src/lib/interactiveLesson/typesV3';

// Admin anasayfası "Etkileşimli dersler" (2026-11-03): üretim durumu + kullanım; toplulaştırma
// admin_interactive_lesson_stats RPC'sinde (bkz. supabase/migrations/interactive_lesson_progress_and_stats.sql).
// Konu linkleri (href) ve elle yazılmış v1/v2 dersleri burada eklenir.
export const dynamic = 'force-dynamic';

type TopicSlugRow = {
  id: number;
  title: string;
  slug: string | null;
  units: {
    slug: string | null;
    grades: { name: string; slug: string | null } | null;
    lessons: { name: string; slug: string | null } | null;
  } | null;
};

function buildHref(row: TopicSlugRow): string | null {
  const g = row.units?.grades?.slug;
  const l = row.units?.lessons?.slug;
  const u = row.units?.slug;
  const t = row.slug;
  return g && l && u && t ? `/${g}/${l}/${u}/${t}` : null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('admin_interactive_lesson_stats');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stats = data as {
    recent?: { topic_id: number; title: string; grade: string; lesson: string; status: string; voice_done: boolean; updated_at: string }[];
    top?: { topic_id: number; title: string; grade: string; lesson: string; opens: number; finishes: number }[];
    [k: string]: unknown;
  };

  const allIds = Array.from(
    new Set([
      ...HAND_WRITTEN_TOPIC_IDS,
      ...(stats.recent ?? []).map((x) => x.topic_id),
      ...(stats.top ?? []).map((x) => x.topic_id),
    ]),
  );

  const topicMap = new Map<number, { title: string; grade: string; lesson: string; href: string | null }>();
  if (allIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, title, slug, units(slug, grades(name, slug), lessons(name, slug))')
      .in('id', allIds);
    for (const row of (topicRows ?? []) as unknown as TopicSlugRow[]) {
      topicMap.set(row.id, {
        title: row.title,
        grade: row.units?.grades?.name ?? '',
        lesson: row.units?.lessons?.name ?? '',
        href: buildHref(row),
      });
    }
  }

  const handwritten = HAND_WRITTEN_TOPIC_IDS.map((id) => {
    const def = getLessonDefinition(id);
    const info = topicMap.get(id);
    return {
      topic_id: id,
      title: info?.title ?? `Konu #${id}`,
      grade: info?.grade ?? '',
      lesson: info?.lesson ?? '',
      href: info?.href ?? null,
      version: isLessonV3(def) ? 3 : isLessonV2(def) ? 2 : 1,
    };
  }).sort((a, b) => b.version - a.version || b.topic_id - a.topic_id);

  return NextResponse.json(
    {
      ...stats,
      handwritten,
      recent: (stats.recent ?? []).map((x) => ({ ...x, href: topicMap.get(x.topic_id)?.href ?? null })),
      top: (stats.top ?? []).map((x) => ({ ...x, href: topicMap.get(x.topic_id)?.href ?? null })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
