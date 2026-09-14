import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Verilen konu id'lerinden hangilerinde açık (çözülmemiş) bir "Tutarsızlık Notu" veya
// "Doğruluk Kontrolü" bulgusu olduğunu döner — konu başlığının yanında uyarı ikonu
// göstermek için (bkz. topics-with-synthesis/route.ts, aynı desen).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const raw = request.nextUrl.searchParams.get('topicIds') || '';
  const topicIds = raw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  if (!topicIds.length) return NextResponse.json({ topicIds: [] });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('rag_topic_review_flags')
    .select('topic_id')
    .in('topic_id', topicIds)
    .is('resolved_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data as { topic_id: number }[] | null) || [];
  const ids = [...new Set(rows.map((r) => r.topic_id))];
  return NextResponse.json({ topicIds: ids });
}
