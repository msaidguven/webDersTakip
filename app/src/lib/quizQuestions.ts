import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

export type Option = { id: number; text: string; is_correct: boolean };
export type Pair = { id: number; left_text: string; right_text: string };

export type MultipleChoiceQuestion = { id: number; type: 'multiple_choice'; question_text: string; solution_text: string | null; choices: Option[] };
export type BlankQuestion = { id: number; type: 'blank'; question_text: string; solution_text: string | null; options: Option[] };
export type MatchingQuestion = { id: number; type: 'matching'; pairs: Pair[] };
export type ClassicalQuestion = { id: number; type: 'classical'; question_text: string; modelAnswer: string | null };
export type QuizQuestion = MultipleChoiceQuestion | BlankQuestion | MatchingQuestion | ClassicalQuestion;

// Test sayfasındaki "AI'ye Sor" widget'ı, öğrenci "neden A" gibi kısa bir şey yazınca
// hangi sorudan bahsettiğini bilsin diye aktif sorunun düz metin özetini üretir —
// doğru cevap da dahil, çünkü amaç Gemini'nin "neden X doğru" diye açıklayabilmesi.
export function formatQuestionContext(q: QuizQuestion): string {
  const letter = (i: number) => String.fromCharCode(65 + i);
  switch (q.type) {
    case 'multiple_choice':
      return `Öğrencinin şu anda baktığı çoktan seçmeli soru: ${q.question_text}\nŞıklar:\n${q.choices
        .map((c, i) => `${letter(i)}) ${c.text}${c.is_correct ? ' — doğru cevap bu' : ''}`)
        .join('\n')}`;
    case 'blank':
      return `Öğrencinin şu anda baktığı boşluk doldurma sorusu: ${q.question_text}\nSeçenekler:\n${q.options
        .map((o, i) => `${letter(i)}) ${o.text}${o.is_correct ? ' — doğru cevap bu' : ''}`)
        .join('\n')}`;
    case 'matching':
      return `Öğrencinin şu anda baktığı eşleştirme sorusu, doğru çiftler:\n${q.pairs
        .map((p) => `${p.left_text} — ${p.right_text}`)
        .join('\n')}`;
    case 'classical':
      return `Öğrencinin şu anda baktığı açık uçlu soru: ${q.question_text}${
        q.modelAnswer ? `\nÖrnek/model cevap: ${q.modelAnswer}` : ''
      }`;
  }
}

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

// Bir testte gösterilecek soru sayısı sabitlendi: hem tekrar çözmeyi (havuz büyükse
// her seferinde farklı 10 soru) hem soru sayısına göre süre hesaplamayı basitleştiriyor.
export const MAX_QUESTIONS_PER_TEST = 10;
export const SECONDS_PER_QUESTION = 60;

// Bir konunun (topic) tüm alt başlıklarına ve konu geneline ait sorular (konu kavrama
// testi) — questions.topic_id üzerinden, section_id'si dolu ya da boş fark etmeksizin.
export async function getTopicTestQuestions(topicId: number | string): Promise<QuizQuestion[]> {
  const supabase = createServiceClient();
  const { data: questionIdRows } = await supabase.from('questions').select('id').eq('topic_id', topicId);
  const questionIds = ((questionIdRows as { id: number }[] | null) || []).map((r) => r.id);
  // Havuzdan rastgele MAX_QUESTIONS_PER_TEST kadarını seçip sadece onları çözüyoruz —
  // hem gereksiz sorgu yükünü azaltır hem "Tekrar Çöz" her seferinde farklı bir set getirir.
  return resolveQuestions(shuffle(questionIds).slice(0, MAX_QUESTIONS_PER_TEST));
}

// Belirli soru id'lerini (sırası önemli değil, resolveQuestions zaten karıştırıyor) çözer —
// yarım kalmış bir test oturumunu aynı soru havuzuyla devam ettirmek için kullanılır
// (bkz. quizResume.ts), rastgele yeni bir set seçmek yerine.
export async function getQuestionsByIds(questionIds: number[]): Promise<QuizQuestion[]> {
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
  return resolveQuestions(shuffle(questionIds).slice(0, MAX_QUESTIONS_PER_TEST));
}
