import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanHighlights, replaceHighlights, type IncomingHighlight } from '@/app/src/lib/topicContentHighlights';
import { revalidateTopicPagesByContentIds, revalidateHomepage } from '@/app/src/lib/topicPageRevalidation';
import { generateSlideDeck } from '@/app/src/lib/topicSlideDeck';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

export type IncomingSection = {
  heading?: unknown;
  order_no?: unknown;
  matched_outcome_codes?: unknown;
  body_markdown?: unknown;
  explanation_markdown?: unknown;
  notebook_markdown?: unknown;
  activity_prompt_markdown?: unknown;
  activity_example_markdown?: unknown;
  review_summary?: unknown;
  needs_image?: unknown;
  image_prompt?: unknown;
  needs_video?: unknown;
  video_prompt?: unknown;
};
type CleanSection = {
  heading: string;
  order_no: number;
  matched_outcome_codes: string[];
  body_markdown: string | null;
  notebook_markdown: string | null;
  activity_prompt_markdown: string | null;
  activity_example_markdown: string | null;
  review_summary: string | null;
  image_prompt: string | null;
  video_prompt: string | null;
  imageFieldProvided: boolean;
  videoFieldProvided: boolean;
};
type OutcomeRow = { id: number; code: string | null };
export type IncomingCover = { subtitle?: unknown; image_prompt?: unknown; highlights?: IncomingHighlight[] };

export type PublishTopicContentInput = {
  topicId: number | string;
  sections: IncomingSection[];
  cover?: IncomingCover | null;
  ai_model?: unknown;
  summary_markdown?: unknown;
  discussion_prompt_markdown?: unknown;
};

export type PublishTopicContentResult =
  | { ok: true; topicContentId: number; unresolvedCodes: string[] }
  | { ok: false; status: number; error: string };

// Hem admin panelinin manuel onay/kayıt akışı (topic-sections/plan/route.ts) hem otomatik
// AI taslak yayınlama (aiContentDraftGen.ts, kullanıcının 2026-09-24 isteği: "otomatik
// yayınlansın") AYNI kaydetme/slayt-üretme/revalidate mantığını kullanır — paralel bir
// yayınlama akışı icat edilmiyor, ikisi de burayı çağırıyor.
export async function publishTopicContent(supabase: Supabase, body: PublishTopicContentInput): Promise<PublishTopicContentResult> {
  const topicId = body.topicId;
  const sections = body.sections;
  const cover = body.cover;
  const aiModel = typeof body.ai_model === 'string' && body.ai_model.trim() ? body.ai_model.trim() : null;
  const summaryMarkdown = typeof body.summary_markdown === 'string' ? body.summary_markdown.trim() : '';
  const discussionPromptMarkdown = typeof body.discussion_prompt_markdown === 'string' ? body.discussion_prompt_markdown.trim() : '';

  if (!topicId || !Array.isArray(sections) || sections.length === 0) {
    return { ok: false, status: 400, error: 'Geçersiz istek' };
  }

  const cleanSections: CleanSection[] = sections
    .filter((s): s is IncomingSection & { heading: string } => typeof s?.heading === 'string' && s.heading.trim().length > 0)
    .map((s, idx) => {
      const bodyMarkdown = typeof s.explanation_markdown === 'string'
        ? s.explanation_markdown.trim()
        : typeof s.body_markdown === 'string' ? s.body_markdown.trim() : '';
      const notebookMarkdown = typeof s.notebook_markdown === 'string' ? s.notebook_markdown.trim() : '';
      const activityPrompt = typeof s.activity_prompt_markdown === 'string' ? s.activity_prompt_markdown.trim() : '';
      const activityExample = typeof s.activity_example_markdown === 'string' ? s.activity_example_markdown.trim() : '';
      const reviewSummary = typeof s.review_summary === 'string' ? s.review_summary.trim() : '';
      const needsImage = Boolean(s.needs_image);
      const needsVideo = Boolean(s.needs_video);
      return {
        heading: s.heading.trim(),
        order_no: typeof s.order_no === 'number' ? s.order_no : idx,
        matched_outcome_codes: Array.isArray(s.matched_outcome_codes)
          ? s.matched_outcome_codes.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => c.trim())
          : [],
        body_markdown: bodyMarkdown || null,
        notebook_markdown: notebookMarkdown || null,
        activity_prompt_markdown: activityPrompt || null,
        activity_example_markdown: activityExample || null,
        review_summary: reviewSummary || null,
        image_prompt: needsImage && typeof s.image_prompt === 'string' && s.image_prompt.trim() ? s.image_prompt.trim() : null,
        video_prompt: needsVideo && typeof s.video_prompt === 'string' && s.video_prompt.trim() ? s.video_prompt.trim() : null,
        imageFieldProvided: 'needs_image' in s || 'image_prompt' in s,
        videoFieldProvided: 'needs_video' in s || 'video_prompt' in s,
      };
    });

  if (!cleanSections.length) {
    return { ok: false, status: 400, error: 'Geçerli alt başlık bulunamadı' };
  }

  const { data: topic } = await supabase.from('topics').select('id, title').eq('id', topicId).maybeSingle();
  if (!topic) return { ok: false, status: 404, error: 'Konu bulunamadı' };
  const topicRow = topic as { id: number; title: string };

  const { data: existingContent } = await supabase
    .from('topic_contents')
    .select('id')
    .eq('topic_id', topicRow.id)
    .maybeSingle();

  let topicContentId = (existingContent as { id: number } | null)?.id;

  if (!topicContentId) {
    const { data: created, error: createError } = await supabase
      .from('topic_contents')
      .insert({
        topic_id: topicRow.id,
        title: topicRow.title,
        body_markdown: '',
        is_published: true,
        source: 'ai_generated',
      })
      .select('id')
      .single();

    if (createError || !created) {
      return { ok: false, status: 500, error: 'İçerik kaydı oluşturulamadı' };
    }
    topicContentId = (created as { id: number }).id;
  }

  const matchedOldIdForIndex: (number | null)[] = new Array(cleanSections.length).fill(null);

  if (existingContent) {
    await supabase.from('topic_contents').update({ is_published: true }).eq('id', topicContentId);

    const { data: oldSectionsData } = await supabase
      .from('topic_content_sections')
      .select('id, heading')
      .eq('topic_content_id', topicContentId);

    const oldSections = (oldSectionsData as { id: number; heading: string }[] | null) || [];
    const oldSectionIds = oldSections.map((s) => s.id);
    if (oldSectionIds.length) {
      await supabase.from('topic_content_section_outcomes').delete().in('section_id', oldSectionIds);
    }

    const oldIdQueueByHeading = new Map<string, number[]>();
    for (const s of oldSections) {
      const list = oldIdQueueByHeading.get(s.heading) || [];
      list.push(s.id);
      oldIdQueueByHeading.set(s.heading, list);
    }

    cleanSections.forEach((s, idx) => {
      const queue = oldIdQueueByHeading.get(s.heading);
      if (queue && queue.length) {
        matchedOldIdForIndex[idx] = queue.shift()!;
      }
    });

    const matchedOldIds = new Set(matchedOldIdForIndex.filter((id): id is number => id !== null));
    const idsToDelete = oldSectionIds.filter((id) => !matchedOldIds.has(id));
    if (idsToDelete.length) {
      await supabase.from('topic_content_sections').delete().in('id', idsToDelete);
    }

    const matchedIndices = cleanSections
      .map((_, idx) => idx)
      .filter((idx) => matchedOldIdForIndex[idx] !== null);

    if (matchedIndices.length) {
      const tempResults = await Promise.all(
        matchedIndices.map((idx, tempOffset) =>
          supabase
            .from('topic_content_sections')
            .update({ order_no: -(tempOffset + 1) })
            .eq('id', matchedOldIdForIndex[idx]!)
        )
      );
      const tempErrors = tempResults.map((r) => r.error).filter((e): e is NonNullable<typeof e> => Boolean(e));
      if (tempErrors.length) {
        return { ok: false, status: 500, error: `Alt başlıklar güncellenemedi: ${tempErrors[0].message}` };
      }
    }

    const updateResults = await Promise.all(
      matchedIndices.map((idx) => {
        const s = cleanSections[idx];
        const oldId = matchedOldIdForIndex[idx]!;
        return supabase
          .from('topic_content_sections')
          .update({
            order_no: s.order_no,
            body_markdown: s.body_markdown,
            notebook_markdown: s.notebook_markdown,
            activity_prompt_markdown: s.activity_prompt_markdown,
            activity_example_markdown: s.activity_example_markdown,
            review_summary: s.review_summary,
            ...(s.imageFieldProvided ? { image_prompt: s.image_prompt } : {}),
            ...(s.videoFieldProvided ? { video_prompt: s.video_prompt } : {}),
            status: s.body_markdown ? 'content_ready' : 'planned',
            ...(s.body_markdown && aiModel ? { source: 'ai_generated', ai_model: aiModel } : {}),
          })
          .eq('id', oldId);
      })
    );
    const updateErrors = updateResults
      .map((r) => r?.error)
      .filter((e): e is NonNullable<typeof e> => Boolean(e));
    if (updateErrors.length) {
      return { ok: false, status: 500, error: `Alt başlıklar güncellenemedi: ${updateErrors[0].message}` };
    }
  }

  if (cover) {
    const update: Record<string, unknown> = {};

    if (typeof cover.subtitle === 'string') {
      update.subtitle = cover.subtitle.trim() || null;
    }

    if (typeof cover.image_prompt === 'string' && cover.image_prompt.trim()) {
      const { data: current } = await supabase
        .from('topic_contents')
        .select('generation_meta')
        .eq('id', topicContentId)
        .maybeSingle();
      const currentMeta = current?.generation_meta && typeof current.generation_meta === 'object'
        ? (current.generation_meta as Record<string, unknown>)
        : {};
      update.generation_meta = { ...currentMeta, heroImagePrompt: cover.image_prompt.trim() };
    }

    if (Object.keys(update).length) {
      await supabase.from('topic_contents').update(update).eq('id', topicContentId);
    }

    if (Array.isArray(cover.highlights) && cover.highlights.length) {
      const cleanCoverHighlights = cleanHighlights(topicContentId, cover.highlights);
      await replaceHighlights(supabase, topicContentId, cleanCoverHighlights);
    }
  }

  const topicContentUpdate: Record<string, string> = {};
  if (summaryMarkdown) topicContentUpdate.summary_markdown = summaryMarkdown;
  if (discussionPromptMarkdown) topicContentUpdate.discussion_prompt_markdown = discussionPromptMarkdown;
  if (Object.keys(topicContentUpdate).length) {
    await supabase.from('topic_contents').update(topicContentUpdate).eq('id', topicContentId);
  }

  const toInsertIndices = cleanSections
    .map((_, idx) => idx)
    .filter((idx) => matchedOldIdForIndex[idx] === null);

  let insertedSections: { id: number; order_no: number; heading: string }[] = [];
  if (toInsertIndices.length) {
    const { data, error: insertError } = await supabase
      .from('topic_content_sections')
      .insert(
        toInsertIndices.map((idx) => {
          const s = cleanSections[idx];
          return {
            topic_content_id: topicContentId,
            order_no: s.order_no,
            heading: s.heading,
            body_markdown: s.body_markdown,
            notebook_markdown: s.notebook_markdown,
            activity_prompt_markdown: s.activity_prompt_markdown,
            activity_example_markdown: s.activity_example_markdown,
            review_summary: s.review_summary,
            image_prompt: s.image_prompt,
            video_prompt: s.video_prompt,
            status: s.body_markdown ? 'content_ready' : 'planned',
            ...(s.body_markdown && aiModel ? { source: 'ai_generated', ai_model: aiModel } : {}),
          };
        })
      )
      .select('id, order_no, heading');

    if (insertError || !data) {
      return { ok: false, status: 500, error: 'Alt başlıklar kaydedilemedi' };
    }
    insertedSections = data as { id: number; order_no: number; heading: string }[];
  }

  const finalIds: number[] = new Array(cleanSections.length);
  matchedOldIdForIndex.forEach((oldId, idx) => {
    if (oldId !== null) finalIds[idx] = oldId;
  });
  toInsertIndices.forEach((idx, k) => {
    finalIds[idx] = insertedSections[k].id;
  });

  const { data: outcomesData } = await supabase
    .from('outcomes')
    .select('id, code')
    .eq('topic_id', topicRow.id)
    .eq('is_current', true);

  const codeToOutcomeId = new Map<string, number>();
  for (const o of (outcomesData as OutcomeRow[] | null) || []) {
    if (o.code?.trim()) codeToOutcomeId.set(o.code.trim(), o.id);
  }

  const unresolvedCodes = new Set<string>();
  const links: { section_id: number; outcome_id: number }[] = [];

  cleanSections.forEach((s, idx) => {
    for (const code of s.matched_outcome_codes) {
      const outcomeId = codeToOutcomeId.get(code);
      if (outcomeId) {
        links.push({ section_id: finalIds[idx], outcome_id: outcomeId });
      } else {
        unresolvedCodes.add(code);
      }
    }
  });

  if (links.length) {
    const { error: linkError } = await supabase.from('topic_content_section_outcomes').insert(links);
    if (linkError) {
      return { ok: false, status: 500, error: 'Kazanım eşlemeleri kaydedilemedi' };
    }
  }

  await revalidateTopicPagesByContentIds(supabase, [topicContentId]);
  revalidateHomepage();

  try {
    const slideResult = await generateSlideDeck(supabase, topicRow.id);
    if (slideResult.ok) {
      await supabase
        .from('topic_content_slides')
        .upsert(
          { topic_content_id: slideResult.topicContentId, slides: slideResult.deck, ai_model: null, generated_at: new Date().toISOString() },
          { onConflict: 'topic_content_id' }
        );
    }
  } catch {
    // best-effort: slayt üretimi başarısız olursa asıl içerik kaydını asla engellemesin.
  }

  return { ok: true, topicContentId, unresolvedCodes: Array.from(unresolvedCodes) };
}
