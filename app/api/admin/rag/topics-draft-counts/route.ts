import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Verilen konu id'lerinin her biri için kaç ham RAG kaynak taslağı (18. prompt, is_synthesis=
// false) kaydedildiğini döner — "RAG Kaynak Metni Sentezle" butonunun en az 5 taslak
// birikmeden pasif kalması için (kullanıcının 2026-09-14 isteği: tek bir AI'ın kaynak
// metnine güvenmek yerine birden fazla bağımsız taslağın çoğunluk/tutarlılık kontrolünden
// geçmesini zorunlu kılmak).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const raw = request.nextUrl.searchParams.get('topicIds') || '';
  const topicIds = raw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  if (!topicIds.length) return NextResponse.json({ counts: {} });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('rag_documents')
    .select('topic_id')
    .in('topic_id', topicIds)
    .eq('source', 'ai_generated')
    .eq('is_synthesis', false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<number, number> = {};
  for (const row of (data as { topic_id: number | null }[] | null) || []) {
    if (row.topic_id == null) continue;
    counts[row.topic_id] = (counts[row.topic_id] || 0) + 1;
  }
  return NextResponse.json({ counts });
}
