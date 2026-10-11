// app/src/lib/questionInsert.ts
// Ayrıştırılmış soruları (parseMixedQuestions) soru bankasına yazar: soru + tipine göre detay
// (şıklar / boşluk seçenekleri / eşleştirme / klasik) + kazanım bağları. Admin'in alt başlık ve
// konu geneli kaydetme route'ları ile otomatik konu partisi yayını (topicQuestionBatch.ts) ortak
// kullanır (2026-10-12'de iki route'taki kopya döngüden çıkarıldı). Önbellek yenilemesi çağıranın
// işi — parti yayını bir konu için TEK kez yeniler.
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TYPE_ID, type ParsedQuestion } from '@/app/src/lib/parseMixedQuestions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

export interface InsertQuestionsInput {
  topicId: number;
  // null: konu geneli (sentez) soru.
  sectionId: number | null;
  outcomeIds: number[];
  questions: ParsedQuestion[];
  aiModel: string | null;
}

export type InsertQuestionsResult = { ok: true; savedCount: number; svgPendingCount: number } | { ok: false; error: string; savedCount: number };

export async function insertQuestions(supabase: Supabase, input: InsertQuestionsInput): Promise<InsertQuestionsResult> {
  const source: 'manual' | 'ai_generated' = input.aiModel ? 'ai_generated' : 'manual';
  let savedCount = 0;
  let svgPendingCount = 0;

  for (const q of input.questions) {
    const questionText = q.kind === 'matching' ? 'Aşağıdaki kavramları doğru tanımlarıyla eşleştir.' : q.question_text;
    const solutionText = q.kind === 'matching' ? null : q.solution_text;
    const svgPrompt = q.kind === 'matching' ? null : q.svg_prompt;

    const { data: questionRow, error: qError } = await supabase
      .from('questions')
      .insert({
        question_type_id: TYPE_ID[q.kind],
        question_text: questionText,
        solution_text: solutionText,
        topic_id: input.topicId,
        section_id: input.sectionId,
        source,
        ai_model: input.aiModel,
        svg_prompt: svgPrompt,
        svg_position: q.kind === 'matching' ? 'above' : q.svg_position,
        // SVG istenmiş ama henüz girilmemiş sorular admin SVG'yi ekleyip kaydedene kadar taslak
        // kalır (admin panelinde "çizim bekleyen soru" uyarısı) — bkz. app/api/admin/manage/questions
        // PATCH'teki otomatik yayınlama.
        is_active: !svgPrompt,
      })
      .select('id')
      .single();

    if (qError || !questionRow) return { ok: false, error: `Soru kaydedilemedi: ${questionText.slice(0, 40)}`, savedCount };

    const questionId = (questionRow as { id: number }).id;
    let detailError: { message: string } | null = null;

    if (q.kind === 'multiple_choice') {
      ({ error: detailError } = await supabase
        .from('question_choices')
        .insert(q.choices.map((c) => ({ question_id: questionId, choice_text: c.text, is_correct: c.is_correct }))));
    } else if (q.kind === 'blank') {
      ({ error: detailError } = await supabase
        .from('question_blank_options')
        .insert(q.options.map((o, idx) => ({ question_id: questionId, option_text: o.text, is_correct: o.is_correct, order_no: idx }))));
    } else if (q.kind === 'classical') {
      ({ error: detailError } = await supabase.from('question_classical').insert({ question_id: questionId, model_answer: q.model_answer, key_terms: q.key_terms }));
    } else {
      ({ error: detailError } = await supabase
        .from('question_matching_pairs')
        .insert(q.pairs.map((p, idx) => ({ question_id: questionId, left_text: p.left_text, right_text: p.right_text, order_no: idx }))));
    }

    const { error: outcomesError } = input.outcomeIds.length
      ? await supabase.from('question_outcomes').insert(input.outcomeIds.map((outcomeId) => ({ question_id: questionId, outcome_id: outcomeId })))
      : { error: null };

    if (detailError || outcomesError) return { ok: false, error: 'Detaylar veya kazanım bağlantısı kaydedilemedi', savedCount };

    savedCount += 1;
    if (svgPrompt) svgPendingCount += 1;
  }

  return { ok: true, savedCount, svgPendingCount };
}

// Alt başlığın kazanımları (topic_content_section_outcomes).
export async function sectionOutcomeIds(supabase: Supabase, sectionId: number): Promise<number[] | null> {
  const { data, error } = await supabase.from('topic_content_section_outcomes').select('outcome_id').eq('section_id', sectionId);
  if (error) return null;
  return ((data as { outcome_id: number }[] | null) || []).map((r) => r.outcome_id);
}

// Konunun güncel kazanımları (konu geneli sorular hepsine bağlanır).
export async function topicOutcomeIds(supabase: Supabase, topicId: number): Promise<number[] | null> {
  const { data, error } = await supabase.from('outcomes').select('id').eq('topic_id', topicId).eq('is_current', true);
  if (error) return null;
  return ((data as { id: number }[] | null) || []).map((r) => r.id);
}
