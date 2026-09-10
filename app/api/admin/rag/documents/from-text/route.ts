import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { processExtractedText } from '@/app/src/lib/rag/processDocument';

// 50MB Storage limitini aşan PDF'ler için: admin, NotebookLM'den ünite bazında
// aldığı düz metni buraya yapıştırır. Dosya/upload yok — doğrudan chunk+embed.
//
// title/source/topicId opsiyonel: MEB'in kitap yayınlamadığı dersler için admin bunun
// yerine kazanımlara dayanarak AI'a SIFIRDAN yazdırdığı bir konu metnini de aynı uca
// kaydedebiliyor (bkz. topic-source-prompt/route.ts) — o akış title'ı ünite değil KONU
// başlığı yapmak, source'u da 'ai_generated' işaretlemek, topicId'yi de kaydetmek istiyor
// ki daha sonra aynı konunun tüm taslakları (bkz. topic-ai-sources/route.ts) birlikte
// bulunup tek bir sentez metnine birleştirilebilsin. İkisi/üçü gönderilmezse eski davranış
// (unit.title, notebooklm_text, topic_id=null) korunuyor.
const VALID_SOURCES = ['notebooklm_text', 'ai_generated'] as const;

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as
    | { gradeId?: unknown; lessonId?: unknown; unitId?: unknown; text?: unknown; title?: unknown; source?: unknown; topicId?: unknown }
    | null;
  const gradeId = Number(body?.gradeId);
  const lessonId = Number(body?.lessonId);
  const unitId = Number(body?.unitId);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const titleOverride = typeof body?.title === 'string' ? body.title.trim() : '';
  const source = VALID_SOURCES.includes(body?.source as (typeof VALID_SOURCES)[number]) ? (body!.source as (typeof VALID_SOURCES)[number]) : 'notebooklm_text';
  const topicId = Number.isFinite(Number(body?.topicId)) ? Number(body?.topicId) : null;

  if (!Number.isFinite(gradeId) || !Number.isFinite(lessonId) || !Number.isFinite(unitId)) {
    return NextResponse.json({ error: 'gradeId, lessonId ve unitId gerekli' }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: 'Metin boş olamaz' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: unit } = await supabase
    .from('units')
    .select('id, title')
    .eq('id', unitId)
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .maybeSingle();
  if (!unit) return NextResponse.json({ error: 'Ünite bu sınıf/derse ait değil' }, { status: 404 });

  const { data: document, error: insertError } = await supabase
    .from('rag_documents')
    .insert({
      grade_id: gradeId,
      lesson_id: lessonId,
      unit_id: unitId,
      topic_id: topicId,
      title: titleOverride || unit.title,
      source,
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
    await processExtractedText(supabase, document.id, gradeId, lessonId, text);
  } catch (err) {
    // processExtractedText zaten rag_documents.status='failed' yazdı; admin panelinde görünür.
    const message = err instanceof Error ? err.message : String(err);
    console.error('RAG metin işleme hatası', message);
  }

  return NextResponse.json({ id: document.id });
}
