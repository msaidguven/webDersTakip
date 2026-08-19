import type { SupabaseClient } from '@supabase/supabase-js';

// units/topics/lesson_grades/grades üzerindeki `question_count` kolonu elle güncellenmiyordu
// (soru eklenince/silinince senkron kalmıyordu), bu yüzden kaldırıldı — bunun yerine bu dosya
// gerçek soru sayısını canlı hesaplar.
//
// Bir sorunun bir konuya (topic) bağlantısı artık TEK kaynaktan: questions.topic_id (bkz.
// add_question_scope_and_source.sql). question_usages (eski/harici bir bağlantıydı) ve
// kazanım-üzerinden bağlantı (question_outcomes) hiyerarşi hesaplamak için kullanılmıyor —
// kazanım artık sadece etiketleme/raporlama amaçlı, questions.topic_id/section_id'yi asla
// geçersiz kılmaz veya ona ek bir kaynak oluşturmaz.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// Verilen topic id'lerine doğrudan bağlı (questions.topic_id) soruların id listesini döner.
// Silme/listeleme akışlarının ortak kaynağı — hiçbir yerde question_usages'a bakılmaz.
export async function getQuestionIdsForTopics(supabase: AnySupabaseClient, topicIds: number[]): Promise<number[]> {
  if (!topicIds.length) return [];
  const { data } = await supabase.from('questions').select('id').in('topic_id', topicIds);
  return ((data as { id: number }[] | null) || []).map((r) => r.id);
}

export async function getQuestionCountsByTopicId(supabase: AnySupabaseClient, topicIds: number[]): Promise<Map<number, number>> {
  if (!topicIds.length) return new Map();

  const { data } = await supabase.from('questions').select('id, topic_id').in('topic_id', topicIds);

  const counts = new Map<number, number>();
  for (const q of (data as { id: number; topic_id: number | null }[] | null) || []) {
    if (q.topic_id == null) continue;
    counts.set(q.topic_id, (counts.get(q.topic_id) ?? 0) + 1);
  }
  return counts;
}

export async function getQuestionCountsByUnitId(supabase: AnySupabaseClient, unitIds: number[]): Promise<Map<number, number>> {
  if (!unitIds.length) return new Map();

  const { data: topicsData } = await supabase.from('topics').select('id, unit_id').in('unit_id', unitIds);
  const topics = (topicsData as { id: number; unit_id: number }[] | null) || [];
  const topicCounts = await getQuestionCountsByTopicId(supabase, topics.map((t) => t.id));

  const unitCounts = new Map<number, number>();
  for (const t of topics) {
    const c = topicCounts.get(t.id) ?? 0;
    unitCounts.set(t.unit_id, (unitCounts.get(t.unit_id) ?? 0) + c);
  }
  return unitCounts;
}

// Sonuç anahtarı `${lessonId}:${gradeId}` — bir ders farklı sınıflarda farklı ünitelere
// sahip olabildiği için (lesson_grades ilişkisi) tek başına lessonId yeterli değil.
export async function getQuestionCountsByLessonGrade(
  supabase: AnySupabaseClient,
  pairs: { lessonId: number; gradeId: number }[]
): Promise<Map<string, number>> {
  if (!pairs.length) return new Map();

  const lessonIds = Array.from(new Set(pairs.map((p) => p.lessonId)));
  const gradeIds = Array.from(new Set(pairs.map((p) => p.gradeId)));

  // Tek istekte units -> topics -> questions'ı nested embed ile çekip JS'de
  // sayıyoruz; ayrı ayrı sıralı sorgular yerine tek round-trip.
  const { data: unitsData } = await supabase
    .from('units')
    .select('lesson_id, grade_id, topics(questions(id))')
    .in('lesson_id', lessonIds)
    .in('grade_id', gradeIds);
  const units = (unitsData as { lesson_id: number; grade_id: number; topics: { questions: { id: number }[] }[] }[] | null) || [];

  const result = new Map<string, number>();
  for (const u of units) {
    const questionCount = (u.topics ?? []).reduce((sum, t) => sum + (t.questions?.length ?? 0), 0);
    const key = `${u.lesson_id}:${u.grade_id}`;
    result.set(key, (result.get(key) ?? 0) + questionCount);
  }
  return result;
}
