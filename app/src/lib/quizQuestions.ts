import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

export type Option = { id: number; text: string; is_correct: boolean };
export type Pair = { id: number; left_text: string; right_text: string };

export type MultipleChoiceQuestion = { id: number; type: 'multiple_choice'; question_text: string; solution_text: string | null; choices: Option[] };
export type BlankQuestion = { id: number; type: 'blank'; question_text: string; solution_text: string | null; options: Option[] };
export type MatchingQuestion = { id: number; type: 'matching'; pairs: Pair[] };
export type ClassicalQuestion = { id: number; type: 'classical'; question_text: string; modelAnswer: string | null };
export type QuizQuestion = MultipleChoiceQuestion | BlankQuestion | MatchingQuestion | ClassicalQuestion;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Bir soru kimliği listesi için tip bazlı detayları (şık/boşluk seçeneği/eşleştirme
// çifti/klasik model cevap) toplu çekip normalize edilmiş, karışık sıralı soru
// listesine dönüştürür. Soru tipi question_type_id'ye göre değil, hangi alt tabloda
// veri bulunduğuna göre belirlenir — bu, question_type_id numaralandırmasından
// bağımsız ve KarisikTestClient'ın eski (çalışan) davranışıyla tutarlıdır.
async function resolveQuestions(questionIds: number[]): Promise<QuizQuestion[]> {
  if (!questionIds.length) return [];

  const supabase = createServiceClient();

  const [{ data: questionsData }, { data: choicesData }, { data: optionsData }, { data: pairsData }, { data: classicalData }] = await Promise.all([
    supabase.from('questions').select('id, question_text, solution_text').in('id', questionIds),
    supabase.from('question_choices').select('id, question_id, choice_text, is_correct').in('question_id', questionIds),
    supabase.from('question_blank_options').select('id, question_id, option_text, is_correct').in('question_id', questionIds),
    supabase.from('question_matching_pairs').select('id, question_id, left_text, right_text').in('question_id', questionIds),
    supabase.from('question_classical').select('question_id, model_answer').in('question_id', questionIds),
  ]);

  const choicesByQuestion = new Map<number, Option[]>();
  ((choicesData as { id: number; question_id: number; choice_text: string; is_correct: boolean }[] | null) || []).forEach((c) => {
    const list = choicesByQuestion.get(c.question_id) || [];
    list.push({ id: c.id, text: c.choice_text, is_correct: c.is_correct });
    choicesByQuestion.set(c.question_id, list);
  });

  const optionsByQuestion = new Map<number, Option[]>();
  ((optionsData as { id: number; question_id: number; option_text: string; is_correct: boolean }[] | null) || []).forEach((o) => {
    const list = optionsByQuestion.get(o.question_id) || [];
    list.push({ id: o.id, text: o.option_text, is_correct: o.is_correct });
    optionsByQuestion.set(o.question_id, list);
  });

  const pairsByQuestion = new Map<number, Pair[]>();
  ((pairsData as { id: number; question_id: number; left_text: string; right_text: string }[] | null) || []).forEach((p) => {
    const list = pairsByQuestion.get(p.question_id) || [];
    list.push({ id: p.id, left_text: p.left_text, right_text: p.right_text });
    pairsByQuestion.set(p.question_id, list);
  });

  const classicalByQuestion = new Map<number, string | null>();
  ((classicalData as { question_id: number; model_answer: string | null }[] | null) || []).forEach((c) => {
    classicalByQuestion.set(c.question_id, c.model_answer);
  });

  const all: QuizQuestion[] = [];

  ((questionsData as { id: number; question_text: string; solution_text: string | null }[] | null) || []).forEach((q) => {
    const choices = shuffle(choicesByQuestion.get(q.id) || []);
    if (choices.length >= 2) {
      all.push({ id: q.id, type: 'multiple_choice', question_text: q.question_text, solution_text: q.solution_text, choices });
      return;
    }
    const options = shuffle(optionsByQuestion.get(q.id) || []);
    if (options.length >= 2 && q.question_text.includes('_____')) {
      all.push({ id: q.id, type: 'blank', question_text: q.question_text, solution_text: q.solution_text, options });
      return;
    }
    const pairs = shuffle(pairsByQuestion.get(q.id) || []);
    if (pairs.length >= 2) {
      all.push({ id: q.id, type: 'matching', pairs });
      return;
    }
    if (classicalByQuestion.has(q.id)) {
      all.push({ id: q.id, type: 'classical', question_text: q.question_text, modelAnswer: classicalByQuestion.get(q.id) ?? null });
    }
  });

  return shuffle(all);
}

// Bir alt başlığın (topic_content_sections) kavrama testi soruları — questions.section_id
// tek kaynak (bkz. add_question_scope_and_source.sql).
export async function getSectionTestQuestions(sectionId: number | string): Promise<QuizQuestion[]> {
  const supabase = createServiceClient();
  const { data: questionIdRows } = await supabase.from('questions').select('id').eq('section_id', sectionId);
  const questionIds = ((questionIdRows as { id: number }[] | null) || []).map((r) => r.id);
  return resolveQuestions(questionIds);
}

// Bir ünitenin tüm konularına ait sorular (ünite testi) — questions.topic_id üzerinden,
// section_id'si dolu ya da boş fark etmeksizin.
export async function getUnitTestQuestions(unitId: number | string): Promise<QuizQuestion[]> {
  const supabase = createServiceClient();

  const { data: topicRows } = await supabase.from('topics').select('id').eq('unit_id', unitId).eq('is_active', true);
  const topicIds = ((topicRows as { id: number }[] | null) || []).map((t) => t.id);
  if (!topicIds.length) return [];

  const { data: questionIdRows } = await supabase.from('questions').select('id').in('topic_id', topicIds);
  const questionIds = ((questionIdRows as { id: number }[] | null) || []).map((r) => r.id);
  return resolveQuestions(questionIds);
}
