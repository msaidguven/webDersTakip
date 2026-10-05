import type { SupabaseClient } from '@supabase/supabase-js';

type GuideNoteRow = {
  source_pages: string | null;
  recommended_hours: number | null;
  emphasis_notes: string | null;
  content_points: string[] | null;
  key_terms: { term: string; definition: string }[] | null;
  examples: string[] | null;
  scope_notes: string | null;
  misconceptions: string[] | null;
  prerequisites: string | null;
  assessment_notes: string | null;
};

// 'full': RAG kaynak/sentez promptları ve API ile üretilen nihai içerik — kılavuzun konuya
// dair tüm bilgisi. 'compact': NotebookLM'e yapıştırılan promptlar (tek mesaj ~3900
// karakter sınırı, bkz. NOTEBOOKLM_PROMPT_MAX_CHARS) — yalnız kapsam ve vurgu; NotebookLM
// zaten kaynaklarını kendisi okuyor.
export type TeacherGuideGuidanceMode = 'full' | 'compact';

function bullets(items: string[] | null): string {
  return (items || []).map((i) => `- ${i}`).join('\n');
}

export function formatTeacherGuideGuidance(note: GuideNoteRow, mode: TeacherGuideGuidanceMode): string {
  const parts: string[] = [];
  const scope = note.scope_notes?.trim();
  const emphasis = note.emphasis_notes?.trim();

  if (mode === 'compact') {
    if (scope) parts.push(`Kapsam ve derinlik: ${scope}`);
    if (emphasis) parts.push(`Özellikle vurgula: ${emphasis}`);
    return parts.length ? `Öğretmen kılavuz kitabına göre bu konu:\n${parts.join('\n')}\n` : '';
  }

  const meta = [note.source_pages ? `kılavuz s. ${note.source_pages}` : null, note.recommended_hours ? `önerilen süre ${note.recommended_hours} ders saati` : null]
    .filter(Boolean)
    .join(', ');
  if (scope) parts.push(`Kapsam ve derinlik (bu sınırın dışına çıkma, bu derinliğin altında da kalma):\n${scope}`);
  if (note.content_points?.length) parts.push(`Kılavuzun bu konuda öğrettiği bilgiler (metin bunların HEPSİNİ kapsamalı):\n${bullets(note.content_points)}`);
  if (note.key_terms?.length) {
    parts.push(`Kılavuzdaki/sözlükteki tanımlar (bu terimleri tanımlarken bu ifadelere sadık kal):\n${note.key_terms.map((k) => `- ${k.term}: ${k.definition}`).join('\n')}`);
  }
  if (note.examples?.length) parts.push(`Kılavuzun kullandığı örnekler (örnekleri öncelikle bunlardan seç):\n${bullets(note.examples)}`);
  if (emphasis) parts.push(`Özellikle vurgulanacak noktalar:\n${emphasis}`);
  if (note.misconceptions?.length) parts.push(`Kılavuzun dikkat çektiği karışıklıklar/hatalar (metinde açıkça düzelt):\n${bullets(note.misconceptions)}`);
  if (note.prerequisites?.trim()) parts.push(`Dayandığı ön bilgi: ${note.prerequisites.trim()}`);
  if (note.assessment_notes?.trim()) parts.push(`Konu sonunda öğrenciden beklenen: ${note.assessment_notes.trim()}`);

  if (!parts.length) return '';
  return `MEB öğretmen kılavuz kitabından bu konu için çıkarılan bilgiler${meta ? ` (${meta})` : ''}. Resmî kazanımlar her zaman önceliklidir; kılavuz bilgisi kapsamı, derinliği, tanımları ve örnekleri belirler:\n\n${parts.join('\n\n')}\n`;
}

// Bir konu için (varsa) öğretmen kılavuz kitabından çıkarılmış bilgiyi promptlara eklenecek
// hazır bir metin bloğuna çevirir. Nihai içerik promptlarında (topic-sections/prompt,
// aiContentDraftGen) ve RAG taslak/sentez promptlarında (kullanıcının 2026-09-19 kararı:
// RAG kaynak aşaması da kılavuzu görsün) kullanılıyor. Kılavuz yoksa boş string döner —
// placeholder'ı sessizce siler, hiçbir davranış değişmez.
export async function fetchTeacherGuideGuidance(
  supabase: SupabaseClient,
  topicId: number,
  mode: TeacherGuideGuidanceMode = 'full'
): Promise<string> {
  const { data, error } = await supabase
    .from('topic_teacher_guide_notes')
    .select('source_pages, recommended_hours, emphasis_notes, content_points, key_terms, examples, scope_notes, misconceptions, prerequisites, assessment_notes')
    .eq('topic_id', topicId)
    .maybeSingle();
  // Sessizce boş dönmesin: sütunlar yoksa (teacher_guide_topic_details.sql çalışmadıysa)
  // promptlar kılavuzsuz üretilir — en azından logda görünsün.
  if (error) console.error('Kılavuz notu okunamadı', topicId, error.message);
  return data ? formatTeacherGuideGuidance(data as GuideNoteRow, mode) : '';
}
