import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type TopicRow = { id: number; unit_id: number };

// Verilen ünite id'lerinden hangilerinde "RAG Ünite Sentezi (Tekrar Kontrolü)" çalıştırmaya
// HAZIR olduğunu döner — kullanıcının 2026-09-18 isteği ("içerik üretimi, tüm konular RAG
// aşamalarını bitirmeden açılmasın") sırasına göre, artık ünite tekilleştirme İÇERİK
// üretiminden ÖNCE yapılıyor; bu yüzden "yayında içeriği olmalı" şartı KALDIRILDI (önceki
// kural, dedup'ın içerik üretiminden SONRA bir temizlik adımı olduğu eski sıraya aitti —
// bkz. [[project_admin...]]). Artık tek şart: ünitedeki TÜM aktif konuların RAG kaynak
// metni sentezlenmiş olması (en az 2 konu, karşılaştıracak bir şey olsun diye).
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

  const { data: synthesisData, error: synthesisError } = await supabase
    .from('rag_documents')
    .select('topic_id')
    .in('topic_id', topicIds)
    .eq('source', 'ai_generated')
    .eq('is_synthesis', true);
  if (synthesisError) return NextResponse.json({ error: synthesisError.message }, { status: 500 });

  const synthesizedTopicIds = new Set(((synthesisData as { topic_id: number | null }[] | null) || []).map((r) => r.topic_id));

  const topicsByUnit = new Map<number, TopicRow[]>();
  for (const topic of topics) {
    const list = topicsByUnit.get(topic.unit_id) || [];
    list.push(topic);
    topicsByUnit.set(topic.unit_id, list);
  }

  const readyUnitIds = unitIds.filter((id) => {
    const unitTopics = topicsByUnit.get(id) || [];
    return unitTopics.length >= 2 && unitTopics.every((t) => synthesizedTopicIds.has(t.id));
  });
  return NextResponse.json({ unitIds: readyUnitIds });
}
