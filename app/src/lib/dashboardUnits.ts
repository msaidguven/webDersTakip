import type { SupabaseClient } from '@supabase/supabase-js';
import { TopicProgress, Unit, Week } from '@/app/src/models/types';
import { getCurriculumCalendar } from './curriculumCalendar';
import { getCurrentCurriculumWeek } from './routeParsing';
import { getQuestionCountsByUnitId } from './questionCounts';

type UnitRow = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number;
  start_week: number | null;
  end_week: number | null;
};

export interface LessonOption {
  id: string;
  name: string;
}

export interface DashboardUnitsResult {
  units: Unit[];
  lessonName: string | null;
  gradeName: string | null;
  currentWeek: number;
  totalWeeks: number;
  activeUnitId: string | null;
  activeUnitTitle: string | null;
  activeUnitTopics: TopicProgress[];
  // Öğrencinin sınıfındaki TÜM dersler — panelde ders sekmeleri için (bkz.
  // docs/site-iyilestirme-plani.md madde 1 tartışması, 2026-09-02: panel eskiden sadece
  // en son pratik yapılan tek dersi gösteriyordu, kullanıcı diğer derslerin de erişilebilir
  // olmasını istedi). selectedLessonId, units/activeUnit* alanlarının hangi derse ait
  // olduğunu gösterir — sekmeye tıklayınca getUnitsForLesson ile yeniden çekilir.
  lessons: LessonOption[];
  selectedLessonId: string | null;
  gradeId: number | null;
}

// Verilen soruların hangilerinin bu kullanıcı tarafından EN AZ BİR KEZ denendiğini
// doğrudan ham log olan test_session_answers'tan döner — user_question_stats/
// user_unit_summary gibi rollup'lar SADECE bir oturum tamamen bitirildiğinde
// (finish_test_session) güncelleniyor; QuizClient bilinçli olarak "sayfadan ayrılırsa
// oturumu otomatik bitirme" mantığı kullandığı için (bkz. 2026-09-02 tarihli not) çoğu
// oturum hiç "bitmiyor" ve o rollup'lar günlerce eski/eksik kalabiliyor — gerçek veride
// doğrulandı: bir öğrenci 19 farklı soru çözmüştü, user_question_stats'ta sadece 10'u
// vardı. Bu yüzden konu/ünite ilerlemesi hep buradan, ham logdan hesaplanır.
async function getAttemptedQuestionIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  questionIds: number[]
): Promise<Set<number>> {
  if (!questionIds.length) return new Set();
  const { data } = await supabase
    .from('test_session_answers')
    .select('question_id')
    .eq('user_id', userId)
    .in('question_id', questionIds);
  return new Set(((data as { question_id: number }[] | null) || []).map((r) => r.question_id));
}

// Aktif ünitenin konularını TEK SATIRLIK bir liste olarak döner — kullanıcının verdiği
// referans tasarıma göre (2026-09-02). Konular arasında KİLİT YOK — hangi sırada olursa
// olsun her konuya her zaman erişilebilir (bkz. kullanıcıyla "kilitli üniteler" tartışması:
// haftaya göre ünite kilidi de aynı sebeple kaldırılmıştı). Her konunun iki bağımsız
// alt-durumu var (anlatım + sorular) ama TEK satırda tek ilerleme/tek buton gösterildiği
// için burada "hangi adımdasın" mantığıyla birleştiriliyor:
//   1) Anlatım bitmemişse ("Konuyu Bitirdim" tıklanmamış, user_topic_content_progress) →
//      buton "Konu Anlatımı", ilerleme %0 — anlatımın ne kadarının okunduğuna dair GERÇEK
//      bir kısmi veri yok (tek bilinen şey bitirilip bitirilmediği), bu yüzden yarı yolda
//      uydurma bir yüzde (ör. %50) GÖSTERİLMİYOR.
//   2) Sorulardan en az biri denenmişse (contentCompleted olsun olmasın — gerçek ilerleme
//      neredeyse orada gösterilir) → buton "Soru Çöz", ilerleme = denenen soru yüzdesi
//      (getAttemptedQuestionIds, bir kez denenen soru geri dönmez). Bu GERÇEK bir oran.
//   3) İkisi de bitmişse (ya da hiç sorusu yoksa) → tamamlandı, buton "Konu Anlatımı"
//      (tekrar bakmak için), ilerleme 100.
async function getActiveUnitTopics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  unitId: number,
  gradeSlug: string | null,
  lessonSlug: string | null,
  unitSlug: string | null
): Promise<TopicProgress[]> {
  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, title, slug, order_no')
    .eq('unit_id', unitId)
    .eq('is_active', true)
    .order('order_no', { ascending: true });

  const topics = (topicsData as { id: number; title: string; slug: string | null; order_no: number }[] | null) || [];
  if (!topics.length) return [];

  const topicIds = topics.map((t) => t.id);

  const [{ data: contentProgressData }, { data: questionsData }] = await Promise.all([
    supabase
      .from('user_topic_content_progress')
      .select('topic_id, is_completed')
      .eq('user_id', userId)
      .in('topic_id', topicIds),
    supabase.from('questions').select('id, topic_id').in('topic_id', topicIds),
  ]);

  const contentCompletedByTopic = new Map<number, boolean>();
  for (const row of (contentProgressData as { topic_id: number; is_completed: boolean }[] | null) || []) {
    contentCompletedByTopic.set(row.topic_id, row.is_completed);
  }

  const questionIdsByTopic = new Map<number, number[]>();
  const allQuestionIds: number[] = [];
  for (const row of (questionsData as { id: number; topic_id: number }[] | null) || []) {
    const list = questionIdsByTopic.get(row.topic_id) || [];
    list.push(row.id);
    questionIdsByTopic.set(row.topic_id, list);
    allQuestionIds.push(row.id);
  }

  const attemptedQuestionIds = await getAttemptedQuestionIds(supabase, userId, allQuestionIds);

  const canBuildHref = !!(gradeSlug && lessonSlug && unitSlug);

  return topics.map((t) => {
    const contentCompleted = contentCompletedByTopic.get(t.id) === true;

    const topicQuestionIds = questionIdsByTopic.get(t.id) || [];
    const hasQuestions = topicQuestionIds.length > 0;
    const attemptedCount = topicQuestionIds.filter((id) => attemptedQuestionIds.has(id)).length;
    const questionProgress = hasQuestions ? Math.round((attemptedCount / topicQuestionIds.length) * 100) : 0;
    const questionsCompleted = !hasQuestions || attemptedCount === topicQuestionIds.length;

    const contentHref = canBuildHref && t.slug ? `/${gradeSlug}/${lessonSlug}/${unitSlug}/${t.slug}` : undefined;
    const quizHref = contentHref && hasQuestions ? `${contentHref}/kavrama-testi` : undefined;

    if (contentCompleted && questionsCompleted) {
      return {
        id: String(t.id),
        title: t.title,
        status: 'completed' as const,
        progressPercent: 100,
        actionLabel: 'Konu Anlatımı' as const,
        actionHref: contentHref,
      };
    }

    // "Hangi adımda gerçek ilerleme varsa o gösterilir" — anlatım bitmemiş olsa bile
    // öğrenci o konudan soru çözmüş olabilir (bkz. kullanıcıyla 2026-09-02 tartışması:
    // önceki sürüm anlatım bitene kadar soru ilerlemesini görmezden geliyordu, bu yüzden
    // gerçekten çözülmüş sorular olsa bile satır %0 gösteriyordu — bu artık düzeltildi).
    if (contentCompleted || (hasQuestions && attemptedCount > 0)) {
      return {
        id: String(t.id),
        title: t.title,
        status: 'in_progress' as const,
        progressPercent: questionProgress,
        actionLabel: 'Soru Çöz' as const,
        actionHref: quizHref,
      };
    }

    return {
      id: String(t.id),
      title: t.title,
      status: 'in_progress' as const,
      progressPercent: 0,
      actionLabel: 'Konu Anlatımı' as const,
      actionHref: contentHref,
    };
  });
}

// WeeklyProgress kartlarında gösterilecek 5 haftalık pencereyi (mevcut haftanın bir öncesinden
// başlayarak) müfredat haftasına göre kurar. Haftaya tıklamanın o haftanın içeriğini yüklemesi
// kapsam dışı bırakıldı (bkz. docs/site-iyilestirme-plani.md tartışması) — sadece hangi haftanın
// geçmiş/şimdi/gelecek/kilitli olduğunu göstermek için gerçek veri kullanılıyor.
export function buildWeekWindow(windowStart: number, currentWeek: number, totalWeeks: number): Week[] {
  const start = Math.max(1, windowStart);
  const weeks: Week[] = [];
  for (let n = start; n < start + 5; n++) {
    let status: Week['status'];
    let label: string;
    if (n > totalWeeks) {
      status = 'locked';
      label = 'Kilitli';
    } else if (n < currentWeek) {
      status = 'past';
      label = 'Geçen';
    } else if (n === currentWeek) {
      status = 'current';
      label = 'Şimdi';
    } else {
      status = 'future';
      label = 'Gelecek';
    }
    weeks.push({ id: n, number: n, label, status });
  }
  return weeks;
}

// Öğrencinin sınıfında (grade_id) tanımlı, aktif TÜM dersleri döner — panelin ders
// sekmeleri için. lesson_grades hem dersin o sınıfta aktif olup olmadığını (is_active)
// hem de dersin kendisinin aktif olup olmadığını (lessons.is_active) ayrı ayrı tutuyor,
// ikisi de true olmalı.
export async function getLessonsForGrade(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  gradeId: number
): Promise<LessonOption[]> {
  const { data } = await supabase
    .from('lesson_grades')
    .select('lesson_id, lessons(id, name, is_active)')
    .eq('grade_id', gradeId)
    .eq('is_active', true);

  type Row = { lesson_id: number; lessons: { id: number; name: string; is_active: boolean } | { id: number; name: string; is_active: boolean }[] | null };
  const rows = (data as Row[] | null) || [];

  const lessons: LessonOption[] = [];
  for (const row of rows) {
    const lessonRow = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
    if (!lessonRow || lessonRow.is_active === false) continue;
    lessons.push({ id: String(lessonRow.id), name: lessonRow.name });
  }
  lessons.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  return lessons;
}

export interface LessonUnitsResult {
  units: Unit[];
  lessonName: string | null;
  gradeName: string | null;
  currentWeek: number;
  totalWeeks: number;
  activeUnitId: string | null;
  activeUnitTitle: string | null;
  activeUnitTopics: TopicProgress[];
}

// Belirli bir ders+sınıf için ünite listesini (ilerleme, soru sayısı vb. gerçek veriyle)
// ve aktif ünitenin konu ilerlemesini kurar. Hem varsayılan panel yüklemesi hem de
// kullanıcının bir ders sekmesine tıklayıp dersi DEĞİŞTİRMESİ aynı fonksiyonu kullanır.
export async function getUnitsForLesson(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  lessonId: number,
  gradeId: number
): Promise<LessonUnitsResult> {
  const { termStartDate, breaks } = await getCurriculumCalendar(supabase);

  const [{ data: unitsData }, { data: lesson }, { data: grade }] = await Promise.all([
    supabase
      .from('units')
      .select('id, title, slug, order_no, start_week, end_week')
      .eq('lesson_id', lessonId)
      .eq('grade_id', gradeId)
      .eq('is_active', true)
      .order('order_no', { ascending: true }),
    supabase.from('lessons').select('name, slug').eq('id', lessonId).maybeSingle(),
    supabase.from('grades').select('name, slug').eq('id', gradeId).maybeSingle(),
  ]);

  const units = (unitsData as UnitRow[] | null) || [];
  const lessonRow = lesson as { name: string; slug: string | null } | null;
  const gradeRow = grade as { name: string; slug: string | null } | null;
  const lessonName = lessonRow?.name ?? null;
  const gradeName = gradeRow?.name ?? null;

  if (units.length === 0) {
    const totalWeeks = 38;
    return {
      units: [],
      lessonName,
      gradeName,
      totalWeeks,
      currentWeek: getCurrentCurriculumWeek(totalWeeks, termStartDate, breaks),
      activeUnitId: null,
      activeUnitTitle: null,
      activeUnitTopics: [],
    };
  }

  const unitIds = units.map((u) => u.id);

  const { data: topicRows } = await supabase.from('topics').select('id, unit_id').in('unit_id', unitIds).eq('is_active', true);
  const topics = (topicRows as { id: number; unit_id: number }[] | null) || [];

  const topicCountByUnit = new Map<number, number>();
  const unitIdByTopicId = new Map<number, number>();
  for (const t of topics) {
    topicCountByUnit.set(t.unit_id, (topicCountByUnit.get(t.unit_id) || 0) + 1);
    unitIdByTopicId.set(t.id, t.unit_id);
  }

  const topicIds = topics.map((t) => t.id);
  const { data: questionRows } = topicIds.length
    ? await supabase.from('questions').select('id, topic_id').in('topic_id', topicIds)
    : { data: [] as { id: number; topic_id: number }[] };
  const questions = (questionRows as { id: number; topic_id: number }[] | null) || [];

  const questionIdsByUnit = new Map<number, number[]>();
  const allQuestionIds: number[] = [];
  for (const q of questions) {
    const unitId = unitIdByTopicId.get(q.topic_id);
    if (unitId == null) continue;
    const list = questionIdsByUnit.get(unitId) || [];
    list.push(q.id);
    questionIdsByUnit.set(unitId, list);
    allQuestionIds.push(q.id);
  }

  // user_unit_summary KULLANILMIYOR — o da user_question_stats gibi sadece bir oturum
  // tamamen bitirildiğinde (finish_test_session) güncelleniyor ve günlerce eski/eksik
  // kalabiliyor (bkz. kullanıcıyla 2026-09-02 tartışması). "Çözüldü" sayısı ve başarı
  // oranı artık ham log olan test_session_answers'tan hesaplanıyor — konu ilerlemesiyle
  // (getActiveUnitTopics) AYNI kaynak, tutarlı sayılar.
  const [{ data: answerRows }, questionCountByUnit] = await Promise.all([
    allQuestionIds.length
      ? supabase.from('test_session_answers').select('question_id, is_correct').eq('user_id', userId).in('question_id', allQuestionIds)
      : Promise.resolve({ data: [] as { question_id: number; is_correct: boolean }[] }),
    getQuestionCountsByUnitId(supabase, unitIds),
  ]);
  const answers = (answerRows as { question_id: number; is_correct: boolean }[] | null) || [];

  const questionIdToUnitId = new Map<number, number>();
  for (const [unitId, ids] of questionIdsByUnit) {
    for (const id of ids) questionIdToUnitId.set(id, unitId);
  }

  const solvedIdsByUnit = new Map<number, Set<number>>();
  const correctByUnit = new Map<number, number>();
  const wrongByUnit = new Map<number, number>();
  for (const a of answers) {
    const unitId = questionIdToUnitId.get(a.question_id);
    if (unitId == null) continue;
    const solvedSet = solvedIdsByUnit.get(unitId) || new Set<number>();
    solvedSet.add(a.question_id);
    solvedIdsByUnit.set(unitId, solvedSet);
    if (a.is_correct) correctByUnit.set(unitId, (correctByUnit.get(unitId) ?? 0) + 1);
    else wrongByUnit.set(unitId, (wrongByUnit.get(unitId) ?? 0) + 1);
  }

  const totalWeeks = units.reduce((max, u) => Math.max(max, u.end_week ?? u.start_week ?? 0), 0) || 30;
  const currentWeek = getCurrentCurriculumWeek(totalWeeks, termStartDate, breaks);

  const mapped: Unit[] = units.map((u) => {
    const totalQuestions = questionCountByUnit.get(u.id) ?? 0;
    const totalTopics = topicCountByUnit.get(u.id) ?? 0;
    const solved = solvedIdsByUnit.get(u.id)?.size ?? 0;
    const startWeek = u.start_week ?? 1;
    const endWeek = u.end_week ?? startWeek;

    // Üniteler müfredat haftasına göre KİLİTLENMEZ — admin takvimi (curriculum_calendar_settings)
    // henüz ayarlanmamış/hatalı olsa bile öğrenci istediği üniteye her zaman erişebilmeli
    // (bkz. kullanıcıyla 2026-09-02 tartışması: haftaya göre kilitleme hiç istenmedi).
    const isCompleted = totalQuestions > 0 && solved >= totalQuestions;
    const status: Unit['status'] = isCompleted ? 'completed' : 'in_progress';
    const progress = totalQuestions > 0 ? Math.min(100, Math.round((solved / totalQuestions) * 100)) : 0;
    const correctCount = correctByUnit.get(u.id) ?? 0;
    const wrongCount = wrongByUnit.get(u.id) ?? 0;
    const answered = correctCount + wrongCount;
    const successRate = answered > 0 ? Math.round((correctCount / answered) * 100) : undefined;

    const weekLabel = startWeek === endWeek ? `${startWeek}. Hafta` : `${startWeek}-${endWeek}. Hafta`;
    const subtitle = isCompleted
      ? `${weekLabel} • Tamamlandı`
      : `${weekLabel} • ${totalTopics} Konu • ${totalQuestions} Soru`;

    const href = gradeRow?.slug && lessonRow?.slug && u.slug
      ? `/${gradeRow.slug}/${lessonRow.slug}/${u.slug}/unite-testi`
      : undefined;

    return {
      id: String(u.id),
      title: u.title,
      subtitle,
      weekNumber: startWeek,
      totalTopics,
      totalQuestions,
      solvedQuestions: solved,
      progress,
      status,
      successRate,
      href,
    };
  });

  // Panelin "Devam Edilen Konular" listesi için aktif ünite: henüz tamamlanmamış ilk
  // ünite (müfredat sırasına göre) — kullanıcının şu an fiilen çalışıyor olması beklenen
  // ünite. Hiçbiri bu duruma uymuyorsa (hepsi tamamlanmış) liste boş kalır.
  const activeUnit = mapped.find((u) => u.status === 'in_progress') ?? null;
  const activeUnitRaw = activeUnit ? units.find((u) => String(u.id) === activeUnit.id) ?? null : null;
  const activeUnitTopics = activeUnitRaw
    ? await getActiveUnitTopics(supabase, userId, activeUnitRaw.id, gradeRow?.slug ?? null, lessonRow?.slug ?? null, activeUnitRaw.slug)
    : [];

  return {
    units: mapped,
    lessonName,
    gradeName,
    currentWeek,
    totalWeeks,
    activeUnitId: activeUnit?.id ?? null,
    activeUnitTitle: activeUnit?.title ?? null,
    activeUnitTopics,
  };
}

// Kullanıcının profildeki (varsa) grade_id'siyle en son test_sessions kaydından türetilen
// VARSAYILAN ders bağlamı için ünite listesini gerçek veriden kurar (+ sınıftaki diğer tüm
// dersleri, panelin ders sekmeleri için — bkz. LessonOption). Panel kalıcı bir "sınıf/ders"
// seçimi tutmadığı için (bkz. app/src/viewmodels/useHomeViewModel.ts akışı) en son pratik
// yaptığı ders/sınıf en makul varsayılan bağlamdır; hiç test_sessions kaydı yoksa null döner
// ve çağıran taraf "henüz bir derse başlamadın" boş durumunu gösterir.
export async function getDashboardUnitsData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  profileGradeId: number | null
): Promise<DashboardUnitsResult | null> {
  let sessionQuery = supabase
    .from('test_sessions')
    .select('lesson_id, grade_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (profileGradeId) sessionQuery = sessionQuery.eq('grade_id', profileGradeId);
  let { data: sessionRows } = await sessionQuery;

  if (!sessionRows?.length && profileGradeId) {
    const { data: anySessionRows } = await supabase
      .from('test_sessions')
      .select('lesson_id, grade_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    sessionRows = anySessionRows;
  }

  const session = sessionRows?.[0] as { lesson_id: number; grade_id: number } | undefined;
  if (!session) return null;

  const { lesson_id: lessonId, grade_id: gradeId } = session;

  const [lessonUnits, lessons] = await Promise.all([
    getUnitsForLesson(supabase, userId, lessonId, gradeId),
    getLessonsForGrade(supabase, gradeId),
  ]);

  return {
    ...lessonUnits,
    lessons,
    selectedLessonId: String(lessonId),
    gradeId,
  };
}
