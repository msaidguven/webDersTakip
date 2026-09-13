import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { processExtractedText } from '@/app/src/lib/rag/processDocument';

type IncomingEdit = { topic_id?: unknown; raw_text?: unknown };
type TopicRow = { id: number; title: string };
type DocRow = { id: number; topic_id: number };

// unit-source-dedup-prompt/route.ts'in ürettiği promptun cevabını kaydeder. topic-source-
// synthesis/route.ts ile AYNI deseni izliyor (UPDATE değil, insert-yeni + eskiyi sil):
// raw_text zaten parçalanıp embed'lenmiş (rag_document_chunks) durumda — satırı yerinde
// güncelleyip chunk'ları olduğu gibi bırakırsak arama sonuçlarında hem eski hem yeni metin
// birden çıkar, tam çözmeye çalıştığımız tekrarı RAG arama tarafında yeniden yaratırız.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { unitId?: unknown; edits?: IncomingEdit[] } | null;
  const unitId = Number(body?.unitId);
  const edits = body?.edits;

  if (!Number.isFinite(unitId) || !Array.isArray(edits) || edits.length === 0) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const cleanEdits = edits
    .filter((e): e is IncomingEdit & { topic_id: number } => typeof e?.topic_id === 'number')
    .map((e) => ({
      topicId: e.topic_id,
      rawText: typeof e.raw_text === 'string' ? e.raw_text.trim() : '',
    }))
    .filter((e) => e.rawText.length > 0);

  if (!cleanEdits.length) {
    return NextResponse.json({ error: 'Geçerli düzenleme bulunamadı' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: unit } = await supabase.from('units').select('id, grade_id, lesson_id').eq('id', unitId).maybeSingle();
  if (!unit) return NextResponse.json({ error: 'Ünite bulunamadı' }, { status: 404 });
  const { grade_id: gradeId, lesson_id: lessonId } = unit as { grade_id: number; lesson_id: number };

  // Verilen topic_id'lerin GERÇEKTEN bu üniteye ait olduğunu doğruluyoruz (aynı gerekçe:
  // section_id'ler unit-dedup-apply'da olduğu gibi, topic_id'ler de dışarıdan yapıştırılan
  // bir JSON'dan geliyor).
  const { data: topicRows } = await supabase.from('topics').select('id, title').eq('unit_id', unitId);
  const topicById = new Map(((topicRows as TopicRow[] | null) || []).map((t) => [t.id, t]));

  const toApply = cleanEdits.filter((e) => topicById.has(e.topicId));
  const skipped = cleanEdits.filter((e) => !topicById.has(e.topicId)).map((e) => e.topicId);

  if (!toApply.length) {
    return NextResponse.json({ error: "Gönderilen topic_id'lerin hiçbiri bu üniteye ait değil" }, { status: 400 });
  }

  const { data: oldDocsData } = await supabase
    .from('rag_documents')
    .select('id, topic_id')
    .in('topic_id', toApply.map((e) => e.topicId))
    .eq('source', 'ai_generated')
    .eq('is_synthesis', true);
  const oldDocByTopicId = new Map(((oldDocsData as DocRow[] | null) || []).map((d) => [d.topic_id, d.id]));

  let updated = 0;
  const failedTopics: number[] = [];

  for (const edit of toApply) {
    const topic = topicById.get(edit.topicId)!;
    const oldDocId = oldDocByTopicId.get(edit.topicId);

    const { data: newDoc, error: insertError } = await supabase
      .from('rag_documents')
      .insert({
        grade_id: gradeId,
        lesson_id: lessonId,
        unit_id: unitId,
        topic_id: edit.topicId,
        title: topic.title,
        source: 'ai_generated',
        is_synthesis: true,
        raw_text: edit.rawText,
        status: 'processing',
        uploaded_by: admin.user.id,
      })
      .select('id')
      .single();

    if (insertError || !newDoc) {
      failedTopics.push(edit.topicId);
      continue;
    }

    try {
      await processExtractedText(supabase, newDoc.id, gradeId, lessonId, edit.rawText);
    } catch (err) {
      console.error('RAG ünite kaynak sentezi işleme hatası', err instanceof Error ? err.message : String(err));
    }

    if (oldDocId != null) {
      await supabase.from('rag_document_chunks').delete().eq('document_id', oldDocId);
      await supabase.from('rag_documents').delete().eq('id', oldDocId);
    }

    updated += 1;
  }

  if (!updated) {
    return NextResponse.json({ error: 'Hiçbir konu güncellenemedi' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated, skipped, failedTopics });
}
