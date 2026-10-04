// Anasayfanın "canlı" bölümleri (2026-09-27 sade tasarım): Günün Sorusu, Okulda bu hafta,
// Yeni eklenenler. Hepsi anon client ile okunur ki sayfa ISR ile önbelleklenebilsin.
// Üçü de YALNIZ yayındaki ders-sınıfın konularını gösterir: ders kapalıysa (lessons.is_active)
// sorguda, o sınıfta kapalıysa (lesson_grades) getPublishedLessonGradeKeys ile elenir.
import type { SupabaseClient } from '@supabase/supabase-js';
import { getQuestionsByIds, type MultipleChoiceQuestion } from '@/app/src/lib/quizQuestions';
import { getCurriculumCalendar } from '@/app/src/lib/curriculumCalendar';
import { getCurrentCurriculumWeek } from '@/app/src/lib/routeParsing';
import { getPublishedLessonGradeKeys, lessonGradeKey } from '@/app/src/lib/publicGradeLesson';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

type Rel<T> = T | T[] | null;
const one = <T,>(r: Rel<T>): T | null => (Array.isArray(r) ? r[0] ?? null : r);

function topicHref(gradeSlug: string | null | undefined, lessonSlug: string | null | undefined, unitSlug: string | null | undefined, topicSlug: string | null | undefined) {
  return gradeSlug && lessonSlug && unitSlug && topicSlug ? `/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}` : null;
}

// Türkiye saatine göre "bugün" (YYYY-MM-DD) — Günün Sorusu gece yarısı değişsin.
function istanbulDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now);
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------------------
// Günün Sorusu: yayınlanmış bir konudaki, görselsiz, çoktan seçmeli sorulardan gün tarihine
// göre DETERMİNİSTİK seçim — aynı gün herkes aynı soruyu görür (paylaşılabilir, "bugünün
// sorusunu çözdün mü?" sohbeti), ertesi gün değişir. Görselli (SVG) sorular anasayfa
// kartında dar kalacağı için dışarıda.
// ---------------------------------------------------------------------------------------
export interface DailyQuestion {
  question: MultipleChoiceQuestion;
  gradeName: string;
  lessonName: string;
  topicTitle: string;
  topicHref: string | null;
}

export async function getDailyQuestion(supabase: AnySupabaseClient): Promise<DailyQuestion | null> {
  const { data: rows } = await supabase
    .from('questions')
    .select('id, topics!inner(title, slug, is_active, is_archived, topic_contents!inner(is_published), units!inner(slug, is_active, lesson_id, grade_id, grades(name, slug), lessons!inner(name, slug, is_active)))')
    .eq('is_active', true)
    .is('svg_content', null)
    .neq('question_type_id', 4)
    .eq('topics.is_active', true)
    .eq('topics.is_archived', false)
    .eq('topics.topic_contents.is_published', true)
    .eq('topics.units.is_active', true)
    .eq('topics.units.lessons.is_active', true)
    .order('id', { ascending: true });
  const published = await getPublishedLessonGradeKeys(supabase);

  type Row = {
    id: number;
    topics: Rel<{
      title: string;
      slug: string | null;
      units: Rel<{ slug: string | null; lesson_id: number; grade_id: number; grades: Rel<{ name: string; slug: string | null }>; lessons: Rel<{ name: string; slug: string | null }> }>;
    }>;
  };
  const candidates = ((rows as Row[] | null) || []).filter((r) => {
    const unit = one(one(r.topics)?.units ?? null);
    return !!unit && published.has(lessonGradeKey(unit.lesson_id, unit.grade_id));
  });
  if (!candidates.length) return null;

  const { data: choiceRows } = await supabase
    .from('question_choices')
    .select('question_id')
    .in('question_id', candidates.map((c) => c.id));
  const withChoices = new Set(((choiceRows as { question_id: number }[] | null) || []).map((c) => c.question_id));
  const pool = candidates.filter((c) => withChoices.has(c.id));
  if (!pool.length) return null;

  const picked = pool[hashString(istanbulDateKey()) % pool.length];
  const [question] = await getQuestionsByIds([picked.id]);
  if (!question || question.type !== 'multiple_choice') return null;

  const topic = one(picked.topics);
  const unit = one(topic?.units ?? null);
  const grade = one(unit?.grades ?? null);
  const lesson = one(unit?.lessons ?? null);
  return {
    question,
    gradeName: grade?.name ?? '',
    lessonName: lesson?.name ?? '',
    topicTitle: topic?.title ?? '',
    topicHref: topicHref(grade?.slug, lesson?.slug, unit?.slug, topic?.slug),
  };
}

// Haftalık Günün Sorusu seti (2026-10-04, Vercel CPU): anasayfa 7 gün önbellekte ve pazar yenileniyor;
// günlük yenileme olmasın diye sunucu sayfa üretilirken 7 soru seçer, tarayıcı bugünün tarihine göre
// birini gösterir (bkz. DailyQuestionCard.tsx → DailyQuestionOfTheDay). Seçim, getDailyQuestion ile
// aynı havuzdan ve aynı kurallarla (yayındaki konu, görselsiz, çoktan seçmeli); tohum seçim günüdür.
// getDailyQuestion silinmedi — önbellek eski düzene dönerse tekrar kullanılabilir.
export interface DailyQuestionSet {
  // Setin seçildiği gün (İstanbul, YYYY-MM-DD) — tarayıcı bugünle arasındaki gün farkından soru seçer.
  startKey: string;
  items: DailyQuestion[];
}

export async function getDailyQuestionSet(supabase: AnySupabaseClient, count = 7): Promise<DailyQuestionSet | null> {
  const { data: rows } = await supabase
    .from('questions')
    .select('id, topics!inner(title, slug, is_active, is_archived, topic_contents!inner(is_published), units!inner(slug, is_active, lesson_id, grade_id, grades(name, slug), lessons!inner(name, slug, is_active)))')
    .eq('is_active', true)
    .is('svg_content', null)
    .neq('question_type_id', 4)
    .eq('topics.is_active', true)
    .eq('topics.is_archived', false)
    .eq('topics.topic_contents.is_published', true)
    .eq('topics.units.is_active', true)
    .eq('topics.units.lessons.is_active', true)
    .order('id', { ascending: true });
  const published = await getPublishedLessonGradeKeys(supabase);

  type Row = {
    id: number;
    topics: Rel<{
      title: string;
      slug: string | null;
      units: Rel<{ slug: string | null; lesson_id: number; grade_id: number; grades: Rel<{ name: string; slug: string | null }>; lessons: Rel<{ name: string; slug: string | null }> }>;
    }>;
  };
  const candidates = ((rows as Row[] | null) || []).filter((r) => {
    const unit = one(one(r.topics)?.units ?? null);
    return !!unit && published.has(lessonGradeKey(unit.lesson_id, unit.grade_id));
  });
  if (!candidates.length) return null;

  const { data: choiceRows } = await supabase
    .from('question_choices')
    .select('question_id')
    .in('question_id', candidates.map((c) => c.id));
  const withChoices = new Set(((choiceRows as { question_id: number }[] | null) || []).map((c) => c.question_id));
  const pool = candidates.filter((c) => withChoices.has(c.id));
  if (!pool.length) return null;

  const startKey = istanbulDateKey();
  const pickedIdx: number[] = [];
  for (let i = 0; pickedIdx.length < Math.min(count, pool.length) && i < count * 20; i++) {
    const idx = hashString(`${startKey}#${i}`) % pool.length;
    if (!pickedIdx.includes(idx)) pickedIdx.push(idx);
  }
  const picked = pickedIdx.map((i) => pool[i]);
  const questions = await getQuestionsByIds(picked.map((p) => p.id));
  const byId = new Map(questions.map((q) => [q.id, q]));

  const items: DailyQuestion[] = [];
  for (const row of picked) {
    const question = byId.get(row.id);
    if (!question || question.type !== 'multiple_choice') continue;
    const topic = one(row.topics);
    const unit = one(topic?.units ?? null);
    const grade = one(unit?.grades ?? null);
    const lesson = one(unit?.lessons ?? null);
    items.push({
      question,
      gradeName: grade?.name ?? '',
      lessonName: lesson?.name ?? '',
      topicTitle: topic?.title ?? '',
      topicHref: topicHref(grade?.slug, lesson?.slug, unit?.slug, topic?.slug),
    });
  }
  return items.length ? { startKey, items } : null;
}

// ---------------------------------------------------------------------------------------
// Yeni eklenenler: en son yayınlanan konu anlatımları (tüm sınıflar).
// ---------------------------------------------------------------------------------------
export interface RecentTopicItem {
  id: number;
  title: string;
  gradeName: string;
  lessonName: string;
  href: string | null;
  publishedAt: string;
  // Son 3 günde yayınlandı → "YENİ" rozeti. Sunucu değeri yalnız ilk render içindir; istemci
  // publishedAt'ten yeniden hesaplar (HomeHighlightCards NewBadge — sayfa haftalık önbellekte).
  isNew: boolean;
  // Konu kapak görseli (topic_contents.hero_image_url); yoksa kartta ders renginde ikon.
  imageUrl: string | null;
}

export async function getRecentlyPublishedTopics(supabase: AnySupabaseClient, limit = 5, gradeId?: number): Promise<RecentTopicItem[]> {
  let query = supabase
    .from('topic_contents')
    .select('created_at, hero_image_url, topics!inner(id, title, slug, is_active, is_archived, units!inner(slug, is_active, lesson_id, grade_id, grades(name, slug, is_active), lessons!inner(name, slug, is_active)))')
    .eq('is_published', true)
    .eq('topics.is_active', true)
    .eq('topics.is_archived', false)
    .eq('topics.units.is_active', true)
    .eq('topics.units.lessons.is_active', true);
  if (gradeId != null) query = query.eq('topics.units.grade_id', gradeId);
  const [{ data }, published] = await Promise.all([query.order('created_at', { ascending: false }).limit(limit * 3), getPublishedLessonGradeKeys(supabase)]);

  type Row = {
    created_at: string;
    hero_image_url: string | null;
    topics: Rel<{
      id: number;
      title: string;
      slug: string | null;
      units: Rel<{ slug: string | null; lesson_id: number; grade_id: number; grades: Rel<{ name: string; slug: string | null; is_active: boolean }>; lessons: Rel<{ name: string; slug: string | null }> }>;
    }>;
  };
  const seen = new Set<number>();
  const items: RecentTopicItem[] = [];
  for (const row of (data as Row[] | null) || []) {
    const topic = one(row.topics);
    const unit = one(topic?.units ?? null);
    const grade = one(unit?.grades ?? null);
    const lesson = one(unit?.lessons ?? null);
    if (!topic || !unit || !grade?.is_active || seen.has(topic.id)) continue;
    if (!published.has(lessonGradeKey(unit.lesson_id, unit.grade_id))) continue;
    seen.add(topic.id);
    items.push({
      id: topic.id,
      title: topic.title,
      gradeName: grade.name,
      lessonName: lesson?.name ?? '',
      href: topicHref(grade.slug, lesson?.slug, unit?.slug, topic.slug),
      publishedAt: row.created_at,
      isNew: Date.now() - new Date(row.created_at).getTime() < 3 * 86_400_000,
      imageUrl: row.hero_image_url,
    });
    if (items.length >= limit) break;
  }
  return items;
}

// Sınıf başına son eklenen konular (girişli anasayfa, kendi sınıfı — 2026-10-02).
export async function getRecentlyPublishedTopicsByGrade(supabase: AnySupabaseClient, gradeIds: number[], limit = 5): Promise<Record<string, RecentTopicItem[]>> {
  const lists = await Promise.all(gradeIds.map((id) => getRecentlyPublishedTopics(supabase, limit, id)));
  return Object.fromEntries(gradeIds.map((id, i) => [String(id), lists[i]]));
}

// ---------------------------------------------------------------------------------------
// Okulda bu hafta: müfredat takvimine (curriculum_calendar_settings + tatiller) göre bugünün
// öğretim haftası, kazanımların hafta aralığı (outcome_weeks) bu haftayı kapsayan konular.
// Eski "Haftanın Konuları" takvime bakmıyordu (her dersten sabit formülle bir konu → liste hiç
// değişmiyordu). Hafta verisi olmayan sınıf için BOŞ döner — anasayfa kartı o sınıfta hiç
// göstermez (yanlış "bu hafta" iddiası yerine). Yıllık plan aktarıldıkça kendiliğinden dolar.
// ---------------------------------------------------------------------------------------
export interface ThisWeekTopicItem {
  id: number;
  title: string;
  lessonName: string;
  href: string | null;
  // Konu kapak görseli (topic_contents.hero_image_url); varsa kartta ikon yerine o.
  imageUrl: string | null;
}

export async function getThisWeekTopicsByGrade(supabase: AnySupabaseClient): Promise<{ week: number; byGradeId: Record<string, ThisWeekTopicItem[]> }> {
  const calendar = await getCurriculumCalendar(supabase);
  const week = getCurrentCurriculumWeek(38, calendar.termStartDate, calendar.breaks);

  const [{ data }, published] = await Promise.all([
    supabase
      .from('outcome_weeks')
      .select('start_week, end_week, outcomes!inner(is_current, topics!inner(id, title, slug, is_active, is_archived, topic_contents!inner(is_published, hero_image_url), units!inner(lesson_id, grade_id, slug, is_active, grades(slug), lessons!inner(name, slug, is_active))))')
      .lte('start_week', week)
      .eq('outcomes.is_current', true)
      .eq('outcomes.topics.is_active', true)
      .eq('outcomes.topics.is_archived', false)
      .eq('outcomes.topics.topic_contents.is_published', true)
      .eq('outcomes.topics.units.is_active', true)
      .eq('outcomes.topics.units.lessons.is_active', true),
    getPublishedLessonGradeKeys(supabase),
  ]);

  type Row = {
    start_week: number;
    end_week: number | null;
    outcomes: Rel<{
      topics: Rel<{
        id: number;
        title: string;
        slug: string | null;
        topic_contents: Rel<{ hero_image_url: string | null }>;
        units: Rel<{ lesson_id: number; grade_id: number; slug: string | null; grades: Rel<{ slug: string | null }>; lessons: Rel<{ name: string; slug: string | null }> }>;
      }>;
    }>;
  };

  const byGradeId: Record<string, ThisWeekTopicItem[]> = {};
  const seen = new Set<number>();
  for (const row of (data as Row[] | null) || []) {
    if ((row.end_week ?? row.start_week) < week) continue;
    const topic = one(one(row.outcomes)?.topics ?? null);
    const unit = one(topic?.units ?? null);
    if (!topic || !unit || seen.has(topic.id)) continue;
    if (!published.has(lessonGradeKey(unit.lesson_id, unit.grade_id))) continue;
    seen.add(topic.id);
    const lesson = one(unit.lessons);
    const grade = one(unit.grades);
    (byGradeId[String(unit.grade_id)] ||= []).push({
      id: topic.id,
      title: topic.title,
      lessonName: lesson?.name ?? '',
      href: topicHref(grade?.slug, lesson?.slug, unit.slug, topic.slug),
      imageUrl: one(topic.topic_contents)?.hero_image_url ?? null,
    });
  }
  for (const list of Object.values(byGradeId)) list.sort((a, b) => a.lessonName.localeCompare(b.lessonName, 'tr'));
  return { week, byGradeId };
}
