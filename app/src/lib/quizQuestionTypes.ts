// app/src/lib/quizQuestionTypes.ts
// Soru tipleri + saf yardımcılar + test sabitleri — istemci bileşenleri de kullanır. Sorgu
// fonksiyonları quizQuestions.ts'te (server-only; service-role istemcisi). Ayrıldı 2026-10-10:
// server-only, quizQuestions.ts'in bu değerler için tarayıcı paketine girdiğini yakaladı.

export type Option = { id: number; text: string; is_correct: boolean };
export type Pair = { id: number; left_text: string; right_text: string };

export type SvgPosition = 'above' | 'below';
export type MultipleChoiceQuestion = { id: number; type: 'multiple_choice'; question_text: string; solution_text: string | null; svg_content: string | null; svg_position: SvgPosition; choices: Option[] };
export type BlankQuestion = { id: number; type: 'blank'; question_text: string; solution_text: string | null; svg_content: string | null; svg_position: SvgPosition; options: Option[] };
export type MatchingQuestion = { id: number; type: 'matching'; question_text: string; pairs: Pair[] };
export type ClassicalQuestion = { id: number; type: 'classical'; question_text: string; svg_content: string | null; svg_position: SvgPosition; modelAnswer: string | null };
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
      return `Öğrencinin şu anda baktığı eşleştirme sorusu: ${q.question_text}\nDoğru çiftler:\n${q.pairs
        .map((p) => `${p.left_text} — ${p.right_text}`)
        .join('\n')}`;
    case 'classical':
      return `Öğrencinin şu anda baktığı açık uçlu soru: ${q.question_text}${
        q.modelAnswer ? `\nÖrnek/model cevap: ${q.modelAnswer}` : ''
      }`;
  }
}

// Bir testte gösterilecek soru sayısı sabitlendi: hem tekrar çözmeyi (havuz büyükse
// her seferinde farklı 10 soru) hem soru sayısına göre süre hesaplamayı basitleştiriyor.
export const MAX_QUESTIONS_PER_TEST = 10;
export const SECONDS_PER_QUESTION = 60;
