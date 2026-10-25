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
  // Yazılı soruları AI'dan zorluk (1-5) da istiyor; diğer akışlar vermez (DB varsayılanı kalır).
  difficulty?: number;
}

// skippedDuplicateCount: konuda zaten aktif olan (metni birebir aynı) soru tekrar yazılmadı.
export type InsertQuestionsResult =
  | { ok: true; savedCount: number; svgPendingCount: number; skippedDuplicateCount: number }
  | { ok: false; error: string; savedCount: number };

// Tekrar kalkanı (2026-10-24): aynı konuda birebir aynı kökü olan test sorusu ikinci kez yazılmasın. AI'ya mevcut
// sorular verildiği hâlde farklı turlarda/akışlarda aynı soru üretilebiliyordu (Bilişim 6'da 11 çift). Büyük-küçük
// harf, noktalama ve boşluk farkı yok sayılır; yalnız biçimce aynı olanı yakalar, anlamca benzerini değil.
function normalizeStem(text: string): string {
  return text.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// Eşleştirme sorularının yönergesi. Çiftler her zaman kavram-tanım değil (birim dönüştürme "1800 mm → 180 cm",
// kesir → ondalık gösterim, sayı → özellik); eskisi "kavramları tanımlarıyla eşleştir" bunlarda yanlış
// yönerge veriyordu (2026-10-24, mevcut sorular da güncellendi).
export const MATCHING_INSTRUCTION = 'Sol sütundaki her öğeyi sağ sütundaki doğru karşılığıyla eşleştiriniz.';

export async function insertQuestions(supabase: Supabase, input: InsertQuestionsInput): Promise<InsertQuestionsResult> {
  const source: 'manual' | 'ai_generated' = input.aiModel ? 'ai_generated' : 'manual';
  let savedCount = 0;
  let svgPendingCount = 0;

  let skippedDuplicateCount = 0;
  const { data: existingRows } = await supabase
    .from('questions')
    .select('question_text')
    .eq('topic_id', input.topicId)
    .eq('is_active', true)
    .in('question_type_id', [TYPE_ID.multiple_choice, TYPE_ID.blank]);
  const seenStems = new Set(((existingRows as { question_text: string | null }[] | null) ?? []).map((r) => normalizeStem(r.question_text ?? '')));

  for (const q of input.questions) {
    const questionText = q.kind === 'matching' ? MATCHING_INSTRUCTION : q.question_text;
    // Okuma metinli sorularda kök ("Bu parçada…") metinler arasında aynı olabilir; tekrar sayılmaz.
    if ((q.kind === 'multiple_choice' || q.kind === 'blank') && !q.passage) {
      const stem = normalizeStem(questionText);
      if (seenStems.has(stem)) {
        skippedDuplicateCount += 1;
        continue;
      }
      seenStems.add(stem);
    }
    const solutionText = q.kind === 'matching' ? null : q.solution_text;
    // Yazılı akışı zorluğu ayrıca verir (öncelikli); diğerlerinde AI'ın soru başına verdiği değer.
    const difficulty = input.difficulty ?? (q.kind === 'classical' ? null : q.difficulty ?? null);
    const svgPrompt = q.kind === 'matching' ? null : q.svg_prompt;

    // Okuma metni önce yazılır, soru ona bağlanır (1. aşama: her metne bir soru).
    let passageId: number | null = null;
    if ((q.kind === 'multiple_choice' || q.kind === 'blank') && q.passage) {
      const { data: passageRow, error: pError } = await supabase.from('question_passages').insert({ topic_id: input.topicId, body: q.passage }).select('id').single();
      if (pError || !passageRow) return { ok: false, error: `Okuma metni kaydedilemedi: ${questionText.slice(0, 40)}`, savedCount };
      passageId = (passageRow as { id: number }).id;
    }

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
        ...(passageId ? { passage_id: passageId } : {}),
        ...(difficulty ? { difficulty } : {}),
      })
      .select('id')
      .single();

    if (qError || !questionRow) {
      if (passageId) await supabase.from('question_passages').delete().eq('id', passageId);
      return { ok: false, error: `Soru kaydedilemedi: ${questionText.slice(0, 40)}`, savedCount };
    }

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
      ({ error: detailError } = await supabase.from('question_classical').insert({
        question_id: questionId,
        model_answer: q.model_answer,
        key_terms: q.key_terms,
        ...(q.rubric ? { rubric: q.rubric } : {}),
        ...(q.answer_svg_prompt ? { answer_svg_prompt: q.answer_svg_prompt } : {}),
      }));
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

  return { ok: true, savedCount, svgPendingCount, skippedDuplicateCount };
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
