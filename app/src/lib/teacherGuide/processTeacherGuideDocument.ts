import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPdfTextByUnit, type PdfUnitInput } from '../rag/pdfExtract';
import { structureTeacherGuideUnitText } from './structureTeacherGuide';

const BUCKET = 'teacher-guide-documents';

type TopicRow = { id: number; title: string; unit_id: number };

async function markFailed(supabase: SupabaseClient, documentId: number, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  await supabase
    .from('teacher_guide_documents')
    .update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
    .eq('id', documentId);
}

async function fetchUnitsWithTopics(
  supabase: SupabaseClient,
  gradeId: number,
  lessonId: number
): Promise<{ units: PdfUnitInput[]; topicsByUnitId: Map<number, { id: number; title: string }[]> }> {
  const { data: unitsData } = await supabase
    .from('units')
    .select('id, title')
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .order('order_no');
  const units = (unitsData as PdfUnitInput[] | null) || [];

  const unitIds = units.map((u) => u.id);
  const { data: topicsData } = unitIds.length
    ? await supabase.from('topics').select('id, title, unit_id').in('unit_id', unitIds).eq('is_active', true)
    : { data: [] as TopicRow[] };

  const topicsByUnitId = new Map<number, { id: number; title: string }[]>();
  for (const t of (topicsData as TopicRow[] | null) || []) {
    const list = topicsByUnitId.get(t.unit_id) || [];
    list.push({ id: t.id, title: t.title });
    topicsByUnitId.set(t.unit_id, list);
  }

  return { units, topicsByUnitId };
}

// upsert (onConflict: topic_id) — aynı konu için kılavuz tekrar yüklenirse eskiyi değiştirir.
export async function saveTeacherGuideNotes(
  supabase: SupabaseClient,
  documentId: number,
  notes: { topicId: number; recommendedHours: number | null; emphasisNotes: string | null }[]
): Promise<number> {
  if (!notes.length) return 0;
  const rows = notes.map((n) => ({
    topic_id: n.topicId,
    document_id: documentId,
    recommended_hours: n.recommendedHours,
    emphasis_notes: n.emphasisNotes,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('topic_teacher_guide_notes').upsert(rows, { onConflict: 'topic_id' });
  if (error) throw new Error(`Kılavuz notları kaydedilemedi: ${error.message}`);
  return rows.length;
}

async function deleteStorageFile(supabase: SupabaseClient, documentId: number): Promise<void> {
  const { data } = await supabase.from('teacher_guide_documents').select('file_path').eq('id', documentId).maybeSingle();
  const filePath = (data as { file_path: string | null } | null)?.file_path;
  if (!filePath) return;
  await supabase.storage.from(BUCKET).remove([filePath]);
  await supabase.from('teacher_guide_documents').update({ file_path: null }).eq('id', documentId);
}

// PDF yüklendiğinde çalışan tam akış: sayfa sayfa metne çevir + otomatik ünite tespiti yap
// (rag'daki extractPdfTextByUnit aynen reuse edilir) -> her ünite segmenti için konu listesini
// bul -> Gemini ile {konu, saat, vurgu} JSON'una yapılandır -> topic_teacher_guide_notes'a
// upsert et. rag'ın aksine her ünite için AYRI bir documents satırı açmıyoruz — kılavuz kitap
// tek bir belge olarak kalıyor, asıl veri zaten topic_id ile erişilen notes tablosunda.
export async function processTeacherGuideDocument(
  supabase: SupabaseClient,
  documentId: number,
  gradeId: number,
  lessonId: number,
  gradeName: string,
  lessonName: string,
  fileBuffer: Buffer
): Promise<void> {
  try {
    const { units, topicsByUnitId } = await fetchUnitsWithTopics(supabase, gradeId, lessonId);

    let segments;
    try {
      ({ segments } = await extractPdfTextByUnit(fileBuffer, units));
    } catch (err) {
      await markFailed(supabase, documentId, err);
      return;
    }

    let totalTopics = 0;
    let firstUnitId: number | null = null;
    for (const segment of segments) {
      if (segment.unitId == null) continue; // ünite eşleşmeyen sayfalar (kapak, önsöz vb.) atlanır
      const topics = topicsByUnitId.get(segment.unitId) || [];
      if (!topics.length) continue;
      firstUnitId ??= segment.unitId;
      try {
        const notes = await structureTeacherGuideUnitText(segment.text, gradeName, lessonName, segment.unitTitle || '', topics);
        totalTopics += await saveTeacherGuideNotes(supabase, documentId, notes);
      } catch (err) {
        console.error('Kılavuz ünite yapılandırma hatası', err instanceof Error ? err.message : String(err));
      }
    }

    await supabase
      .from('teacher_guide_documents')
      .update({
        unit_id: firstUnitId,
        status: totalTopics > 0 ? 'ready' : 'failed',
        error_message: totalTopics > 0 ? null : 'Hiçbir konu için kılavuz notu çıkarılamadı (ünite/konu eşleşmesi bulunamadı olabilir)',
        topic_count: totalTopics,
        page_count: segments.reduce((sum, s) => sum + s.pageCount, 0),
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);
  } finally {
    await deleteStorageFile(supabase, documentId).catch((err) => {
      console.error('Kılavuz PDF storage temizliği başarısız', err instanceof Error ? err.message : String(err));
    });
  }
}
