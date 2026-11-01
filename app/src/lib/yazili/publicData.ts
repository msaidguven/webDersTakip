// Yazılı soruları — herkese açık sayfaların verisi (anon client, ISR). Yalnız yayındaki yazılılar
// (exams.status='published', RLS de bunu zorunlu kılar) ve aktif klasik sorular döner.
import 'server-only';
import { cache } from 'react';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { TYPE_ID } from '@/app/src/lib/parseMixedQuestions';
import { examLabel, examSlug, normalizeLoCode, type ExamNo, type ExamTerm } from '@/app/src/lib/yazili/common';
import { buildPapers, type LoOption, type Paper } from '@/app/src/lib/yazili/papers';

export const YAZILI_INDEX_PATH = '/yazili-sorulari';
// Adres sırası (2026-11-02, kullanıcı): sınıf → dönem-yazılı → ders. Öğrenci "6. sınıf 1. yazılı" diye düşünür, ders
// onun altında seçimdir. Eski sınıf → ders → yazılı adresleri next.config.ts'te 308 ile yenisine gider.
export const yaziliHubPath = (gradeSlug: string, term: ExamTerm, examNo: ExamNo) => `${YAZILI_INDEX_PATH}/${gradeSlug}/${examSlug(term, examNo)}`;
export const yaziliExamPath = (gradeSlug: string, lessonSlug: string, term: ExamTerm, examNo: ExamNo) =>
  `${yaziliHubPath(gradeSlug, term, examNo)}/${lessonSlug}`;

export function parseExamSlug(slug: string): { term: ExamTerm; examNo: ExamNo } | null {
  const m = slug.match(/^([12])-donem-([12])-yazili$/);
  return m ? { term: Number(m[1]) as ExamTerm, examNo: Number(m[2]) as ExamNo } : null;
}

export type ExamListItem = {
  id: number; term: ExamTerm; examNo: ExamNo; label: string; path: string;
  national: boolean; examDate: string | null; questionCount: number;
};

type ExamRow = {
  id: number; term: number; exam_no: number; national: boolean; exam_date: string | null;
  grades: { name: string; slug: string; order_no: number }; lessons: { name: string; slug: string; order_no: number };
  exam_topics: { topic_id: number; order_no: number }[];
};

// Yazılı tarihleri ŞİMDİLİK sitede gösterilmiyor (2026-10-26, kullanıcı kararı: tarihler düzenlenip sonra eklenecek).
// Tarih tek bu noktadan çıkıyor; null olunca "Yaklaşan yazılılar" kartı, geri sayımlar ve öğretmen panelindeki tarih
// kendiliğinden gizlenir. Admin tarih girmeye devam edebilir (admin API'si bu dosyayı kullanmaz). Açmak için true yap.
const SHOW_EXAM_DATES = false;

async function classicalCounts(topicIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (!topicIds.length) return counts;
  const { data } = await createAnonClient()
    .from('questions')
    .select('topic_id')
    .in('topic_id', topicIds)
    .eq('question_type_id', TYPE_ID.classical)
    .eq('is_active', true);
  for (const r of (data as { topic_id: number }[] | null) ?? []) counts.set(r.topic_id, (counts.get(r.topic_id) ?? 0) + 1);
  return counts;
}

const toListItem = (e: ExamRow, counts: Map<number, number>): ExamListItem => ({
  id: e.id,
  term: e.term as ExamTerm,
  examNo: e.exam_no as ExamNo,
  label: examLabel(e.term as ExamTerm, e.exam_no as ExamNo),
  path: yaziliExamPath(e.grades.slug, e.lessons.slug, e.term as ExamTerm, e.exam_no as ExamNo),
  national: e.national,
  examDate: SHOW_EXAM_DATES ? e.exam_date : null,
  questionCount: e.exam_topics.reduce((n, t) => n + (counts.get(t.topic_id) ?? 0), 0),
});

const EXAM_SELECT = 'id, term, exam_no, national, exam_date, grades!inner(name, slug, order_no), lessons!inner(name, slug, order_no), exam_topics(topic_id, order_no)';

// Tüm yayındaki yazılılar, sınıf → ders gruplu. Sorusu olmayan yazılı listelenmez (ince sayfa).
export const getYaziliIndex = cache(async function getYaziliIndex() {
  const { data } = await createAnonClient().from('exams').select(EXAM_SELECT).eq('status', 'published');
  const rows = (data as unknown as ExamRow[] | null) ?? [];
  const counts = await classicalCounts(rows.flatMap((e) => e.exam_topics.map((t) => t.topic_id)));

  type Lesson = { name: string; slug: string; order: number; exams: ExamListItem[] };
  const grades = new Map<string, { name: string; slug: string; order: number; lessons: Map<string, Lesson> }>();
  for (const e of rows) {
    const item = toListItem(e, counts);
    if (!item.questionCount) continue;
    const g = grades.get(e.grades.slug) ?? { name: e.grades.name, slug: e.grades.slug, order: e.grades.order_no, lessons: new Map() };
    const l = g.lessons.get(e.lessons.slug) ?? { name: e.lessons.name, slug: e.lessons.slug, order: e.lessons.order_no, exams: [] };
    l.exams.push(item);
    g.lessons.set(e.lessons.slug, l);
    grades.set(e.grades.slug, g);
  }
  const byExam = (a: ExamListItem, b: ExamListItem) => a.term - b.term || a.examNo - b.examNo;
  return [...grades.values()]
    .sort((a, b) => a.order - b.order)
    .map((g) => ({
      ...g,
      lessons: [...g.lessons.values()].sort((a, b) => a.order - b.order).map((l) => ({ ...l, exams: l.exams.sort(byExam) })),
    }));
});

export type YaziliIndexGrade = Awaited<ReturnType<typeof getYaziliIndex>>[number];
export type YaziliHub = {
  term: ExamTerm; examNo: ExamNo; label: string; slug: string; path: string;
  lessons: { name: string; slug: string; exam: ExamListItem }[];
};

// Bir sınıfın dönem-yazılı sayfaları (ara sayfa): her biri o yazılıda yayındaki dersler, ders sırasıyla.
export function gradeHubs(grade: YaziliIndexGrade): YaziliHub[] {
  const hubs = new Map<string, YaziliHub>();
  for (const l of grade.lessons) {
    for (const e of l.exams) {
      const slug = examSlug(e.term, e.examNo);
      const hub = hubs.get(slug) ?? { term: e.term, examNo: e.examNo, label: e.label, slug, path: yaziliHubPath(grade.slug, e.term, e.examNo), lessons: [] };
      hub.lessons.push({ name: l.name, slug: l.slug, exam: e });
      hubs.set(slug, hub);
    }
  }
  return [...hubs.values()].sort((a, b) => a.term - b.term || a.examNo - b.examNo);
}

// /yazili-sorulari/6-sinif/1-donem-1-yazili: sınıf + o yazılının dersleri + sınıfın diğer yazılıları.
export const getYaziliHub = cache(async function getYaziliHub(gradeSlug: string, slug: string) {
  const grade = (await getYaziliIndex()).find((g) => g.slug === decodeURIComponent(gradeSlug));
  if (!grade) return null;
  const hubs = gradeHubs(grade);
  const hub = hubs.find((h) => h.slug === slug);
  return hub ? { gradeName: grade.name, gradeSlug: grade.slug, hub, hubs } : null;
});

export type YaziliQuestion = {
  id: number; text: string; svgContent: string | null; svgPosition: 'above' | 'below';
  modelAnswer: string; keyTerms: string[]; rubric: string | null; difficulty: number | null; loCode: string | null;
  /** Cevap anahtarındaki doğru çizim (çizim isteyen sorular); yoksa null. */
  answerSvgContent: string | null;
  /** Yazılı prompt sürümü (0 eski, 1 güncel); havuzda güncel sürüm önce gelir. */
  version: number;
};
export type YaziliTopic = { id: number; title: string; unitTitle: string; loCodes: string[]; questions: YaziliQuestion[] };
export type ScenarioRow = { loCode: string; topicTitles: string[]; counts: Record<number, number> };

export const getYaziliExam = cache(async function getYaziliExam(gradeSlug: string, lessonSlug: string, slug: string) {
  const parsed = parseExamSlug(slug);
  if (!parsed) return null;
  const supabase = createAnonClient();
  const { data } = await supabase
    .from('exams')
    .select(EXAM_SELECT)
    .eq('status', 'published')
    .eq('grades.slug', decodeURIComponent(gradeSlug))
    .eq('lessons.slug', decodeURIComponent(lessonSlug))
    .eq('term', parsed.term)
    .eq('exam_no', parsed.examNo)
    .maybeSingle();
  const exam = data as unknown as ExamRow | null;
  if (!exam) return null;

  const topicIds = [...exam.exam_topics].sort((a, b) => a.order_no - b.order_no).map((t) => t.topic_id);
  const [{ data: topicsData }, { data: qData }, { data: loData }, { data: targetData }] = await Promise.all([
    supabase.from('topics').select('id, title, units(title)').in('id', topicIds),
    supabase
      .from('questions')
      .select('id, topic_id, question_text, svg_content, svg_position, difficulty, question_classical(model_answer, key_terms, rubric, answer_svg_content, prompt_version), question_outcomes(outcome_id)')
      .in('topic_id', topicIds)
      .eq('question_type_id', TYPE_ID.classical)
      .eq('is_active', true)
      .order('difficulty', { ascending: true, nullsFirst: false })
      .order('id'),
    supabase.from('topic_learning_outcomes').select('topic_id, code, title').in('topic_id', topicIds),
    supabase.from('exam_lo_targets').select('scenario_no, lo_code, question_count').eq('exam_id', exam.id),
  ]);

  type Q = {
    id: number; topic_id: number; question_text: string; svg_content: string | null; svg_position: string; difficulty: number | null;
    question_classical: { model_answer: string; key_terms: string[] | null; rubric: string | null; answer_svg_content: string | null; prompt_version: number } | null;
    question_outcomes: { outcome_id: number }[];
  };
  // Sorgu kolaydan zora sıralı; güncel prompt sürümü (v1) öne alınır (sort kararlı, sürüm içinde zorluk sırası kalır).
  const questions = ((qData as unknown as Q[] | null) ?? []).sort((a, b) => (b.question_classical?.prompt_version ?? 0) - (a.question_classical?.prompt_version ?? 0));

  // Sorunun öğrenme çıktısı: bağlı kazanımın learning_outcome_id'si → kod (kağıtlar bu düzeyde kurulur).
  const outcomeIds = [...new Set(questions.flatMap((q) => q.question_outcomes.map((o) => o.outcome_id)))];
  const { data: outcomeData } = outcomeIds.length
    ? await supabase.from('outcomes').select('id, learning_outcome_id').in('id', outcomeIds)
    : { data: [] };
  const loIds = [...new Set(((outcomeData as { learning_outcome_id: number | null }[] | null) ?? []).map((o) => o.learning_outcome_id).filter((x): x is number => x != null))];
  const { data: loRows } = loIds.length ? await supabase.from('topic_learning_outcomes').select('id, code').in('id', loIds) : { data: [] };
  const loCodeById = new Map(((loRows as { id: number; code: string | null }[] | null) ?? []).map((l) => [l.id, l.code ? normalizeLoCode(l.code) : null]));
  const loCodeByOutcome = new Map(((outcomeData as { id: number; learning_outcome_id: number | null }[] | null) ?? []).map((o) => [o.id, o.learning_outcome_id != null ? loCodeById.get(o.learning_outcome_id) ?? null : null]));
  const loByTopic = new Map<number, string[]>();
  const loTitle = new Map<string, string>();
  for (const r of (loData as { topic_id: number; code: string | null; title: string | null }[] | null) ?? []) {
    const code = r.code ? normalizeLoCode(r.code) : null;
    if (code && r.title && !loTitle.has(code)) loTitle.set(code, r.title);
    if (code) loByTopic.set(r.topic_id, [...new Set([...(loByTopic.get(r.topic_id) ?? []), code])]);
  }
  const topicById = new Map(((topicsData as unknown as { id: number; title: string; units: { title: string } | null }[] | null) ?? []).map((t) => [t.id, t]));

  const topics: YaziliTopic[] = topicIds
    .filter((id) => topicById.has(id))
    .map((id) => ({
      id,
      title: topicById.get(id)!.title,
      unitTitle: topicById.get(id)!.units?.title ?? '',
      loCodes: loByTopic.get(id) ?? [],
      questions: questions
        .filter((q) => q.topic_id === id && q.question_classical)
        .map((q) => ({
          id: q.id,
          text: q.question_text,
          svgContent: q.svg_content,
          svgPosition: q.svg_position === 'below' ? 'below' : 'above',
          modelAnswer: q.question_classical!.model_answer,
          keyTerms: q.question_classical!.key_terms ?? [],
          rubric: q.question_classical!.rubric,
          answerSvgContent: q.question_classical!.answer_svg_content,
          version: q.question_classical!.prompt_version,
          difficulty: q.difficulty,
          // Kazanım kodu yoksa konunun tek öğrenme çıktısı.
          loCode:
            q.question_outcomes.map((o) => loCodeByOutcome.get(o.outcome_id)).find((c): c is string => !!c) ??
            ((loByTopic.get(id) ?? []).length === 1 ? loByTopic.get(id)![0] : null),
        })),
    }));

  const scenarioMap = new Map<string, Record<number, number>>();
  for (const t of (targetData as { scenario_no: number; lo_code: string; question_count: number }[] | null) ?? []) {
    scenarioMap.set(t.lo_code, { ...(scenarioMap.get(t.lo_code) ?? {}), [t.scenario_no]: t.question_count });
  }
  const scenarios: ScenarioRow[] = [...scenarioMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'tr', { numeric: true }))
    .map(([loCode, counts]) => ({ loCode, counts, topicTitles: topics.filter((t) => t.loCodes.includes(loCode)).map((t) => t.title) }));

  const allQuestions = topics.flatMap((t) => t.questions);
  // "Yeni yazılı aç" dağılım seçicisi: kapsamdaki her öğrenme çıktısı, resmî başlığı ve havuzu.
  const loOptions: LoOption[] = [...new Set(topics.flatMap((t) => t.loCodes))]
    .sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }))
    .map((code) => ({
      code,
      title: loTitle.get(code) ?? '',
      topicTitles: topics.filter((t) => t.loCodes.includes(code)).map((t) => t.title),
      pool: allQuestions.filter((q) => q.loCode === code).length,
    }));
  const papers: Paper[] = buildPapers({
    questions: allQuestions.map((q) => ({ id: q.id, loCode: q.loCode, difficulty: q.difficulty, version: q.version })),
    scenarios: new Map([...new Set([...scenarioMap.values()].flatMap((c) => Object.keys(c).map(Number)))].map((s) => [
      s,
      new Map([...scenarioMap.entries()].filter(([, c]) => c[s]).map(([code, c]) => [code, c[s]])),
    ])),
    national: exam.national,
    scopeLoCodes: [...new Set(topics.flatMap((t) => t.loCodes))],
  }).filter((p) => p.complete);

  return {
    exam: toListItem(exam, new Map(topics.map((t) => [t.id, t.questions.length]))),
    gradeName: exam.grades.name,
    gradeSlug: exam.grades.slug,
    lessonName: exam.lessons.name,
    lessonSlug: exam.lessons.slug,
    topics,
    scenarios,
    scenarioCount: Math.max(0, ...[...scenarioMap.values()].flatMap((c) => Object.keys(c).map(Number))),
    papers,
    loOptions,
  };
});

// Yazılı haftası penceresi/bildirimi için: bir sınıfın o dönem-yazılıda yayında (ve sorusu olan) yazılıları, ders
// sırasıyla. Sınıf kimlikten çözülür (profildeki grade_id).
export const getGradeExamsFor = cache(async function getGradeExamsFor(gradeId: number, term: ExamTerm, examNo: ExamNo) {
  const { data } = await createAnonClient().from('grades').select('slug').eq('id', gradeId).maybeSingle();
  const slug = (data as { slug: string } | null)?.slug;
  if (!slug) return [];
  const grade = (await getYaziliIndex()).find((g) => g.slug === slug);
  // hubPath: birden çok ders varsa bildirim/pencere o yazılının ara sayfasına gider.
  return (grade?.lessons ?? []).flatMap((l) => l.exams.filter((e) => e.term === term && e.examNo === examNo).map((e) => ({ lesson: l.name, path: e.path, hubPath: yaziliHubPath(slug, term, examNo), national: e.national })));
});
