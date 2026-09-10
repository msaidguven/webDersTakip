import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Verilen konu id'lerinden hangilerinin zaten bir sentezlenmiş RAG kaynağı (rag_documents:
// source='ai_generated', is_synthesis=true) olduğunu döner — konu listesinde yeşil tik
// göstermek için (admin çok sayıda kitapsız konu arasında nerede kaldığını görebilsin,
// 2026-09-10 kullanıcı talebi).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const raw = request.nextUrl.searchParams.get('topicIds') || '';
  const topicIds = raw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  if (!topicIds.length) return NextResponse.json({ topicIds: [] });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('rag_documents')
    .select('topic_id')
    .in('topic_id', topicIds)
    .eq('source', 'ai_generated')
    .eq('is_synthesis', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data as { topic_id: number | null }[] | null) || [];
  const ids = [...new Set(rows.map((r) => r.topic_id).filter((id): id is number => id != null))];
  return NextResponse.json({ topicIds: ids });
}
