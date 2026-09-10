import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { processExtractedText } from '@/app/src/lib/rag/processDocument';

// 2-3 AI kaynak taslağının (bkz. topic-source-synthesis-prompt/route.ts) 4. bir AI
// tarafından birleştirilmiş sonucunu kaydeder — YENİ bir rag_documents satırı olarak
// (source='ai_generated', is_synthesis=true), SONRA aynı konunun ham taslaklarını
// (is_synthesis=false olanları) siler: artık RAG arama havuzunda hem ham hem sentezlenmiş
// hali birden bulunup çelişkili/tekrarlı sonuç vermesin diye (2026-09-10 kullanıcı talebi
// — "sentezi kaydettikten sonra diğerleri silinecek").
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { topicId?: unknown; text?: unknown } | null;
  const topicId = Number(body?.topicId);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';

  if (!Number.isFinite(topicId)) return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });
  if (!text) return NextResponse.json({ error: 'Metin boş olamaz' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: topic } = await supabase.from('topics').select('id, title, unit_id').eq('id', topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });

  const { data: unit } = await supabase.from('units').select('id, grade_id, lesson_id').eq('id', topic.unit_id).maybeSingle();
  if (!unit) return NextResponse.json({ error: 'Ünite bulunamadı' }, { status: 404 });

  const { data: draftsData } = await supabase
    .from('rag_documents')
    .select('id')
    .eq('topic_id', topicId)
    .eq('source', 'ai_generated')
    .eq('is_synthesis', false);
  const draftIds = ((draftsData as { id: number }[] | null) || []).map((d) => d.id);

  const { data: document, error: insertError } = await supabase
    .from('rag_documents')
    .insert({
      grade_id: unit.grade_id,
      lesson_id: unit.lesson_id,
      unit_id: unit.id,
      topic_id: topicId,
      title: topic.title,
      source: 'ai_generated',
      is_synthesis: true,
      raw_text: text,
      status: 'processing',
      uploaded_by: admin.user.id,
    })
    .select('id')
    .single();

  if (insertError || !document) {
    return NextResponse.json({ error: insertError?.message || 'Belge kaydedilemedi' }, { status: 500 });
  }

  try {
    await processExtractedText(supabase, document.id, unit.grade_id, unit.lesson_id, text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('RAG sentez işleme hatası', message);
  }

  if (draftIds.length) {
    await supabase.from('rag_document_chunks').delete().in('document_id', draftIds);
    await supabase.from('rag_documents').delete().in('id', draftIds);
  }

  return NextResponse.json({ id: document.id, deletedDrafts: draftIds.length });
}
