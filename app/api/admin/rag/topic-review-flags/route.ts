import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Bir konunun AÇIK (çözülmemiş) rag_topic_review_flags satırlarını döner — "Doğruluk
// Kontrolü" kaldırıldıktan sonra (kullanıcının 2026-09-18 isteği) tek kaynak, "Kaynak Metni
// Sentezle"/"Ünite: Kaynak Tekilleştir" adımlarının bıraktığı tutarsızlık notları (bkz.
// RagOpenNotesList, AdminTopicSectionsPanel.tsx).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = Number(request.nextUrl.searchParams.get('topicId'));
  if (!Number.isFinite(topicId)) return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('rag_topic_review_flags')
    .select('id, note, created_at')
    .eq('topic_id', topicId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const flags = ((data as { id: number; note: string; created_at: string }[] | null) || []).map((f) => ({
    id: f.id,
    note: f.note,
    createdAt: f.created_at,
  }));

  return NextResponse.json({ flags });
}
