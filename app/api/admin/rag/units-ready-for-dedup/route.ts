import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type TopicRow = { id: number; unit_id: number };

// Verilen ünite id'lerinden hangilerinde "RAG Ünite Sentezi (Tekrar Kontrolü)" çalıştırmaya
// değer en az 2 konu olduğunu döner — bir konu sadece RAG kaynak metni sentezlenmiş (19.
// prompt) olmakla yetmez, YAYINDA içeriği de olmalı (topic_contents satırı var): aksi halde
// dedup kaynak metnini düzeltir ama öğrencinin gördüğü içerik hâlâ eskisi/hatalısı kalır,
// admin "Sentezden İçeriği Güncelle"yi unutursa düzeltme hiçbir yere yansımaz (kullanıcının
// 2026-09-14 isteği: "güncelle menüsünü çalıştırmadan ünite sentezini çalıştırmayalım").
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const raw = request.nextUrl.searchParams.get('unitIds') || '';
  const unitIds = raw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  if (!unitIds.length) return NextResponse.json({ unitIds: [] });

  const supabase = createServiceClient();

  const { data: topicsData, error: topicsError } = await supabase
    .from('topics')
    .select('id, unit_id')
    .in('unit_id', unitIds)
    .eq('is_active', true);
  if (topicsError) return NextResponse.json({ error: topicsError.message }, { status: 500 });

  const topics = (topicsData as TopicRow[] | null) || [];
  const topicIds = topics.map((t) => t.id);
  if (!topicIds.length) return NextResponse.json({ unitIds: [] });

  const [{ data: synthesisData, error: synthesisError }, { data: contentsData, error: contentsError }] = await Promise.all([
    supabase.from('rag_documents').select('topic_id').in('topic_id', topicIds).eq('source', 'ai_generated').eq('is_synthesis', true),
    supabase.from('topic_contents').select('topic_id').in('topic_id', topicIds),
  ]);
  if (synthesisError) return NextResponse.json({ error: synthesisError.message }, { status: 500 });
  if (contentsError) return NextResponse.json({ error: contentsError.message }, { status: 500 });

  const synthesizedTopicIds = new Set(((synthesisData as { topic_id: number | null }[] | null) || []).map((r) => r.topic_id));
  const publishedTopicIds = new Set(((contentsData as { topic_id: number | null }[] | null) || []).map((r) => r.topic_id));

  const readyTopicCountByUnitId = new Map<number, number>();
  for (const topic of topics) {
    if (synthesizedTopicIds.has(topic.id) && publishedTopicIds.has(topic.id)) {
      readyTopicCountByUnitId.set(topic.unit_id, (readyTopicCountByUnitId.get(topic.unit_id) || 0) + 1);
    }
  }

  const readyUnitIds = unitIds.filter((id) => (readyTopicCountByUnitId.get(id) || 0) >= 2);
  return NextResponse.json({ unitIds: readyUnitIds });
}
