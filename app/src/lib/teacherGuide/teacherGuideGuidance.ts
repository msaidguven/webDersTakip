import type { SupabaseClient } from '@supabase/supabase-js';

// Bir konu için (varsa) öğretmen kılavuz kitabından çıkarılmış vurgu notunu, promptlara
// eklenecek hazır bir metin bloğuna çevirir. Hem nihai içerik promptlarında (bkz.
// topic-sections/prompt/route.ts) hem RAG taslak/sentez/tekilleştirme promptlarında
// (kullanıcının 2026-09-19 kararı: RAG kaynak aşaması da kılavuzu görsün, sadece nihai
// içerikle sınırlı kalmasın) aynı metinle kullanılıyor. Kılavuz yoksa boş string döner —
// placeholder'ı sessizce siler, hiçbir davranış değişmez.
export async function fetchTeacherGuideGuidance(supabase: SupabaseClient, topicId: number): Promise<string> {
  const { data: guideNote } = await supabase
    .from('topic_teacher_guide_notes')
    .select('emphasis_notes')
    .eq('topic_id', topicId)
    .maybeSingle();
  const emphasisNotes = (guideNote as { emphasis_notes: string | null } | null)?.emphasis_notes?.trim();
  return emphasisNotes
    ? `Öğretmen kılavuz kitabına göre bu konuda vurgulanması/önemli olarak belirtilen noktalar (bunları özellikle öne çıkar):\n${emphasisNotes}\n`
    : '';
}
