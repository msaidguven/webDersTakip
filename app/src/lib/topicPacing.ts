import type { SupabaseClient } from '@supabase/supabase-js';

export type TopicPacingInfo = {
  topicId: number;
  topicWeeks: number;
  unitWeeks: number;
  sharePct: number;
  label: 'ozet' | 'normal' | 'detayli';
  hoursEstimate: number | null;
};

type TopicRow = { id: number };
type OutcomeRow = { id: number; topic_id: number };
type OutcomeWeekRow = { outcome_id: number; start_week: number; end_week: number };

// Bir ünitenin konularının göreceli süre payını, o konuların kazanımlarına zaten atanmış
// haftalardan (outcome_weeks) çıkarır — units.duration_hours ve lesson_grades.weekly_hours
// nadiren dolu olduğu için (2026-09-18 kontrolünde 50 ünitenin 6'sı, 28 ders+sınıfın 2'si)
// bunlara bağlı kalmıyoruz; outcome_weeks neredeyse tam dolu (664 kazanımın 717 hafta kaydı).
// Kullanıcının fikri: MEB'in bir konuya ayırdığı süre, ünitedeki diğer konulara göre ne kadar
// kısa/uzunsa, öğrenciye gösterilen içerik de o kadar özet/detaylı olsun.
export async function computeUnitTopicPacing(
  supabase: SupabaseClient,
  unitId: number,
  lessonId: number,
  gradeId: number
): Promise<Map<number, TopicPacingInfo>> {
  const result = new Map<number, TopicPacingInfo>();

  const { data: topicsData } = await supabase.from('topics').select('id').eq('unit_id', unitId).eq('is_active', true);
  const topicIds = ((topicsData as TopicRow[] | null) || []).map((t) => t.id);
  if (topicIds.length < 2) return result;

  const { data: outcomesData } = await supabase.from('outcomes').select('id, topic_id').in('topic_id', topicIds);
  const outcomes = (outcomesData as OutcomeRow[] | null) || [];
  if (!outcomes.length) return result;

  const topicIdByOutcomeId = new Map(outcomes.map((o) => [o.id, o.topic_id]));
  const outcomeIds = outcomes.map((o) => o.id);

  const { data: weeksData } = await supabase
    .from('outcome_weeks')
    .select('outcome_id, start_week, end_week')
    .in('outcome_id', outcomeIds);
  const weeks = (weeksData as OutcomeWeekRow[] | null) || [];
  if (!weeks.length) return result;

  const spanByTopicId = new Map<number, { min: number; max: number }>();
  let unitMin = Infinity;
  let unitMax = -Infinity;
  for (const w of weeks) {
    const topicId = topicIdByOutcomeId.get(w.outcome_id);
    if (!topicId) continue;
    const span = spanByTopicId.get(topicId) || { min: w.start_week, max: w.end_week };
    span.min = Math.min(span.min, w.start_week);
    span.max = Math.max(span.max, w.end_week);
    spanByTopicId.set(topicId, span);
    unitMin = Math.min(unitMin, w.start_week);
    unitMax = Math.max(unitMax, w.end_week);
  }
  if (spanByTopicId.size < 2 || unitMax < unitMin) return result;

  const unitWeeks = unitMax - unitMin + 1;
  if (unitWeeks <= 0) return result;

  const { data: lessonGrade } = await supabase
    .from('lesson_grades')
    .select('weekly_hours')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    .maybeSingle();
  const weeklyHours = (lessonGrade as { weekly_hours: number | null } | null)?.weekly_hours || null;

  const avgShareFraction = 1 / spanByTopicId.size;

  for (const [topicId, span] of spanByTopicId) {
    const topicWeeks = span.max - span.min + 1;
    const shareFraction = topicWeeks / unitWeeks;
    const ratio = shareFraction / avgShareFraction;
    const label: TopicPacingInfo['label'] = ratio >= 1.3 ? 'detayli' : ratio <= 0.7 ? 'ozet' : 'normal';
    result.set(topicId, {
      topicId,
      topicWeeks,
      unitWeeks,
      sharePct: Math.round(shareFraction * 100),
      label,
      hoursEstimate: weeklyHours ? Math.round(topicWeeks * weeklyHours) : null,
    });
  }

  return result;
}

// mode 'plan': alt başlık PLANLAMA promptu için (sayı/kapsam talimatı).
// mode 'content': tam içerik/yeniden yazma promptları için (anlatım derinliği talimatı).
// label 'normal' veya veri yoksa boş string döner — placeholder'ı sessizce siler.
export function buildPacingGuidance(info: TopicPacingInfo | undefined, mode: 'plan' | 'content'): string {
  if (!info || info.label === 'normal') return '';

  const timeText = info.hoursEstimate ? `~${info.hoursEstimate} ders saati` : `~${info.topicWeeks} hafta`;
  const timeContext =
    info.label === 'ozet'
      ? `Bu konuya müfredatta ayrılan süre ünitenin diğer konularına göre kısıtlı (${timeText}, ünitenin yaklaşık %${info.sharePct}'i).`
      : `Bu konuya müfredatta bolca süre ayrılmış (${timeText}, ünitenin yaklaşık %${info.sharePct}'i).`;

  if (mode === 'plan') {
    const instruction =
      info.label === 'ozet'
        ? 'Buna göre alt başlık sayısını mümkün olduğunca AZ tut (3-5 aralığının alt ucu) ve sadece konunun çekirdek kavramlarını kapsa — ayrıntı/yan konular için ayrı alt başlık açma.'
        : 'Buna göre alt başlık sayısını üst sınıra yaklaştırabilir, konuyu ayrıntılı/yan kavramlarıyla birlikte ele alabilirsin.';
    return `Süre notu: ${timeContext} ${instruction}\n`;
  }

  const instruction =
    info.label === 'ozet'
      ? 'İçeriği buna göre ÖZETLE — sadece en kritik kavram ve kazanımları vurgula, gereksiz detay/uzun örneklerden kaçın; öğrencinin bu süre içinde gerçekten işleyebileceği bir yoğunlukta tut.'
      : 'İçeriği buna göre DETAYLANDIR — kavramları örneklerle derinleştir, önemli noktaları daha geniş açıkla.';
  return `Süre notu: ${timeContext} ${instruction}\n`;
}
