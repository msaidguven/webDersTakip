import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { cleanHighlights, replaceHighlights, type IncomingHighlight } from '@/app/src/lib/topicContentHighlights';

type IncomingSection = {
  heading?: unknown;
  order_no?: unknown;
  matched_outcome_codes?: unknown;
  body_markdown?: unknown;
  explanation_markdown?: unknown;
  notebook_markdown?: unknown;
  needs_image?: unknown;
  image_prompt?: unknown;
};
type CleanSection = {
  heading: string;
  order_no: number;
  matched_outcome_codes: string[];
  body_markdown: string | null;
  notebook_markdown: string | null;
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
    ai_model?: unknown;
  } | null;
  const topicId = body?.topicId;
  const sections = body?.sections;
  const cover = body?.cover;
  const aiModel = typeof body?.ai_model === 'string' && body.ai_model.trim() ? body.ai_model.trim() : null;

  if (!topicId || !Array.isArray(sections) || sections.length === 0) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const cleanSections: CleanSection[] = sections
    .filter((s): s is IncomingSection & { heading: string } => typeof s?.heading === 'string' && s.heading.trim().length > 0)
    .map((s, idx) => {
      // "Konu Anlatımı" alanı, RAG sentez akışında (20-rag-synthesis-full-topic.md)
      // explanation_markdown adıyla geliyor; kitap kaynaklı eski akış (03-notebooklm-full-topic.md)
      // hâlâ body_markdown döndürüyor — ikisini de aynı DB kolonuna (body_markdown) yazıyoruz.
      const bodyMarkdown = typeof s.explanation_markdown === 'string'
        ? s.explanation_markdown.trim()
        : typeof s.body_markdown === 'string' ? s.body_markdown.trim() : '';
      const notebookMarkdown = typeof s.notebook_markdown === 'string' ? s.notebook_markdown.trim() : '';
      const needsImage = Boolean(s.needs_image);
      return {
        heading: s.heading.trim(),
        order_no: typeof s.order_no === 'number' ? s.order_no : idx,
        matched_outcome_codes: Array.isArray(s.matched_outcome_codes)
          ? s.matched_outcome_codes.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => c.trim())
          : [],
        body_markdown: bodyMarkdown || null,
        notebook_markdown: notebookMarkdown || null,
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

  // Bu akış (NotebookLM tek prompt) alt başlık + içeriği tek seferde tamamlıyor,
  // taslak bırakmak yerine direkt yayınlıyoruz — aksi halde admin ders sayfasında
  // hiçbir değişiklik görmez ve kaydın DB'ye gitmediğini sanır (ayrı bir "yayınla"
  // adımı yalnızca "Kazanım / kapak görseli yönetimi" panelinde var, burada gösterilmiyor).
  // Bu, ilk kayıtta olduğu kadar aynı konuya sonraki her yeniden kayıtta da geçerli.
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
      return NextResponse.json({ error: 'İçerik kaydı oluşturulamadı' }, { status: 500 });
    }
    topicContentId = (created as { id: number }).id;
  }

  // Aynı konuyu ikinci kez kaydederken, başlığı bir öncekiyle BİREBİR aynı olan alt
  // başlıkları silip yeniden yaratmak yerine güncelliyoruz — aksi halde o satıra bağlı
  // görsel/diyagram (topic_content_sections.image_url/diagram_svg, storage'da yedeksiz)
  // ve soru bağlantıları (bkz. 2026-09-11 kullanıcı sorusu) her yeniden üretimde kaybolurdu.
  // Başlığı artık gelmeyen (konudan tamamen çıkarılmış) eski alt başlıklar hâlâ siliniyor.
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

    const updateResults = await Promise.all(
      cleanSections.map((s, idx) => {
        const oldId = matchedOldIdForIndex[idx];
        if (oldId === null) return null;
        return supabase
          .from('topic_content_sections')
          .update({
            order_no: s.order_no,
            body_markdown: s.body_markdown,
            notebook_markdown: s.notebook_markdown,
            image_prompt: s.image_prompt,
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
      // Asıl Supabase hata mesajını (ör. RLS/tip/kolon hatası) client'a döndürüyoruz —
      // aksi halde jenerik "güncellenemedi" mesajı kök nedeni teşhis etmeyi imkansız
      // kılıyor (2026-09-11 kullanıcı raporu: "alt başlıklar güncellenemedi" uyarısı).
      return NextResponse.json(
        { error: `Alt başlıklar güncellenemedi: ${updateErrors[0].message}` },
        { status: 500 }
      );
    }
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

  // Başlığı eşleşen alt başlıklar yukarıda zaten UPDATE edildi (görsel/diyagram/soru
  // bağlantılarını korumak için); burada sadece eşleşmeyen (yeni) alt başlıkları ekliyoruz.
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
            image_prompt: s.image_prompt,
            status: s.body_markdown ? 'content_ready' : 'planned',
            // Bu içerik AI'dan tek seferde geldiyse (NotebookLM akışı) burada da işaretle;
            // sadece başlık planı yapan akışta (body_markdown yok) source varsayılanında kalır,
            // içerik daha sonra ayrı bir promptla eklenirken kendi kaynağını işaretler.
            ...(s.body_markdown && aiModel ? { source: 'ai_generated', ai_model: aiModel } : {}),
          };
        })
      )
      .select('id, order_no, heading');

    if (insertError || !data) {
      return NextResponse.json({ error: 'Alt başlıklar kaydedilemedi' }, { status: 500 });
    }
    insertedSections = data as { id: number; order_no: number; heading: string }[];
  }

  // cleanSections ile aynı sırada, her alt başlığın nihai (korunan ya da yeni) id'si —
  // eşleşen için matchedOldIdForIndex, eşleşmeyen için toInsertIndices sırasıyla insert
  // sonucundaki id (Postgres tek VALUES-listeli INSERT'te RETURNING sırasını korur).
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
    .eq('topic_id', topicRow.id);

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
      return NextResponse.json({ error: 'Kazanım eşlemeleri kaydedilemedi' }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    topicContentId,
    unresolvedCodes: Array.from(unresolvedCodes),
  });
}
