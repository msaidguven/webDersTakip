import 'server-only';
import { unstable_cache } from 'next/cache';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getQuestionsByIds } from '@/app/src/lib/quizQuestions';
import { getLessonDefinition, type AnyLessonDefinition } from './registry';
import { termSlug, type HydratedLesson, type HydratedStep, type LessonTerm } from './types';
import { isLessonV2, type HydratedLessonV2, type HydratedV2Step, type LessonDefinitionV2 } from './typesV2';
import type { ClassicalQuestion, QuizQuestion, SvgPosition } from '@/app/src/lib/quizQuestionTypes';

export type AnyHydratedLesson = (HydratedLesson & { version: 1 }) | HydratedLessonV2;

// Öğrenciye yalnız sesleri tamamlanmış ders gösterilir (kullanıcı kararı 2026-11-03); ses üretimi (voice.ts)
// sesi eksik dersi de okuyabilmeli → includeUnvoiced.
async function loadGeneratedLesson(supabase: ReturnType<typeof createServiceClient>, topicId: number, includeUnvoiced: boolean): Promise<AnyLessonDefinition | null> {
  let query = supabase.from('interactive_lessons').select('lesson').eq('topic_id', topicId).eq('status', 'ready');
  if (!includeUnvoiced) query = query.eq('voice_done', true);
  const { data } = await query.maybeSingle();
  const lesson = (data as { lesson: Omit<AnyLessonDefinition, 'topicId'> | null } | null)?.lesson;
  return lesson ? ({ ...lesson, topicId } as AnyLessonDefinition) : null;
}

type ClassicalRow = { id: number; question_text: string; svg_content: string | null; svg_position: SvgPosition; question_classical: { model_answer: string | null } | null };

async function hydrateLessonV2(
  supabase: ReturnType<typeof createServiceClient>,
  lesson: LessonDefinitionV2,
): Promise<{ lesson: HydratedLessonV2 } | { error: string; status: number }> {
  const qIds = lesson.stops.flatMap((stop) =>
    stop.steps.flatMap((s) => (s.kind === 'pool_question' ? [s.questionId] : [])),
  );
  const [questions, topicRes, highlightsRes] = await Promise.all([
    getQuestionsByIds(qIds),
    supabase.from('topics').select('title').eq('id', lesson.topicId).single(),
    supabase
      .from('topic_content_highlights')
      .select('icon, title, description, topic_contents!inner(topic_id, is_published)')
      .eq('topic_contents.topic_id', lesson.topicId)
      .eq('topic_contents.is_published', true),
  ]);
  const failed = topicRes.error ?? highlightsRes.error;
  if (failed) return { error: failed.message, status: 500 };

  const terms: Record<string, LessonTerm> = {};
  for (const h of (highlightsRes.data ?? []) as { icon: string | null; title: string; description: string }[]) {
    terms[termSlug(h.title)] = { title: h.title, description: h.description, icon: h.icon ?? undefined };
  }

  const byId = new Map<number, QuizQuestion>(questions.map((q) => [q.id, q]));
  const broken: number[] = [];

  const stops = lesson.stops.map((stop) => ({
    ...stop,
    steps: stop.steps.flatMap((step): HydratedV2Step[] => {
      if (step.kind === 'pool_question') {
        const q = byId.get(step.questionId);
        if (q?.type === 'multiple_choice' || q?.type === 'blank') {
          return [{ kind: 'pool_question', say: step.say, question: q }];
        }
        broken.push(step.questionId);
        return [];
      }
      if (step.kind === 'kavram_avi' && !step.definition) {
        const slug = step.highlightSlug ?? termSlug(step.word);
        const found = terms[slug];
        return [{ ...step, definition: found?.description ?? `${step.word} kavramını harfleri birleştirerek bul.` }];
      }
      return [step];
    }),
  }));

  if (broken.length) return { error: `Derste kullanılamayan soru var: ${broken.join(', ')}`, status: 500 };

  return {
    lesson: {
      ...lesson,
      topicTitle: (topicRes.data as { title: string }).title,
      stops,
      terms,
    },
  };
}

// Ders tanımı + soru adımları havuzdaki sorularla doldurulmuş hâl (admin önizleme API'si ve ses üretim betiği
// aynı kaynağı kullanır: Atom'un seslendirilen cümleleri öğrencinin gördüğüyle birebir aynı olsun).
export async function hydrateLesson(topicId: number, opts: { includeUnvoiced?: boolean } = {}): Promise<{ lesson: AnyHydratedLesson } | { error: string; status: number }> {
  const supabase = createServiceClient();
  // Önce elle yazılmış ders (kodda), yoksa worker'ın ürettiği ve denetimden geçmiş ders (interactive_lessons).
  const lesson = getLessonDefinition(topicId) ?? (await loadGeneratedLesson(supabase, topicId, !!opts.includeUnvoiced));
  if (!lesson) return { error: 'Bu konu için etkileşimli ders henüz hazırlanmadı', status: 404 };
  if (isLessonV2(lesson)) return hydrateLessonV2(supabase, lesson);

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

  const payload: HydratedLesson & { version: 1 } = {
    version: 1,
    topicId,
    topicTitle: (topicRes.data as { title: string }).title,
    blocks,
    terms,
    autoLinkExclude: lesson.autoLinkExclude ?? [],
    guide: lesson.guide,
  };
  return { lesson: payload };
}

// Öğrenciye giden ders önbellekten gelir (kullanıcı kararı 2026-11-03): yalnız PUSH (yeni yayın kimliği anahtarda)
// ya da içerik değişince (worker revalidateTag — interactiveLessonTag) yenilenir. Hata (500) önbelleğe girmez;
// "ders yok" (404) girer, ders açılınca etiketle temizlenir.
export const interactiveLessonTag = (topicId: number) => `interactive-lesson-${topicId}`;
const DEPLOY_KEY = process.env.K_REVISION ?? process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'yerel';

export function getCachedLesson(topicId: number) {
  return unstable_cache(
    async () => {
      const result = await hydrateLesson(topicId);
      if ('error' in result && result.status >= 500) throw new Error(result.error);
      return result;
    },
    ['interactive-lesson', DEPLOY_KEY, String(topicId)],
    { tags: [interactiveLessonTag(topicId)], revalidate: false },
  )();
}
