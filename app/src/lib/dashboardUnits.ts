import type { SupabaseClient } from '@supabase/supabase-js';
import { Unit, UnitTopic, Week } from '@/app/src/models/types';
import { getCurriculumCalendar } from './curriculumCalendar';
import { getCurrentCurriculumWeek } from './routeParsing';

type UnitRow = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number;
  start_week: number | null;
  end_week: number | null;
};

type TopicRow = { id: number; unit_id: number; title: string; slug: string | null; order_no: number };

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
  topicsByUnitId: Record<string, UnitTopic[]>;
  // Öğrencinin sınıfındaki TÜM dersler — panelde ders sekmeleri için (bkz.
  // docs/site-iyilestirme-plani.md madde 1 tartışması, 2026-09-02: panel eskiden sadece
  // en son pratik yapılan tek dersi gösteriyordu, kullanıcı diğer derslerin de erişilebilir
  // olmasını istedi). selectedLessonId, units/activeUnit* alanlarının hangi derse ait
  // olduğunu gösterir — sekmeye tıklayınca getUnitsForLesson ile yeniden çekilir.
  lessons: LessonOption[];
  selectedLessonId: string | null;
  gradeId: number | null;
}

// Ünite akordeonu için HER ünitenin konu listesini kurar — girdiler (topics, questions,
// içerik varlığı, kullanıcının içerik-tamamlama durumu, denenen soru id'leri) `getUnitsForLesson`
// tarafından zaten dersin TAMAMI için tek seferde çekilmiş oluyor; burası sadece bellekte
// gruplama yapar, hiç sorgu atmaz (eskiden her ünite için topics/questions/answers ayrı ayrı
// yeniden sorgulanıyordu). Konular arasında KİLİT YOK — her konuya her zaman erişilebilir.
// "Konu Anlatımı" ve "Soru Çöz" birbirinden bağımsız iki buton: içerik yoksa (topic_contents'te
// yayınlanmış satır yok) content href verilmez, soru yoksa quiz href verilmez — ikisi de UI
// tarafında "buton pasif" olarak gösterilir.
function buildTopicsByUnitId(
  topics: TopicRow[],
  questionIdsByTopic: Map<number, number[]>,
  contentTopicIds: Set<number>,
  contentCompletedByTopic: Map<number, boolean>,
  attemptedQuestionIds: Set<number>,
  gradeSlug: string | null,
  lessonSlug: string | null,
  unitSlugById: Map<number, string | null>
): Record<string, UnitTopic[]> {
  const topicsByUnit = new Map<number, TopicRow[]>();
  for (const t of topics) {
    const list = topicsByUnit.get(t.unit_id) || [];
    list.push(t);
    topicsByUnit.set(t.unit_id, list);
  }

  const result: Record<string, UnitTopic[]> = {};
  for (const [unitId, unitTopics] of topicsByUnit) {
    const unitSlug = unitSlugById.get(unitId) ?? null;
    const canBuildHref = !!(gradeSlug && lessonSlug && unitSlug);

    result[String(unitId)] = unitTopics
      .slice()
      .sort((a, b) => a.order_no - b.order_no)
      .map((t) => {
        const topicQuestionIds = questionIdsByTopic.get(t.id) || [];
        const hasQuestions = topicQuestionIds.length > 0;
        const attemptedCount = topicQuestionIds.filter((id) => attemptedQuestionIds.has(id)).length;
        const quizProgress = hasQuestions ? Math.round((attemptedCount / topicQuestionIds.length) * 100) : 0;
        const quizCompleted = hasQuestions && attemptedCount === topicQuestionIds.length;
        const hasContent = contentTopicIds.has(t.id);

        const baseHref = canBuildHref && t.slug ? `/${gradeSlug}/${lessonSlug}/${unitSlug}/${t.slug}` : undefined;

        return {
          id: String(t.id),
          title: t.title,
          contentHref: hasContent ? baseHref : undefined,
          contentCompleted: contentCompletedByTopic.get(t.id) === true,
          quizHref: hasQuestions ? (baseHref ? `${baseHref}/kavrama-testi` : undefined) : undefined,
          quizProgress,
          quizCompleted,
        };
      });
  }
  return result;
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
  topicsByUnitId: Record<string, UnitTopic[]>;
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
      topicsByUnitId: {},
    };
  }

  const unitIds = units.map((u) => u.id);
  const unitSlugById = new Map<number, string | null>(units.map((u) => [u.id, u.slug]));

  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, unit_id, title, slug, order_no')
    .in('unit_id', unitIds)
    .eq('is_active', true);
  const topics = (topicRows as TopicRow[] | null) || [];

  const topicCountByUnit = new Map<number, number>();
  const unitIdByTopicId = new Map<number, number>();
  for (const t of topics) {
    topicCountByUnit.set(t.unit_id, (topicCountByUnit.get(t.unit_id) || 0) + 1);
    unitIdByTopicId.set(t.id, t.unit_id);
  }

  const topicIds = topics.map((t) => t.id);

  // topics/questions bu dersin TÜM üniteleri için tek seferde çekiliyor — hem ünite
  // kartlarındaki soru sayısı/ilerleme hem akordeondaki her konunun satırı AYNI veriden
  // kuruluyor (eskiden aktif ünitenin konuları için bunlar ayrıca yeniden sorgulanıyordu).
  const [{ data: questionRows }, { data: contentRows }, { data: contentProgressRows }] = topicIds.length
    ? await Promise.all([
        supabase.from('questions').select('id, topic_id').in('topic_id', topicIds),
        supabase.from('topic_contents').select('topic_id').in('topic_id', topicIds).eq('is_published', true),
        supabase.from('user_topic_content_progress').select('topic_id, is_completed').eq('user_id', userId).in('topic_id', topicIds),
      ])
    : [{ data: [] as { id: number; topic_id: number }[] }, { data: [] as { topic_id: number }[] }, { data: [] as { topic_id: number; is_completed: boolean }[] }];
  const questions = (questionRows as { id: number; topic_id: number }[] | null) || [];
  const contentTopicIds = new Set(((contentRows as { topic_id: number }[] | null) || []).map((r) => r.topic_id));
  const contentCompletedByTopic = new Map<number, boolean>();
  for (const row of (contentProgressRows as { topic_id: number; is_completed: boolean }[] | null) || []) {
    contentCompletedByTopic.set(row.topic_id, row.is_completed);
  }

  const questionIdsByUnit = new Map<number, number[]>();
  const questionIdsByTopic = new Map<number, number[]>();
  const allQuestionIds: number[] = [];
  for (const q of questions) {
    const unitId = unitIdByTopicId.get(q.topic_id);
    if (unitId != null) {
      const unitList = questionIdsByUnit.get(unitId) || [];
      unitList.push(q.id);
      questionIdsByUnit.set(unitId, unitList);
    }
    const topicList = questionIdsByTopic.get(q.topic_id) || [];
    topicList.push(q.id);
    questionIdsByTopic.set(q.topic_id, topicList);
    allQuestionIds.push(q.id);
  }

  // user_unit_summary KULLANILMIYOR — o da user_question_stats gibi sadece bir oturum
  // tamamen bitirildiğinde (finish_test_session) güncelleniyor ve günlerce eski/eksik
  // kalabiliyor (bkz. kullanıcıyla 2026-09-02 tartışması). "Çözüldü" sayısı ve başarı
  // oranı artık ham log olan test_session_answers'tan hesaplanıyor — konu ilerlemesiyle
  // (buildTopicsByUnitId) AYNI kaynak, tutarlı sayılar. Unit başına soru sayısı da
  // questionIdsByUnit'ten türetiliyor — ayrı bir getQuestionCountsByUnitId sorgusu artık yok.
  const { data: answerRows } = allQuestionIds.length
    ? await supabase.from('test_session_answers').select('question_id, is_correct').eq('user_id', userId).in('question_id', allQuestionIds)
    : { data: [] as { question_id: number; is_correct: boolean }[] };
  const answers = (answerRows as { question_id: number; is_correct: boolean }[] | null) || [];
  const attemptedQuestionIds = new Set(answers.map((a) => a.question_id));

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
    const totalQuestions = questionIdsByUnit.get(u.id)?.length ?? 0;
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

  // Akordeonun varsayılan açık ünitesi: henüz tamamlanmamış ilk ünite (müfredat sırasına
  // göre) — kullanıcının şu an fiilen çalışıyor olması beklenen ünite. Hiçbiri bu duruma
  // uymuyorsa (hepsi tamamlanmış) hiçbir ünite varsayılan açık gelmez.
  const activeUnit = mapped.find((u) => u.status === 'in_progress') ?? null;

  const topicsByUnitId = buildTopicsByUnitId(
    topics,
    questionIdsByTopic,
    contentTopicIds,
    contentCompletedByTopic,
    attemptedQuestionIds,
    gradeRow?.slug ?? null,
    lessonRow?.slug ?? null,
    unitSlugById
  );

  return {
    units: mapped,
    lessonName,
    gradeName,
    currentWeek,
    totalWeeks,
    activeUnitId: activeUnit?.id ?? null,
    topicsByUnitId,
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
