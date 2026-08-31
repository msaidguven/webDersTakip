import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { processExtractedText } from '@/app/src/lib/rag/processDocument';

// 50MB Storage limitini aşan PDF'ler için: admin, NotebookLM'den ünite bazında
// aldığı düz metni buraya yapıştırır. Dosya/upload yok — doğrudan chunk+embed.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as
    | { gradeId?: unknown; lessonId?: unknown; unitId?: unknown; text?: unknown }
    | null;
  const gradeId = Number(body?.gradeId);
  const lessonId = Number(body?.lessonId);
  const unitId = Number(body?.unitId);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';

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
      title: unit.title,
      source: 'notebooklm_text',
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
