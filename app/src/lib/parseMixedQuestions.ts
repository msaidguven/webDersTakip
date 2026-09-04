// Alt başlığa özel (section) veya konunun geneline ait (topic, section_id boş) AI/manuel
// karışık soru JSON'unu ("multiple_choice" | "blank" | "matching" | "classical") doğrulayıp
// normalize eder. Her iki kaydetme endpoint'i de (section/[sectionId]/questions,
// topic/[topicId]/questions) aynı çıktı şemasını bekler; mantık burada tek yerde tutulur.

export type QuestionType = 'multiple_choice' | 'blank' | 'matching' | 'classical';

export type SvgPosition = 'above' | 'below';
export type ParsedMultipleChoice = { kind: 'multiple_choice'; question_text: string; solution_text: string | null; svg_prompt: string | null; svg_position: SvgPosition; choices: { text: string; is_correct: boolean }[] };
export type ParsedBlank = { kind: 'blank'; question_text: string; solution_text: string | null; svg_prompt: string | null; svg_position: SvgPosition; options: { text: string; is_correct: boolean }[] };
export type ParsedMatching = { kind: 'matching'; pairs: { left_text: string; right_text: string }[] };
export type ParsedClassical = { kind: 'classical'; question_text: string; solution_text: string | null; svg_prompt: string | null; svg_position: SvgPosition; model_answer: string; key_terms: string[] };
export type ParsedQuestion = ParsedMultipleChoice | ParsedBlank | ParsedMatching | ParsedClassical;

function parseChoiceList(raw: unknown, min: number, max: number): { text: string; is_correct: boolean }[] | null {
  if (!Array.isArray(raw) || raw.length < min || raw.length > max) return null;
  const out: { text: string; is_correct: boolean }[] = [];
  for (const c of raw as { text?: unknown; is_correct?: unknown }[]) {
    if (typeof c.text !== 'string' || !c.text.trim()) return null;
    out.push({ text: c.text.trim(), is_correct: c.is_correct === true });
  }
  if (out.filter((c) => c.is_correct).length !== 1) return null;
  return out;
}

function parseSvgFields(q: Record<string, unknown>): { svg_prompt: string | null; svg_position: SvgPosition } {
  const svg_prompt = typeof q.svg_prompt === 'string' && q.svg_prompt.trim() ? q.svg_prompt.trim() : null;
  const svg_position: SvgPosition = q.svg_position === 'below' ? 'below' : 'above';
  return { svg_prompt, svg_position };
}

function parseKeyTerms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === 'string' && !!t.trim()).map((t) => t.trim());
}

export function parseQuestions(body: unknown, maxQuestions: number): ParsedQuestion[] | null {
  const obj = body as { type?: unknown; questions?: unknown } | null;
  if (!obj || !Array.isArray(obj.questions) || !obj.questions.length || obj.questions.length > maxQuestions) return null;

  const defaultType: QuestionType =
    obj.type === 'blank' || obj.type === 'matching' || obj.type === 'classical' ? obj.type : 'multiple_choice';
  const parsed: ParsedQuestion[] = [];

  for (const q of obj.questions as Record<string, unknown>[]) {
    const type: QuestionType =
      q.type === 'blank' || q.type === 'matching' || q.type === 'classical' || q.type === 'multiple_choice' ? q.type : defaultType;

    if (type === 'matching') {
      if (!Array.isArray(q.pairs) || q.pairs.length < 2 || q.pairs.length > 10) return null;
      const pairs: { left_text: string; right_text: string }[] = [];
      for (const p of q.pairs as { left_text?: unknown; right_text?: unknown }[]) {
        if (typeof p.left_text !== 'string' || !p.left_text.trim()) return null;
        if (typeof p.right_text !== 'string' || !p.right_text.trim()) return null;
        pairs.push({ left_text: p.left_text.trim(), right_text: p.right_text.trim() });
      }
      parsed.push({ kind: 'matching', pairs });
      continue;
    }

    if (typeof q.question_text !== 'string' || !q.question_text.trim()) return null;
    const solution_text = typeof q.solution_text === 'string' && q.solution_text.trim() ? q.solution_text.trim() : null;

    if (type === 'blank') {
      const questionText = q.question_text.trim();
      const blankCount = (questionText.match(/_____/g) || []).length;
      if (blankCount !== 1) return null;
      const options = parseChoiceList(q.options, 2, 6);
      if (!options) return null;
      parsed.push({ kind: 'blank', question_text: questionText, solution_text, ...parseSvgFields(q), options });
      continue;
    }

    if (type === 'classical') {
      if (typeof q.model_answer !== 'string' || !q.model_answer.trim()) return null;
      parsed.push({
        kind: 'classical',
        question_text: q.question_text.trim(),
        solution_text,
        ...parseSvgFields(q),
        model_answer: q.model_answer.trim(),
        key_terms: parseKeyTerms(q.key_terms),
      });
      continue;
    }

    const choices = parseChoiceList(q.choices, 2, 6);
    if (!choices) return null;
    parsed.push({ kind: 'multiple_choice', question_text: q.question_text.trim(), solution_text, ...parseSvgFields(q), choices });
  }

  return parsed;
}

// question_types tablosundaki gerçek id'ler: multiple_choice=1, true_false=2, fill_blank=3,
// classical=4, matching=5 (bkz. fix_matching_question_type_id.sql — matching daha önce
// burada yanlışlıkla 4 idi, bu da AI ile eklenen matching sorularının DB'de "classical"
// olarak etiketlenmesine yol açıyordu; o migration mevcut satırları da düzeltiyor).
export const TYPE_ID: Record<QuestionType, number> = { multiple_choice: 1, blank: 3, matching: 5, classical: 4 };
export const INVALID_MESSAGE =
  'Geçersiz soru listesi (çoktan seçmeli: 2-6 şık ve tam 1 doğru; boşluk doldurma: metinde tam bir "_____" ve 2-6 seçenekten tam 1 doğru; eşleştirme: 2-10 çift, hepsi dolu; açık uçlu: soru metni ve model cevap zorunlu)';
