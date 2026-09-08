import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPdfTextByUnit, type PdfUnitInput } from './pdfExtract';
import { chunkText } from './chunking';
import { embedDocumentChunks } from './gemini';

// PDF'ten çıkarılmış ya da NotebookLM'den yapıştırılmış düz metni parçalayıp
// embed'leyip rag_document_chunks'a kaydeder. Her iki giriş yolu (PDF upload,
// NotebookLM metin yapıştırma) bu adımı paylaşır.
async function chunkEmbedAndSave(
  supabase: SupabaseClient,
  documentId: number,
  gradeId: number,
  lessonId: number,
  text: string
): Promise<number> {
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error('Metin parçalara ayrılamadı');
  }

  const embeddings = await embedDocumentChunks(chunks.map((c) => c.content));

  const rows = chunks.map((chunk, index) => ({
    document_id: documentId,
    grade_id: gradeId,
    lesson_id: lessonId,
    chunk_index: index,
    content: chunk.content,
    token_count: chunk.tokenCount,
    embedding: embeddings[index],
  }));

  const { error: insertError } = await supabase.from('rag_document_chunks').insert(rows);
  if (insertError) throw new Error(`Parçalar kaydedilemedi: ${insertError.message}`);

  return rows.length;
}

async function markFailed(supabase: SupabaseClient, documentId: number, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  await supabase
    .from('rag_documents')
    .update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
    .eq('id', documentId);
}

async function fetchUnits(supabase: SupabaseClient, gradeId: number, lessonId: number): Promise<PdfUnitInput[]> {
  const { data } = await supabase
    .from('units')
    .select('id, title')
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .order('order_no');
  return (data as PdfUnitInput[] | null) || [];
}

// PDF yüklendiğinde çalışan tam akış: sayfa sayfa metne çevir + otomatik ünite
// tespiti yap -> her ünite (ve varsa ünite dışı kalan içerik) için ayrı bir
// rag_documents satırı üret -> parçala -> embed'le -> kaydet. İlk satır zaten
// route tarafından oluşturulmuş placeholder'ı (documentId) kullanır, sonraki
// segmentler için yeni satır açılır. Bir segmentin işlenmesi başarısız olursa
// sadece o satır 'failed' olur, diğer segmentlerin işlenmesi durmaz — tek bir
// ünitenin hatası, aynı kitaptan gelen diğer ünitelerin RAG'a girmesini
// engellemesin diye.
export async function processRagDocument(
  supabase: SupabaseClient,
  documentId: number,
  gradeId: number,
  lessonId: number,
  fileName: string,
  fileBuffer: Buffer
): Promise<void> {
  let segments;
  try {
    const units = await fetchUnits(supabase, gradeId, lessonId);
    ({ segments } = await extractPdfTextByUnit(fileBuffer, units));
  } catch (err) {
    await markFailed(supabase, documentId, err);
    return;
  }

  let unassignedIndex = 0;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isFirst = i === 0;
    const title = segment.unitTitle ?? (unassignedIndex === 0 ? fileName : `${fileName} (ek içerik ${unassignedIndex + 1})`);
    if (segment.unitTitle == null) unassignedIndex++;

    let rowId = documentId;
    if (isFirst) {
      await supabase.from('rag_documents').update({ unit_id: segment.unitId, title }).eq('id', documentId);
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('rag_documents')
        .insert({
          grade_id: gradeId,
          lesson_id: lessonId,
          unit_id: segment.unitId,
          source: 'pdf_upload',
          title,
          status: 'processing',
        })
        .select('id')
        .single();
      if (insertError || !inserted) {
        console.error('RAG segment satırı oluşturulamadı', insertError?.message);
        continue;
      }
      rowId = inserted.id;
    }

    try {
      const chunkCount = await chunkEmbedAndSave(supabase, rowId, gradeId, lessonId, segment.text);
      const { error: updateError } = await supabase
        .from('rag_documents')
        .update({
          status: 'ready',
          page_count: segment.pageCount,
          chunk_count: chunkCount,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rowId);
      if (updateError) throw new Error(`Belge güncellenemedi: ${updateError.message}`);
    } catch (err) {
      await markFailed(supabase, rowId, err);
    }
  }
}

// NotebookLM'den ünite bazında yapıştırılan düz metin için: PDF/extraction adımı
// yok, doğrudan parçala -> embed'le -> kaydet.
export async function processExtractedText(
  supabase: SupabaseClient,
  documentId: number,
  gradeId: number,
  lessonId: number,
  text: string
): Promise<void> {
  try {
    const chunkCount = await chunkEmbedAndSave(supabase, documentId, gradeId, lessonId, text);

    const { error: updateError } = await supabase
      .from('rag_documents')
      .update({
        status: 'ready',
        chunk_count: chunkCount,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);
    if (updateError) throw new Error(`Belge güncellenemedi: ${updateError.message}`);
  } catch (err) {
    await markFailed(supabase, documentId, err);
  }
}
