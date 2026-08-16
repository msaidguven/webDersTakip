import type { SupabaseClient } from '@supabase/supabase-js';

// units/topics/lesson_grades/grades üzerindeki `question_count` kolonu elle güncellenmiyordu
// (soru eklenince/silinince senkron kalmıyordu), bu yüzden kaldırıldı — bunun yerine bu dosya
// gerçek soru sayısını canlı hesaplar.
//
// Bir soru üç farklı yoldan bir konuya (topic) bağlı olabilir:
// - question_usages(question_id, topic_id): "ünite testi" havuzu, bu repo'nun dışında bir
//   süreçle (ör. başka bir istemci) doldurulan eski/harici bağlantı.
// - question_outcomes(question_id, outcome_id) -> outcomes.topic_id: "kavrama testi" havuzu,
//   admin panelindeki alt başlık soru ekleme akışının kazanım üzerinden kurduğu bağlantı.
// - questions.topic_id: yeni eklenen sorularda doğrudan tutulan, hiyerarşinin tek kaynağı olan alan.
// Bir soru bu üçünden birkaçına aynı anda bağlı olabilir (aynı question_id), o yüzden konu
// başına DISTINCT question_id sayısı alınır.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export async function getQuestionCountsByTopicId(supabase: AnySupabaseClient, topicIds: number[]): Promise<Map<number, number>> {
  const questionIdsByTopic = new Map<number, Set<number>>();
  if (!topicIds.length) return new Map();

  const ensure = (topicId: number) => {
    let set = questionIdsByTopic.get(topicId);
    if (!set) {
      set = new Set<number>();
      questionIdsByTopic.set(topicId, set);
    }
    return set;
  };

  const [{ data: usagesData }, { data: outcomesData }, { data: directData }] = await Promise.all([
    supabase.from('question_usages').select('topic_id, question_id').in('topic_id', topicIds),
    supabase.from('outcomes').select('id, topic_id').in('topic_id', topicIds),
    supabase.from('questions').select('id, topic_id').in('topic_id', topicIds),
  ]);

  for (const u of (usagesData as { topic_id: number; question_id: number }[] | null) || []) {
    ensure(u.topic_id).add(u.question_id);
  }

  const outcomeRows = (outcomesData as { id: number; topic_id: number }[] | null) || [];
  const topicIdByOutcomeId = new Map(outcomeRows.map((o) => [o.id, o.topic_id]));
  const outcomeIds = outcomeRows.map((o) => o.id);
  if (outcomeIds.length) {
    const { data: questionOutcomesData } = await supabase
      .from('question_outcomes')
      .select('outcome_id, question_id')
      .in('outcome_id', outcomeIds);
    for (const qo of (questionOutcomesData as { outcome_id: number; question_id: number }[] | null) || []) {
      const topicId = topicIdByOutcomeId.get(qo.outcome_id);
      if (topicId != null) ensure(topicId).add(qo.question_id);
    }
  }

  for (const q of (directData as { id: number; topic_id: number | null }[] | null) || []) {
    if (q.topic_id != null) ensure(q.topic_id).add(q.id);
  }

  const counts = new Map<number, number>();
  for (const [topicId, set] of questionIdsByTopic) counts.set(topicId, set.size);
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

  const { data: unitsData } = await supabase
    .from('units')
    .select('id, lesson_id, grade_id')
    .in('lesson_id', lessonIds)
    .in('grade_id', gradeIds);
  const units = (unitsData as { id: number; lesson_id: number; grade_id: number }[] | null) || [];
  const unitCounts = await getQuestionCountsByUnitId(supabase, units.map((u) => u.id));

  const result = new Map<string, number>();
  for (const u of units) {
    const key = `${u.lesson_id}:${u.grade_id}`;
    result.set(key, (result.get(key) ?? 0) + (unitCounts.get(u.id) ?? 0));
  }
  return result;
}
