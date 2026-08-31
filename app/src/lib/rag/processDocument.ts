import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPdfText } from './pdfExtract';
import { chunkText } from './chunking';
import { embedDocumentChunks } from './gemini';

// PDF yüklendiğinde çalışan tam akış: metne çevir -> parçala -> embed'le -> kaydet.
// Herhangi bir adım patlarsa rag_documents.status='failed' + error_message yazılır ki
// admin panelinde neyin bozuk olduğu görülebilsin.
export async function processRagDocument(
  supabase: SupabaseClient,
  documentId: number,
  topicId: number,
  fileBuffer: Buffer
): Promise<void> {
  try {
    const { text, pageCount } = await extractPdfText(fileBuffer);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error('Metin parçalara ayrılamadı');
    }

    const embeddings = await embedDocumentChunks(chunks.map((c) => c.content));

    const rows = chunks.map((chunk, index) => ({
      document_id: documentId,
      topic_id: topicId,
      chunk_index: index,
      content: chunk.content,
      token_count: chunk.tokenCount,
      embedding: embeddings[index],
    }));

    const { error: insertError } = await supabase.from('rag_document_chunks').insert(rows);
    if (insertError) throw new Error(`Parçalar kaydedilemedi: ${insertError.message}`);

    const { error: updateError } = await supabase
      .from('rag_documents')
      .update({
        status: 'ready',
        page_count: pageCount,
        chunk_count: rows.length,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);
    if (updateError) throw new Error(`Belge güncellenemedi: ${updateError.message}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('rag_documents')
      .update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
      .eq('id', documentId);
    throw err;
  }
}
