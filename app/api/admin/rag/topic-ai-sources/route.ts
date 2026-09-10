import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Bir konu için kaydedilmiş, henüz sentezlenmemiş AI kaynak taslaklarını listeler
// (rag_documents: source='ai_generated', is_synthesis=false, topic_id=X) — admin bunları
// tek tek "RAG Kaynak Metni" butonuyla kaydediyor, sonra bu listeyi görüp sentez adımına
// geçiyor. DELETE ile tek bir taslağı (yanlış/kötü çıkmışsa) kaldırabiliyor.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = Number(request.nextUrl.searchParams.get('topicId'));
  if (!Number.isFinite(topicId)) return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('rag_documents')
    .select('id, title, status, created_at, raw_text')
    .eq('topic_id', topicId)
    .eq('source', 'ai_generated')
    .eq('is_synthesis', false)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data as { id: number; title: string; status: string; created_at: string; raw_text: string | null }[] | null) || [];
  return NextResponse.json({
    sources: rows.map((r) => ({ id: r.id, title: r.title, status: r.status, createdAt: r.created_at, preview: (r.raw_text || '').slice(0, 140) })),
  });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const id = Number(request.nextUrl.searchParams.get('id'));
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  const supabase = createServiceClient();
  // FK RESTRICT — chunk'lar belgeden önce silinmeli.
  await supabase.from('rag_document_chunks').delete().eq('document_id', id);
  const { error } = await supabase.from('rag_documents').delete().eq('id', id).eq('source', 'ai_generated').eq('is_synthesis', false);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
