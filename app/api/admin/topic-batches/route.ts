import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Otomatik soru üretiminin son 30 konu partisi + yaşına bakmadan sorunlu partiler (0 soru ya da atlanan adım;
// admin uyarısı count_failed_topic_batches buraya yönlendirir) (/admin/soru-uretimi). 2026-10-26'ya kadar soru bildirimleri
// sayfasının altındaydı; ayrı sayfaya taşındı. Yayınlama: ./publish.

type Embed<T> = T | T[] | null;
const one = <T,>(v: Embed<T>): T | null => (!v ? null : Array.isArray(v) ? v[0] ?? null : v);

type BatchRow = {
  topic_id: number;
  round_no: number;
  status: string;
  started_at: string;
  published_at: string | null;
  question_count: number | null;
  svg_pending_count: number | null;
  last_error: string | null;
  topics: Embed<{ title: string }>;
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const select = 'topic_id, round_no, status, started_at, published_at, question_count, svg_pending_count, last_error, topics(title)';
  const [recent, problems] = await Promise.all([
    supabase.from('ai_topic_question_batches').select(select).order('started_at', { ascending: false }).limit(30),
    supabase.from('ai_topic_question_batches').select(select).in('status', ['failed', 'published']).not('last_error', 'is', null).limit(100),
  ]);
  const error = recent.error ?? problems.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = [...((problems.data as BatchRow[] | null) || []), ...((recent.data as BatchRow[] | null) || [])];
  const unique = [...new Map(rows.map((b) => [`${b.topic_id}-${b.round_no}`, b])).values()].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const batches = unique.map((b) => ({
    topicId: b.topic_id,
    roundNo: b.round_no,
    topicTitle: one(b.topics)?.title ?? `Konu ${b.topic_id}`,
    status: b.status,
    startedAt: b.started_at,
    publishedAt: b.published_at,
    questionCount: b.question_count,
    svgPendingCount: b.svg_pending_count,
    lastError: b.last_error,
  }));
  return NextResponse.json({ batches });
}
