import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPdfText } from './pdfExtract';
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

async function markFailed(supabase: SupabaseClient, documentId: number, err: unknown): Promise<never> {
  const message = err instanceof Error ? err.message : String(err);
  await supabase
    .from('rag_documents')
    .update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
    .eq('id', documentId);
  throw err;
}

// PDF yüklendiğinde çalışan tam akış: metne çevir -> parçala -> embed'le -> kaydet.
export async function processRagDocument(
  supabase: SupabaseClient,
  documentId: number,
  gradeId: number,
  lessonId: number,
  fileBuffer: Buffer
): Promise<void> {
  try {
    const { text, pageCount } = await extractPdfText(fileBuffer);
    const chunkCount = await chunkEmbedAndSave(supabase, documentId, gradeId, lessonId, text);

    const { error: updateError } = await supabase
      .from('rag_documents')
      .update({
        status: 'ready',
        page_count: pageCount,
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
