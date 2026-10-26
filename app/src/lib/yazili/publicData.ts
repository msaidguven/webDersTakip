// Yazılı soruları — herkese açık sayfaların verisi (anon client, ISR). Yalnız yayındaki yazılılar
// (exams.status='published', RLS de bunu zorunlu kılar) ve aktif klasik sorular döner.
import 'server-only';
import { cache } from 'react';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { TYPE_ID } from '@/app/src/lib/parseMixedQuestions';
import { examLabel, examSlug, normalizeLoCode, type ExamNo, type ExamTerm } from '@/app/src/lib/yazili/common';
import { buildPapers, type Paper } from '@/app/src/lib/yazili/papers';

export const YAZILI_INDEX_PATH = '/yazili-sorulari';
export const yaziliLessonPath = (gradeSlug: string, lessonSlug: string) => `${YAZILI_INDEX_PATH}/${gradeSlug}/${lessonSlug}`;
export const yaziliExamPath = (gradeSlug: string, lessonSlug: string, term: ExamTerm, examNo: ExamNo) =>
  `${yaziliLessonPath(gradeSlug, lessonSlug)}/${examSlug(term, examNo)}`;

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

  type Lesson = { name: string; slug: string; order: number; path: string; exams: ExamListItem[] };
  const grades = new Map<string, { name: string; slug: string; order: number; lessons: Map<string, Lesson> }>();
  for (const e of rows) {
    const item = toListItem(e, counts);
    if (!item.questionCount) continue;
    const g = grades.get(e.grades.slug) ?? { name: e.grades.name, slug: e.grades.slug, order: e.grades.order_no, lessons: new Map() };
    const l = g.lessons.get(e.lessons.slug) ?? { name: e.lessons.name, slug: e.lessons.slug, order: e.lessons.order_no, path: yaziliLessonPath(e.grades.slug, e.lessons.slug), exams: [] };
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

export type YaziliQuestion = {
  id: number; text: string; svgContent: string | null; svgPosition: 'above' | 'below';
  modelAnswer: string; keyTerms: string[]; rubric: string | null; difficulty: number | null; loCode: string | null;
  /** Cevap anahtarındaki doğru çizim (çizim isteyen sorular); yoksa null. */
  answerSvgContent: string | null;
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
  const [{ data: topicsData }, { data: qData }, { data: loData }, { data: targetData }, { data: siblingsData }] = await Promise.all([
    supabase.from('topics').select('id, title, units(title)').in('id', topicIds),
    supabase
      .from('questions')
      .select('id, topic_id, question_text, svg_content, svg_position, difficulty, question_classical(model_answer, key_terms, rubric, answer_svg_content), question_outcomes(outcome_id)')
      .in('topic_id', topicIds)
      .eq('question_type_id', TYPE_ID.classical)
      .eq('is_active', true)
      .order('difficulty', { ascending: true, nullsFirst: false })
      .order('id'),
    supabase.from('topic_learning_outcomes').select('topic_id, code').in('topic_id', topicIds),
    supabase.from('exam_lo_targets').select('scenario_no, lo_code, question_count').eq('exam_id', exam.id),
    supabase.from('exams').select(EXAM_SELECT).eq('status', 'published').eq('grades.slug', exam.grades.slug).eq('lessons.slug', exam.lessons.slug),
  ]);

  type Q = {
    id: number; topic_id: number; question_text: string; svg_content: string | null; svg_position: string; difficulty: number | null;
    question_classical: { model_answer: string; key_terms: string[] | null; rubric: string | null; answer_svg_content: string | null } | null;
    question_outcomes: { outcome_id: number }[];
  };
  const questions = (qData as unknown as Q[] | null) ?? [];

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
  for (const r of (loData as { topic_id: number; code: string | null }[] | null) ?? []) {
    const code = r.code ? normalizeLoCode(r.code) : null;
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
  const papers: Paper[] = buildPapers({
    questions: allQuestions.map((q) => ({ id: q.id, loCode: q.loCode, difficulty: q.difficulty })),
    scenarios: new Map([...new Set([...scenarioMap.values()].flatMap((c) => Object.keys(c).map(Number)))].map((s) => [
      s,
      new Map([...scenarioMap.entries()].filter(([, c]) => c[s]).map(([code, c]) => [code, c[s]])),
    ])),
    national: exam.national,
    scopeLoCodes: [...new Set(topics.flatMap((t) => t.loCodes))],
  }).filter((p) => p.complete);

  const siblingRows = (siblingsData as unknown as ExamRow[] | null) ?? [];
  const siblingCounts = await classicalCounts(siblingRows.flatMap((e) => e.exam_topics.map((t) => t.topic_id)));
  const siblings = siblingRows
    .map((e) => toListItem(e, siblingCounts))
    .filter((e) => e.questionCount > 0)
    .sort((a, b) => a.term - b.term || a.examNo - b.examNo);

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
    siblings,
  };
});

// Bir dersin yayındaki yazılıları (ders sayfası).
export const getYaziliLesson = cache(async function getYaziliLesson(gradeSlug: string, lessonSlug: string) {
  const index = await getYaziliIndex();
  const grade = index.find((g) => g.slug === decodeURIComponent(gradeSlug));
  const lesson = grade?.lessons.find((l) => l.slug === decodeURIComponent(lessonSlug));
  return grade && lesson ? { gradeName: grade.name, gradeSlug: grade.slug, lesson, otherLessons: grade.lessons.filter((l) => l.slug !== lesson.slug) } : null;
});
