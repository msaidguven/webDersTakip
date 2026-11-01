import 'server-only';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getQuestionsByIds } from '@/app/src/lib/quizQuestions';
import { getLessonDefinition } from './registry';
import { termSlug, type HydratedLesson, type HydratedStep, type LessonTerm } from './types';
import type { ClassicalQuestion, QuizQuestion, SvgPosition } from '@/app/src/lib/quizQuestionTypes';
import type { LessonDefinition } from './types';

async function loadGeneratedLesson(supabase: ReturnType<typeof createServiceClient>, topicId: number): Promise<LessonDefinition | null> {
  const { data } = await supabase.from('interactive_lessons').select('lesson').eq('topic_id', topicId).eq('status', 'ready').maybeSingle();
  const lesson = (data as { lesson: Omit<LessonDefinition, 'topicId'> | null } | null)?.lesson;
  return lesson ? { ...lesson, topicId } : null;
}

type ClassicalRow = { id: number; question_text: string; svg_content: string | null; svg_position: SvgPosition; question_classical: { model_answer: string | null } | null };

// Ders tanımı + soru adımları havuzdaki sorularla doldurulmuş hâl (admin önizleme API'si ve ses üretim betiği
// aynı kaynağı kullanır: Bit'in seslendirilen cümleleri öğrencinin gördüğüyle birebir aynı olsun).
export async function hydrateLesson(topicId: number): Promise<{ lesson: HydratedLesson } | { error: string; status: number }> {
  const supabase = createServiceClient();
  // Önce elle yazılmış ders (kodda), yoksa worker'ın ürettiği ve denetimden geçmiş ders (interactive_lessons).
  const lesson = getLessonDefinition(topicId) ?? (await loadGeneratedLesson(supabase, topicId));
  if (!lesson) return { error: 'Bu konu için etkileşimli ders henüz hazırlanmadı', status: 404 };

  const idsOf = (kind: 'soru' | 'klasik') =>
    lesson.blocks.flatMap((b) => b.steps.flatMap((s) => (s.kind === kind && 'questionId' in s ? [s.questionId] : [])));
  // Klasik sorular test motorunun çözücüsünde bilerek dışlanıyor (getQuestionsByIds); burada ayrı çekilir.
  const usedIds = new Set([...idsOf('soru'), ...idsOf('klasik')]);
  const [questions, classicalRes, topicRes, spareRes, highlightsRes] = await Promise.all([
    getQuestionsByIds(idsOf('soru')),
    supabase.from('questions').select('id, question_text, svg_content, svg_position, question_classical(model_answer)').in('id', idsOf('klasik')).eq('is_active', true),
    supabase.from('topics').select('title').eq('id', topicId).single(),
    supabase
      .from('questions')
      .select('id, section_id')
      .in('section_id', lesson.blocks.map((b) => b.sectionId))
      .eq('is_active', true)
      .neq('question_type_id', 4)
      .order('id'),
    // Kavram bağlarının tanımları: konunun yayındaki içeriğinin anahtar kavramları.
    supabase
      .from('topic_content_highlights')
      .select('icon, title, description, topic_contents!inner(topic_id, is_published)')
      .eq('topic_contents.topic_id', topicId)
      .eq('topic_contents.is_published', true),
  ]);
  const failed = classicalRes.error ?? topicRes.error ?? spareRes.error ?? highlightsRes.error;
  if (failed) return { error: failed.message, status: 500 };

  const spareRows = ((spareRes.data ?? []) as { id: number; section_id: number }[]).filter((r) => !usedIds.has(r.id));
  const spareQuestions = new Map((await getQuestionsByIds(spareRows.map((r) => r.id))).map((q) => [q.id, q]));

  const classical: ClassicalQuestion[] = ((classicalRes.data ?? []) as unknown as ClassicalRow[])
    .filter((r) => r.question_classical)
    .map((r) => ({ id: r.id, type: 'classical', question_text: r.question_text, svg_content: r.svg_content, svg_position: r.svg_position, modelAnswer: r.question_classical!.model_answer }));
  const byId = new Map<number, QuizQuestion>([...questions, ...classical].map((q) => [q.id, q]));
  const broken: number[] = [];
  let inlineId = 0;
  const blocks = lesson.blocks.map((block) => ({
    ...block,
    spares: spareRows.flatMap((r) => {
      const q = spareQuestions.get(r.id);
      return r.section_id === block.sectionId && (q?.type === 'multiple_choice' || q?.type === 'blank') ? [q] : [];
    }),
    steps: block.steps.flatMap((step): HydratedStep[] => {
      if (step.kind !== 'soru' && step.kind !== 'klasik') return [step];
      if (!('questionId' in step)) {
        // Derste yazılmış "Konuyu anladık mı?" sorusu: havuzda yok, negatif sanal id (istemcide yalnız anahtar).
        inlineId -= 1;
        return [{ kind: 'klasik', question: { id: inlineId, type: 'classical', question_text: step.prompt, svg_content: null, svg_position: 'below', modelAnswer: step.modelAnswer } }];
      }
      const q = byId.get(step.questionId);
      if (step.kind === 'soru' && (q?.type === 'multiple_choice' || q?.type === 'blank')) return [{ kind: 'soru', question: q }];
      if (step.kind === 'klasik' && q?.type === 'classical') return [{ kind: 'klasik', question: q }];
      broken.push(step.questionId);
      return [];
    }),
  }));
  // Pasifleşmiş/silinmiş ya da tipi değişmiş soru: dersi sessizce eksik göstermek yerine hata ver.
  if (broken.length) return { error: `Derste kullanılamayan soru var: ${broken.join(', ')}`, status: 500 };

  const terms: Record<string, LessonTerm> = {};
  for (const h of (highlightsRes.data ?? []) as { icon: string | null; title: string; description: string }[]) {
    terms[termSlug(h.title)] = { title: h.title, description: h.description, icon: h.icon ?? undefined };
  }
  Object.assign(terms, lesson.terms);

  const payload: HydratedLesson = { topicId, topicTitle: (topicRes.data as { title: string }).title, blocks, terms, autoLinkExclude: lesson.autoLinkExclude ?? [], guide: lesson.guide };
  return { lesson: payload };
}
