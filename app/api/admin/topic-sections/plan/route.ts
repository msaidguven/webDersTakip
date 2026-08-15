import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { cleanHighlights, replaceHighlights, type IncomingHighlight } from '@/app/src/lib/topicContentHighlights';

type IncomingSection = {
  heading?: unknown;
  order_no?: unknown;
  matched_outcome_codes?: unknown;
  body_markdown?: unknown;
  needs_image?: unknown;
  image_prompt?: unknown;
};
type CleanSection = {
  heading: string;
  order_no: number;
  matched_outcome_codes: string[];
  body_markdown: string | null;
  image_prompt: string | null;
};
type OutcomeRow = { id: number; code: string | null };
type IncomingCover = { subtitle?: unknown; image_prompt?: unknown; highlights?: IncomingHighlight[] };

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as {
    topicId?: number | string;
    sections?: IncomingSection[];
    cover?: IncomingCover;
  } | null;
  const topicId = body?.topicId;
  const sections = body?.sections;
  const cover = body?.cover;

  if (!topicId || !Array.isArray(sections) || sections.length === 0) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const cleanSections: CleanSection[] = sections
    .filter((s): s is IncomingSection & { heading: string } => typeof s?.heading === 'string' && s.heading.trim().length > 0)
    .map((s, idx) => {
      const bodyMarkdown = typeof s.body_markdown === 'string' ? s.body_markdown.trim() : '';
      const needsImage = Boolean(s.needs_image);
      return {
        heading: s.heading.trim(),
        order_no: typeof s.order_no === 'number' ? s.order_no : idx,
        matched_outcome_codes: Array.isArray(s.matched_outcome_codes)
          ? s.matched_outcome_codes.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => c.trim())
          : [],
        body_markdown: bodyMarkdown || null,
        image_prompt: needsImage && typeof s.image_prompt === 'string' && s.image_prompt.trim() ? s.image_prompt.trim() : null,
      };
    });

  if (!cleanSections.length) {
    return NextResponse.json({ error: 'Geçerli alt başlık bulunamadı' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: topic } = await supabase.from('topics').select('id, title').eq('id', topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });
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
        is_published: false,
        source: 'ai_generated',
      })
      .select('id')
      .single();

    if (createError || !created) {
      return NextResponse.json({ error: 'İçerik kaydı oluşturulamadı' }, { status: 500 });
    }
    topicContentId = (created as { id: number }).id;
  } else {
    const { data: oldSections } = await supabase
      .from('topic_content_sections')
      .select('id')
      .eq('topic_content_id', topicContentId);

    const oldSectionIds = ((oldSections as { id: number }[] | null) || []).map((s) => s.id);
    if (oldSectionIds.length) {
      await supabase.from('topic_content_section_outcomes').delete().in('section_id', oldSectionIds);
    }
    await supabase.from('topic_content_sections').delete().eq('topic_content_id', topicContentId);
  }

  // cover artık sadece subtitle taşıyor (kapak görseli ve anahtar kavramlar ayrı, kendi
  // promptlarıyla üretiliyor); o yüzden sadece gerçekten gönderilen alanları güncelliyoruz —
  // aksi halde subtitle-only bir plan kaydı, önceden ayrı ayrı kaydedilmiş kapak görselini/
  // anahtar kavramları sessizce silerdi.
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

  const { data: insertedSections, error: insertError } = await supabase
    .from('topic_content_sections')
    .insert(
      cleanSections.map((s) => ({
        topic_content_id: topicContentId,
        order_no: s.order_no,
        heading: s.heading,
        body_markdown: s.body_markdown,
        image_prompt: s.image_prompt,
        status: s.body_markdown ? 'content_ready' : 'planned',
      }))
    )
    .select('id, order_no, heading');

  if (insertError || !insertedSections) {
    return NextResponse.json({ error: 'Alt başlıklar kaydedilemedi' }, { status: 500 });
  }

  const newSections = insertedSections as { id: number; order_no: number; heading: string }[];

  const { data: outcomesData } = await supabase
    .from('outcomes')
    .select('id, code')
    .eq('topic_id', topicRow.id);

  const codeToOutcomeId = new Map<string, number>();
  for (const o of (outcomesData as OutcomeRow[] | null) || []) {
    if (o.code?.trim()) codeToOutcomeId.set(o.code.trim(), o.id);
  }

  const unresolvedCodes = new Set<string>();
  const links: { section_id: number; outcome_id: number }[] = [];

  newSections.forEach((newSection, idx) => {
    const codes = cleanSections[idx]?.matched_outcome_codes || [];
    for (const code of codes) {
      const outcomeId = codeToOutcomeId.get(code);
      if (outcomeId) {
        links.push({ section_id: newSection.id, outcome_id: outcomeId });
      } else {
        unresolvedCodes.add(code);
      }
    }
  });

  if (links.length) {
    const { error: linkError } = await supabase.from('topic_content_section_outcomes').insert(links);
    if (linkError) {
      return NextResponse.json({ error: 'Kazanım eşlemeleri kaydedilemedi' }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    topicContentId,
    unresolvedCodes: Array.from(unresolvedCodes),
  });
}
