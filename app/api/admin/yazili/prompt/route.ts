import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { buildMathClassicalBalanceRules, buildMathNotationGuidance, buildQuestionCountInstruction, buildSvgLessonGuidance } from '@/app/src/lib/promptHelpers';
import { TYPE_ID } from '@/app/src/lib/parseMixedQuestions';
import { TOPIC_QUESTION_TARGET } from '@/app/src/lib/yazili/common';
import { loadTopicOutcomes } from '@/app/src/lib/yazili/server';

// Yazılı soruları — konu bazlı klasik soru promptu (manuel: kopyala → AI → JSON yapıştır).
//   source=content   konu anlatımından (compact=1: tam metin yerine alt başlık özetleri)
//   source=questions konunun test/boşluk/eşleştirme sorularından, yeniden kurgulayarak
// Konunun mevcut klasik soruları da verilir: ikinci tur tekrar değil, eksik kazanımları tamamlar.

const SOURCE_INSTRUCTION = {
  content: '- Sorular SADECE aşağıdaki ders notunda geçen bilgilerden sorulsun.',
  questions:
    '- Kaynak olarak aşağıdaki mevcut test/boşluk doldurma/eşleştirme soruları verildi. Bunların ölçtüğü bilgileri klasik (yazarak cevaplanan) soruya DÖNÜŞTÜR: soruyu yeniden kurgula, şıkları kaldırıp "soru işaretsiz test sorusu" haline getirme; aynı bilgiyi açıklama/yorum/karşılaştırma isteyen bir soruyla ölç. Birden çok test sorusunu tek klasik soruda birleştirebilirsin.',
} as const;

type Section = { heading: string; body_markdown: string | null; review_summary: string | null };

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const sp = request.nextUrl.searchParams;
  const topicId = Number(sp.get('topicId'));
  const source = sp.get('source') === 'questions' ? 'questions' : 'content';
  const compact = sp.get('compact') === '1';
  if (!Number.isInteger(topicId)) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: topicData } = await supabase
    .from('topics')
    .select('id, title, units!inner(title, grades(name), lessons(name))')
    .eq('id', topicId)
    .maybeSingle();
  const topic = topicData as unknown as { id: number; title: string; units: { title: string; grades: { name: string } | null; lessons: { name: string } | null } } | null;
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });
  const gradeName = topic.units.grades?.name ?? '';
  const lessonName = topic.units.lessons?.name ?? '';

  const outcomes = (await loadTopicOutcomes(supabase, [topicId])).get(topicId) ?? [];
  if (!outcomes.length) return NextResponse.json({ error: 'Bu konunun güncel kazanımı yok' }, { status: 409 });
  const outcomesText = outcomes.map((o) => `${o.key}) ${o.description}`).join('\n');
  const { data: loData } = await supabase.from('topic_learning_outcomes').select('code, title').eq('topic_id', topicId).order('order_no');
  const loText = ((loData as { code: string | null; title: string | null }[] | null) ?? [])
    .map((l) => [l.code, l.title].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n') || '—';

  let sourceBlock: string;
  if (source === 'content') {
    const { data: tc } = await supabase.from('topic_contents').select('id').eq('topic_id', topicId).maybeSingle();
    const { data: sectionsData } = tc
      ? await supabase
        .from('topic_content_sections')
        .select('heading, body_markdown, review_summary, order_no')
        .eq('topic_content_id', (tc as { id: number }).id)
        .order('order_no')
      : { data: [] };
    const sections = (sectionsData as Section[] | null) ?? [];
    const text = sections
      .map((s) => {
        const body = compact ? s.review_summary?.trim() || s.body_markdown?.trim() : s.body_markdown?.trim();
        return body ? `### ${s.heading}\n${body}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
    if (!text) return NextResponse.json({ error: 'Bu konunun ders notu (içeriği) yok — "Mevcut sorulardan" kaynağını dene.' }, { status: 409 });
    sourceBlock = `Konunun ders notu${compact ? ' (alt başlık özetleri)' : ''}:\n${text}`;
  } else {
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
    if (!lines.length) return NextResponse.json({ error: 'Bu konunun test/boşluk/eşleştirme sorusu yok — "İçerikten" kaynağını dene.' }, { status: 409 });
    sourceBlock = `Konunun mevcut soruları (kaynak):\n${lines.join('\n')}`;
  }

  const { data: existingData } = await supabase
    .from('questions')
    .select('question_text')
    .eq('topic_id', topicId)
    .eq('question_type_id', TYPE_ID.classical)
    .order('id');
  const existing = ((existingData as { question_text: string }[] | null) ?? []).map((q) => q.question_text);
  const existingBlock = existing.length
    ? `Bu konunun ZATEN VAR OLAN klasik soruları (bunları ve benzerlerini TEKRARLAMA; yalnız bunların kapsamadığı kazanım/yönleri tamamla):\n${existing.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : '';
  const countRange = existing.length ? '3-8' : `${TOPIC_QUESTION_TARGET.min}-${TOPIC_QUESTION_TARGET.max}`;

  const [template, classicalRules, svgFragment] = await Promise.all([
    readFile(path.join(process.cwd(), 'app', 'prompt', '39-exam-topic-classical-questions.md'), 'utf8'),
    readFile(path.join(process.cwd(), 'app', 'prompt', '_classical-question-rules.md'), 'utf8'),
    readFile(path.join(process.cwd(), 'app', 'prompt', '_svg-question-fragment.md'), 'utf8'),
  ]);

  // {classical_question_rules} önce açılır ki içindeki {grade} vb. de aşağıda değişsin.
  const prompt = template
    .replaceAll('{classical_question_rules}', classicalRules)
    .replaceAll('{source_instruction}', SOURCE_INSTRUCTION[source])
    .replaceAll('{source_block}', sourceBlock)
    .replaceAll('{existing_block}', existingBlock)
    .replaceAll('{grade}', gradeName)
    .replaceAll('{lesson}', lessonName)
    .replaceAll('{unit}', topic.units.title)
    .replaceAll('{topic}', topic.title)
    .replaceAll('{learning_outcomes}', loText)
    .replaceAll('{outcomes listesi, kod + metin}', outcomesText)
    .replaceAll('{question_count_instruction}', buildQuestionCountInstruction(null, countRange))
    .replaceAll('{math_notation_guidance}', buildMathNotationGuidance(lessonName))
    .replaceAll('{math_classical_rules}', buildMathClassicalBalanceRules(lessonName))
    .replaceAll('{svg_question_instructions}', svgFragment.replaceAll('{svg_lesson_guidance}', buildSvgLessonGuidance(lessonName)));

  return NextResponse.json({ prompt, length: prompt.length, existingCount: existing.length });
}
