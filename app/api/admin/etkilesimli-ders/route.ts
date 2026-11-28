import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { expireTag } from '@/app/src/lib/cacheInvalidation';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { interactiveLessonTag } from '@/app/src/lib/interactiveLesson/hydrate';
import { HAND_WRITTEN_TOPIC_IDS, getLessonDefinition } from '@/app/src/lib/interactiveLesson/registry';
import { isLessonV2 } from '@/app/src/lib/interactiveLesson/typesV2';
import { isLessonV3 } from '@/app/src/lib/interactiveLesson/typesV3';
import { revalidateTopicPage } from '@/app/src/lib/topicPageRevalidation';

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

  const recentIds = (stats.recent ?? []).map((x) => x.topic_id);
  const versionMap = new Map<number, '3.2' | '3.1' | '3' | '2' | '1' | null>();
  if (recentIds.length > 0) {
    const { data: lessonRows } = await supabase
      .from('interactive_lessons')
      .select('topic_id, lesson')
      .in('topic_id', recentIds);
    for (const row of (lessonRows ?? []) as { topic_id: number; lesson: Record<string, unknown> | null }[]) {
      const l = row.lesson;
      if (!l || typeof l !== 'object') {
        versionMap.set(row.topic_id, null);
      } else if (l.version === 3 && l.schemaVersion === '3.2') {
        versionMap.set(row.topic_id, '3.2');
      } else if (l.version === 3 && l.schemaVersion === '3.1') {
        versionMap.set(row.topic_id, '3.1');
      } else if (l.version === 3) {
        versionMap.set(row.topic_id, '3');
      } else if (l.version === 2) {
        versionMap.set(row.topic_id, '2');
      } else {
        versionMap.set(row.topic_id, '1');
      }
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
      recent: (stats.recent ?? []).map((x) => ({
        ...x,
        href: topicMap.get(x.topic_id)?.href ?? null,
        schema_version: versionMap.get(x.topic_id) ?? null,
      })),
      top: (stats.top ?? []).map((x) => ({ ...x, href: topicMap.get(x.topic_id)?.href ?? null })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { action?: string; topicId?: unknown } | null;
  const topicId = Number(body?.topicId);
  if (body?.action !== 'regenerate_v31' || !Number.isInteger(topicId) || topicId <= 0) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }
  if (HAND_WRITTEN_TOPIC_IDS.includes(topicId)) {
    return NextResponse.json({ error: 'Elle yazılmış dersler yeniden üretilemez' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('interactive_lessons')
    .update({
      status: 'partial',
      lesson: null,
      runs: 0,
      voice_done: false,
      last_message: 'Admin tarafından v3.1 ile yeniden üretim sırasına alındı',
      updated_at: new Date().toISOString(),
    })
    .eq('topic_id', topicId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  expireTag(interactiveLessonTag(topicId));
  await revalidateTopicPage(supabase, topicId).catch(() => {});

  return NextResponse.json({ ok: true, topicId });
}
