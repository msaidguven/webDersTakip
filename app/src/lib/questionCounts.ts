import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from './fetchAllRows';

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

// PostgREST tek istekte en fazla 1000 satır döndürür — satırları çekip JS'te saymak ya da
// id listesi toplamak, toplam 1000'i geçince SESSİZCE eksik sonuç verir. Bu yüzden:
//   • sayımlar DB'de GROUP BY ile (count_questions_by_topic RPC'si, bkz.
//     count_questions_by_topic_filters.sql) — konu listesi RPC'nin dönüşü de 1000'e
//     takılmasın diye parçalar halinde gönderilir;
//   • gerçekten satır gereken yerler (silme için id listesi, kullanıcı istatistiği eşleme)
//     fetchAllQuestionRows ile sayfa sayfa okur.
const TOPIC_CHUNK = 500;

type QuestionFilter = { activeOnly?: boolean; excludeClassical?: boolean };

// Soru satırlarını id sırasıyla sayfa sayfa okur (bkz. fetchAllRows); filtre yoksa tüm satırlar.
export async function fetchAllQuestionRows<T>(
  supabase: AnySupabaseClient,
  columns: string,
  topicIds: number[],
  opts?: QuestionFilter
): Promise<T[]> {
  if (!topicIds.length) return [];
  return fetchAllRows<T>((from, to) => {
    let query = supabase.from('questions').select(columns).in('topic_id', topicIds);
    if (opts?.activeOnly) query = query.eq('is_active', true);
    if (opts?.excludeClassical) query = query.neq('question_type_id', 4);
    return query.order('id', { ascending: true }).range(from, to);
  });
}

// Verilen topic id'lerine doğrudan bağlı (questions.topic_id) soruların id listesini döner.
// Silme/listeleme akışlarının ortak kaynağı — hiçbir yerde question_usages'a bakılmaz.
export async function getQuestionIdsForTopics(supabase: AnySupabaseClient, topicIds: number[]): Promise<number[]> {
  const rows = await fetchAllQuestionRows<{ id: number }>(supabase, 'id', topicIds);
  return rows.map((r) => r.id);
}

// activeOnly=true, taslak (svg_prompt bekleyen/yayınlanmamış, is_active=false) soruları
// sayıma dahil etmez — öğrenciye gösterilen sayfalarda kullanılmalı. Admin yönetim
// ekranları (ve silme akışları, ki taslakları da silmesi gerekir) activeOnly'yi vermeyip
// gerçek toplamı görmeye devam eder.
// excludeClassical=true, question_type_id=4 (klasik/açık uçlu, otomatik değerlendirilemeyen)
// soruları da sayıma dahil etmez — öğrencinin etkileşime girdiği HER sayfada (ünite/konu
// sayfası, testler, panel, soru bankası) kullanılmalı; sadece ana sayfadaki toplam sayı
// (bkz. homeStats.ts:getPublishedUnitContent, RPC count_questions_by_topic) bilerek klasik
// soruları da sayar — kullanıcı isteği, 2026-09-13: "ilerde klasik soruları göstermek
// istediğim yerde göstersin" — o yüzden ayrı, açık bir opt-in/opt-out flag.
export async function getQuestionCountsByTopicId(
  supabase: AnySupabaseClient,
  topicIds: number[],
  opts?: QuestionFilter
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  const unique = [...new Set(topicIds)];
  const chunks: number[][] = [];
  for (let i = 0; i < unique.length; i += TOPIC_CHUNK) chunks.push(unique.slice(i, i + TOPIC_CHUNK));

  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase.rpc('count_questions_by_topic', {
        p_topic_ids: chunk,
        p_active_only: !!opts?.activeOnly,
        p_exclude_classical: !!opts?.excludeClassical,
      })
    )
  );
  for (const { data, error } of results) {
    // Sessizce 0 göstermek yerine hata ver — sayfa ISR'da bir önceki (doğru) sürümü sunmaya devam eder.
    if (error) throw new Error(`count_questions_by_topic başarısız: ${error.message}`);
    for (const r of (data as { topic_id: number; cnt: number }[] | null) || []) counts.set(Number(r.topic_id), Number(r.cnt));
  }
  return counts;
}

export async function getQuestionCountsByUnitId(
  supabase: AnySupabaseClient,
  unitIds: number[],
  opts?: QuestionFilter
): Promise<Map<number, number>> {
  if (!unitIds.length) return new Map();

  const { data: topicsData } = await supabase.from('topics').select('id, unit_id').in('unit_id', unitIds);
  const topics = (topicsData as { id: number; unit_id: number }[] | null) || [];
  const topicCounts = await getQuestionCountsByTopicId(supabase, topics.map((t) => t.id), opts);

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
  pairs: { lessonId: number; gradeId: number }[],
  opts?: QuestionFilter
): Promise<Map<string, number>> {
  if (!pairs.length) return new Map();

  const lessonIds = Array.from(new Set(pairs.map((p) => p.lessonId)));
  const gradeIds = Array.from(new Set(pairs.map((p) => p.gradeId)));

  // Sadece units → topics id'leri çekilip sayım RPC'ye bırakılıyor (eskiden tüm soru
  // satırları nested embed ile çekilip JS'te sayılıyordu).
  const { data: unitsData } = await supabase
    .from('units')
    .select('lesson_id, grade_id, topics(id)')
    .in('lesson_id', lessonIds)
    .in('grade_id', gradeIds);
  const units = (unitsData as { lesson_id: number; grade_id: number; topics: { id: number }[] | null }[] | null) || [];
  const topicCounts = await getQuestionCountsByTopicId(supabase, units.flatMap((u) => (u.topics ?? []).map((t) => t.id)), opts);

  const result = new Map<string, number>();
  for (const u of units) {
    const questionCount = (u.topics ?? []).reduce((sum, t) => sum + (topicCounts.get(t.id) ?? 0), 0);
    const key = `${u.lesson_id}:${u.grade_id}`;
    result.set(key, (result.get(key) ?? 0) + questionCount);
  }
  return result;
}
