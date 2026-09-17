import type { SupabaseClient } from '@supabase/supabase-js';

export type TopicPacingInfo = {
  topicId: number;
  topicWeeks: number;
  unitWeeks: number;
  sharePct: number;
  hoursEstimate: number | null; // MUTLAK tahmini ders saati — varsa esas sınıflandırma bu üzerinden yapılır
  hoursSource: 'duration_hours' | 'weekly_hours' | null;
  label: 'ozet' | 'normal' | 'detayli';
};

type TopicRow = { id: number };
type OutcomeRow = { id: number; topic_id: number };
type OutcomeWeekRow = { outcome_id: number; start_week: number; end_week: number };

// Bir konunun MEB müfredatında ne kadar süreye sığdırıldığını hesaplar. ÖNCELİK: mutlak
// ders saati — units.duration_hours varsa konunun (outcome_weeks'ten çıkan) ünite içi hafta
// payına göre bölüştürülür (34 saatlik ünitede 3/18 hafta = ~5.7 saat gibi); o da yoksa
// lesson_grades.weekly_hours × konunun kendi hafta sayısı kullanılır. İKİSİ de yoksa (en sık
// durum — 2026-09-18 kontrolünde konuların çoğunda mutlak veri yok), göreceli paya (kardeş
// konulara oranla) düşülür — ama bu SADECE mutlak veri hiç yoksa kullanılan zayıf bir yedek.
//
// Kullanıcının 2026-09-18 bulduğu kritik hata: SADECE göreceli paya bakmak, bir ünitenin TÜM
// konuları kısaysa (ör. 4 saatlik ünitede 2 konu, ikisi de %50) hiçbirini "özet" olarak
// işaretlemiyordu — oysa 2 saatlik bir konu payından bağımsız olarak zaten kısa. Mutlak saat
// artık öncelikli sinyal.
const ABSOLUTE_OZET_MAX_HOURS = 3;
const ABSOLUTE_DETAYLI_MIN_HOURS = 8;

// "Ders saati" bir takvim saati değil, bir okul ders periyodu — kullanıcının belirttiği gibi
// 30 dakika. Promptta/rozette "2 ders saati" gibi belirsiz bir ifade yerine somut dakika/saat
// söylüyoruz (2026-09-18 kullanıcı isteği) — hem AI'nin süreyi gerçek bir saatle karıştırıp
// gereğinden uzun içerik üretmesini önlüyor hem admin için daha okunaklı.
const MINUTES_PER_DERS_SAATI = 30;

export function formatDersSaatiDuration(hoursEstimate: number): string {
  const totalMinutes = Math.round(hoursEstimate * MINUTES_PER_DERS_SAATI);
  if (totalMinutes <= 0) return '0 dakika';
  if (totalMinutes % 60 === 0) return `${totalMinutes / 60} saat`;
  if (totalMinutes < 60) return `${totalMinutes} dakika`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h} saat ${m} dakika`;
}

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

  const [{ data: unitRow }, { data: lessonGrade }] = await Promise.all([
    supabase.from('units').select('duration_hours').eq('id', unitId).maybeSingle(),
    supabase.from('lesson_grades').select('weekly_hours').eq('lesson_id', lessonId).eq('grade_id', gradeId).maybeSingle(),
  ]);
  const unitDurationHours = (unitRow as { duration_hours: number | null } | null)?.duration_hours || null;
  const weeklyHours = (lessonGrade as { weekly_hours: number | null } | null)?.weekly_hours || null;

  const avgShareFraction = 1 / spanByTopicId.size;

  for (const [topicId, span] of spanByTopicId) {
    const topicWeeks = span.max - span.min + 1;
    const shareFraction = topicWeeks / unitWeeks;

    let hoursRaw: number | null = null;
    let hoursSource: TopicPacingInfo['hoursSource'] = null;
    if (unitDurationHours) {
      hoursRaw = unitDurationHours * shareFraction;
      hoursSource = 'duration_hours';
    } else if (weeklyHours) {
      hoursRaw = weeklyHours * topicWeeks;
      hoursSource = 'weekly_hours';
    }

    let label: TopicPacingInfo['label'];
    if (hoursRaw != null) {
      label = hoursRaw <= ABSOLUTE_OZET_MAX_HOURS ? 'ozet' : hoursRaw >= ABSOLUTE_DETAYLI_MIN_HOURS ? 'detayli' : 'normal';
    } else {
      const ratio = shareFraction / avgShareFraction;
      label = ratio >= 1.3 ? 'detayli' : ratio <= 0.7 ? 'ozet' : 'normal';
    }

    result.set(topicId, {
      topicId,
      topicWeeks,
      unitWeeks,
      sharePct: Math.round(shareFraction * 100),
      hoursEstimate: hoursRaw != null ? Math.round(hoursRaw * 10) / 10 : null,
      hoursSource,
      label,
    });
  }

  return result;
}

// mode 'plan': alt başlık PLANLAMA promptu için (sayı/kapsam talimatı).
// mode 'content': tam içerik/yeniden yazma promptları için (anlatım derinliği talimatı).
// label 'normal' veya veri yoksa boş string döner — placeholder'ı sessizce siler.
export function buildPacingGuidance(info: TopicPacingInfo | undefined, mode: 'plan' | 'content'): string {
  if (!info || info.label === 'normal') return '';

  const timeContext =
    info.hoursEstimate != null
      ? info.label === 'ozet'
        ? `Bu konu MEB müfredatında toplam yaklaşık ${formatDersSaatiDuration(info.hoursEstimate)} sürede işlenecek şekilde planlanmış — çok kısa bir süre.`
        : `Bu konuya MEB müfredatında toplam yaklaşık ${formatDersSaatiDuration(info.hoursEstimate)} ayrılmış — bolca süre.`
      : info.label === 'ozet'
        ? `Bu konuya müfredatta ayrılan süre ünitenin diğer konularına göre kısıtlı (~${info.topicWeeks} hafta, ünitenin yaklaşık %${info.sharePct}'i).`
        : `Bu konuya müfredatta bolca süre ayrılmış (~${info.topicWeeks} hafta, ünitenin yaklaşık %${info.sharePct}'i).`;

  if (mode === 'plan') {
    const instruction =
      info.label === 'ozet'
        ? 'Buna göre alt başlık sayısını mümkün olduğunca AZ tut (3-5 aralığının alt ucu) ve sadece konunun çekirdek kavramlarını kapsa — ayrıntı/yan konular için ayrı alt başlık açma.'
        : 'Buna göre alt başlık sayısını üst sınıra yaklaştırabilir, konuyu ayrıntılı/yan kavramlarıyla birlikte ele alabilirsin.';
    return `Süre notu: ${timeContext} ${instruction}\n`;
  }

  const instruction =
    info.label === 'ozet'
      ? 'İçeriği buna göre ÖZETLE — sadece en kritik kavram ve kazanımları vurgula, öğrencinin gerçekten bu sürede öğrenebileceği kadarını yaz; uzun örnek/yan bilgi ekleme.'
      : 'İçeriği buna göre DETAYLANDIR — kavramları örneklerle derinleştir, önemli noktaları daha geniş açıkla.';
  return `Süre notu: ${timeContext} ${instruction}\n`;
}
