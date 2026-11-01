// Yazılı soruları — konu bazlı klasik soru promptu. Admin'in kopyala-yapıştır akışı (/api/admin/yazili/prompt)
// ve otomatik yazılı worker'ı (yazili/worker.ts) aynı promptu kullanır.
//   source=content   konu anlatımından (compact: tam metin yerine alt başlık özetleri)
//   source=questions konunun test/boşluk/eşleştirme sorularından, yeniden kurgulayarak
// Konunun mevcut v1 klasik soruları da verilir: ikinci tur tekrar değil, eksik kazanımları tamamlar. v0 sorular
// (eski prompt) verilmez — v1 önce gösterildiği için her konuda kazanımların hepsini kendi başına kapsamalı.
import 'server-only';
import { readFile } from 'fs/promises';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildMathClassicalBalanceRules, buildMathNotationGuidance, buildQuestionCountInstruction, buildSvgLessonGuidance } from '@/app/src/lib/promptHelpers';
import { TYPE_ID } from '@/app/src/lib/parseMixedQuestions';
import { TOPIC_QUESTION_TARGET, YAZILI_PROMPT_VERSION } from '@/app/src/lib/yazili/common';
import { loadTopicOutcomes, type ExamOutcome } from '@/app/src/lib/yazili/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

export type YaziliPromptSource = 'content' | 'questions';

const SOURCE_INSTRUCTION: Record<YaziliPromptSource, string> = {
  content: '- Sorular SADECE aşağıdaki ders notunda geçen bilgilerden sorulsun.',
  questions:
    '- Kaynak olarak aşağıdaki mevcut test/boşluk doldurma/eşleştirme soruları verildi. Bunların ölçtüğü bilgileri klasik (yazarak cevaplanan) soruya DÖNÜŞTÜR: soruyu yeniden kurgula, şıkları kaldırıp "soru işaretsiz test sorusu" haline getirme; aynı bilgiyi aşağıdaki türlerden birine (kısa cevaplı bilgi, uygulama ya da kısa yorum) uyan bir klasik soruyla ölç. Birbirine yakın iki test sorusunu tek klasik soruda birleştirebilirsin.',
};

const PROMPT_DIR = path.join(process.cwd(), 'app', 'prompt');
const readPrompt = (name: string) => readFile(path.join(PROMPT_DIR, name), 'utf8');

export type YaziliTopicInfo = { id: number; title: string; unitTitle: string; gradeName: string; lessonName: string };

export type YaziliPromptResult =
  | { ok: true; prompt: string; existingCount: number; topic: YaziliTopicInfo; outcomes: ExamOutcome[] }
  | { ok: false; status: 404 | 409; code: 'no_topic' | 'no_outcomes' | 'no_source'; error: string };

type Section = { heading: string; body_markdown: string | null; review_summary: string | null };

async function buildSourceBlock(supabase: Supabase, topicId: number, source: YaziliPromptSource, compact: boolean): Promise<string | null> {
  if (source === 'content') {
    const { data: tc } = await supabase.from('topic_contents').select('id').eq('topic_id', topicId).maybeSingle();
    const { data: sectionsData } = tc
      ? await supabase
        .from('topic_content_sections')
        .select('heading, body_markdown, review_summary, order_no')
        .eq('topic_content_id', (tc as { id: number }).id)
        .order('order_no')
      : { data: [] };
    const text = ((sectionsData as Section[] | null) ?? [])
      .map((s) => {
        const body = compact ? s.review_summary?.trim() || s.body_markdown?.trim() : s.body_markdown?.trim();
        return body ? `### ${s.heading}\n${body}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
    return text ? `Konunun ders notu${compact ? ' (alt başlık özetleri)' : ''}:\n${text}` : null;
  }

  const { data: qData } = await supabase
    .from('questions')
    .select('id, question_type_id, question_text, question_choices(choice_text, is_correct), question_blank_options(option_text, is_correct), question_matching_pairs(left_text, right_text, order_no)')
    .eq('topic_id', topicId)
    .eq('is_active', true)
    .neq('question_type_id', TYPE_ID.classical)
    .order('id');
  type Q = {
    question_type_id: number; question_text: string;
    question_choices: { choice_text: string; is_correct: boolean }[];
    question_blank_options: { option_text: string; is_correct: boolean }[];
    question_matching_pairs: { left_text: string; right_text: string; order_no: number }[];
  };
  const lines = ((qData as unknown as Q[] | null) ?? []).map((q, i) => {
    if (q.question_type_id === TYPE_ID.matching) {
      const pairs = [...q.question_matching_pairs].sort((a, b) => a.order_no - b.order_no).map((p) => `${p.left_text} → ${p.right_text}`);
      return `${i + 1}. [Eşleştirme] ${pairs.join('; ')}`;
    }
    if (q.question_type_id === TYPE_ID.blank) {
      const answer = q.question_blank_options.find((o) => o.is_correct)?.option_text ?? '';
      return `${i + 1}. [Boşluk] ${q.question_text} (Cevap: ${answer})`;
    }
    const answer = q.question_choices.find((c) => c.is_correct)?.choice_text ?? '';
    return `${i + 1}. [Test] ${q.question_text} (Doğru: ${answer})`;
  });
  return lines.length ? `Konunun mevcut soruları (kaynak):\n${lines.join('\n')}` : null;
}

export async function loadYaziliTopicInfo(supabase: Supabase, topicId: number): Promise<YaziliTopicInfo | null> {
  const { data } = await supabase
    .from('topics')
    .select('id, title, units!inner(title, grades(name), lessons(name))')
    .eq('id', topicId)
    .maybeSingle();
  const topic = data as unknown as { id: number; title: string; units: { title: string; grades: { name: string } | null; lessons: { name: string } | null } } | null;
  if (!topic) return null;
  return { id: topic.id, title: topic.title, unitTitle: topic.units.title, gradeName: topic.units.grades?.name ?? '', lessonName: topic.units.lessons?.name ?? '' };
}

export async function buildYaziliPrompt(
  supabase: Supabase,
  topicId: number,
  opts: { source: YaziliPromptSource; compact?: boolean }
): Promise<YaziliPromptResult> {
  const topic = await loadYaziliTopicInfo(supabase, topicId);
  if (!topic) return { ok: false, status: 404, code: 'no_topic', error: 'Konu bulunamadı' };

  const outcomes = (await loadTopicOutcomes(supabase, [topicId])).get(topicId) ?? [];
  if (!outcomes.length) return { ok: false, status: 409, code: 'no_outcomes', error: 'Bu konunun güncel kazanımı yok' };
  const outcomesText = outcomes.map((o) => `${o.key}) ${o.description}`).join('\n');
  const { data: loData } = await supabase.from('topic_learning_outcomes').select('code, title').eq('topic_id', topicId).order('order_no');
  const loText = ((loData as { code: string | null; title: string | null }[] | null) ?? [])
    .map((l) => [l.code, l.title].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n') || '—';

  const sourceBlock = await buildSourceBlock(supabase, topicId, opts.source, !!opts.compact);
  if (!sourceBlock) {
    return {
      ok: false,
      status: 409,
      code: 'no_source',
      error: opts.source === 'content'
        ? 'Bu konunun ders notu (içeriği) yok — "Mevcut sorulardan" kaynağını dene.'
        : 'Bu konunun test/boşluk/eşleştirme sorusu yok — "İçerikten" kaynağını dene.',
    };
  }

  const { data: existingData } = await supabase
    .from('questions')
    .select('question_text, question_classical!inner(prompt_version)')
    .eq('topic_id', topicId)
    .eq('question_type_id', TYPE_ID.classical)
    .eq('question_classical.prompt_version', YAZILI_PROMPT_VERSION)
    .order('id');
  const existing = ((existingData as { question_text: string }[] | null) ?? []).map((q) => q.question_text);
  const existingBlock = existing.length
    ? `Bu konunun ZATEN VAR OLAN klasik soruları (bunları ve benzerlerini TEKRARLAMA; yalnız bunların kapsamadığı kazanım/yönleri tamamla):\n${existing.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : '';
  const countRange = existing.length ? '3-8' : `${TOPIC_QUESTION_TARGET.min}-${TOPIC_QUESTION_TARGET.max}`;

  const [template, standard, classicalRules, svgFragment] = await Promise.all([
    readPrompt('39-exam-topic-classical-questions.md'),
    readPrompt('_yazili-question-standard.md'),
    readPrompt('_classical-question-rules.md'),
    readPrompt('_svg-question-fragment.md'),
  ]);

  // Parçalar önce açılır ki içlerindeki {grade} vb. de aşağıda değişsin.
  const prompt = template
    .replaceAll('{yazili_question_standard}', standard)
    .replaceAll('{classical_question_rules}', classicalRules)
    .replaceAll('{source_instruction}', SOURCE_INSTRUCTION[opts.source])
    .replaceAll('{source_block}', sourceBlock)
    .replaceAll('{existing_block}', existingBlock)
    .replaceAll('{grade}', topic.gradeName)
    .replaceAll('{lesson}', topic.lessonName)
    .replaceAll('{unit}', topic.unitTitle)
    .replaceAll('{topic}', topic.title)
    .replaceAll('{learning_outcomes}', loText)
    .replaceAll('{outcomes listesi, kod + metin}', outcomesText)
    .replaceAll('{question_count_instruction}', buildQuestionCountInstruction(null, countRange))
    .replaceAll('{math_notation_guidance}', buildMathNotationGuidance(topic.lessonName))
    .replaceAll('{math_classical_rules}', buildMathClassicalBalanceRules(topic.lessonName))
    .replaceAll('{svg_question_instructions}', svgFragment.replaceAll('{svg_lesson_guidance}', buildSvgLessonGuidance(topic.lessonName)));

  return { ok: true, prompt, existingCount: existing.length, topic, outcomes };
}

// Worker'ın ikinci çağrısı: taslağı aynı standarda göre denetleyip düzeltir.
export async function buildYaziliReviewPrompt(topic: YaziliTopicInfo, outcomes: ExamOutcome[], draftQuestions: unknown[]): Promise<string> {
  const [template, standard] = await Promise.all([readPrompt('40-exam-classical-review.md'), readPrompt('_yazili-question-standard.md')]);
  return template
    .replaceAll('{yazili_question_standard}', standard)
    .replaceAll('{grade}', topic.gradeName)
    .replaceAll('{lesson}', topic.lessonName)
    .replaceAll('{unit}', topic.unitTitle)
    .replaceAll('{topic}', topic.title)
    .replaceAll('{outcomes}', outcomes.map((o) => `${o.key}) ${o.description}`).join('\n'))
    .replaceAll('{draft_json}', JSON.stringify(draftQuestions, null, 1));
}
