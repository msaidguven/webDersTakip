import { readFile } from 'fs/promises';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sortOutcomesByWeek } from '@/app/src/lib/outcomeCodes';
import { computeUnitTopicPacing, buildPacingGuidance } from '@/app/src/lib/topicPacing';
import { fetchTeacherGuideGuidance } from '@/app/src/lib/teacherGuide/teacherGuideGuidance';
import { generateTopicContentJson } from '@/app/src/lib/geminiContentGen';
import type { ContentWorkerProfile } from '@/app/src/lib/contentWorkerProfiles';
import { publishTopicContent } from '@/app/src/lib/publishTopicContent';
import { normalizeHighlights, type IncomingHighlight } from '@/app/src/lib/topicContentHighlights';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

type EligibleTopicRow = { topic_id: number; unit_id: number; lesson_id: number; grade_id: number; source_kind: 'synthesis' | 'book' };

export interface ContentDraftGenerationResult {
  generated: boolean;
  reason?: string;
  draftId?: number;
  topicId?: number;
}

type DraftSection = {
  heading: string;
  order_no: number;
  matched_outcome_codes: string[];
  explanation_markdown: string;
  activity_prompt_markdown: string | null;
  activity_example_markdown: string | null;
  review_summary: string | null;
};

type DraftPayload = {
  cover: { subtitle?: string; highlights?: IncomingHighlight[] } | null;
  sections: DraftSection[];
  summary_markdown: string | null;
  discussion_prompt_markdown: string | null;
};

// full_from_synthesis akışının çıktısı artık otomatik yayınlanıyor (kullanıcının
// 2026-09-24 isteği: "evet otomatik yayınlansın") — burada sadece yayına gitmeye YETECEK
// kadar şema doğrulaması var (publishTopicContent zaten kendi tarafında tekrar temizliyor).
function parseContentDraft(raw: unknown): DraftPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const sectionsRaw = obj.sections;
  if (!Array.isArray(sectionsRaw) || !sectionsRaw.length) return null;

  const sections: DraftSection[] = [];
  for (const s of sectionsRaw) {
    if (!s || typeof s !== 'object') return null;
    const row = s as Record<string, unknown>;
    const heading = typeof row.heading === 'string' ? row.heading.trim() : '';
    const explanation = typeof row.explanation_markdown === 'string' ? row.explanation_markdown.trim() : '';
    if (!heading || !explanation) return null;
    sections.push({
      heading,
      order_no: typeof row.order_no === 'number' ? row.order_no : sections.length,
      matched_outcome_codes: Array.isArray(row.matched_outcome_codes)
        ? row.matched_outcome_codes.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
        : [],
      explanation_markdown: explanation,
      activity_prompt_markdown: typeof row.activity_prompt_markdown === 'string' ? row.activity_prompt_markdown.trim() || null : null,
      activity_example_markdown: typeof row.activity_example_markdown === 'string' ? row.activity_example_markdown.trim() || null : null,
      review_summary: typeof row.review_summary === 'string' ? row.review_summary.trim() || null : null,
    });
  }

  // cover.highlights: anahtar kavramlar artık ders notuyla AYNI çağrıda üretiliyor
  // (kullanıcının 2026-09-25 kararı). publishTopicContent bunu zaten kabul ediyor, sadece
  // buradan geçirilmesi gerekiyordu. Model atlarsa :51 worker'ı emniyet ağı olarak dolduruyor.
  const coverObj = obj.cover && typeof obj.cover === 'object' ? (obj.cover as Record<string, unknown>) : null;
  const coverSubtitle = typeof coverObj?.subtitle === 'string' ? coverObj.subtitle.trim() : '';
  const coverHighlights = normalizeHighlights(Array.isArray(coverObj?.highlights) ? (coverObj.highlights as IncomingHighlight[]) : []);
  const cover = coverSubtitle || coverHighlights.length
    ? {
        ...(coverSubtitle ? { subtitle: coverSubtitle } : {}),
        ...(coverHighlights.length ? { highlights: coverHighlights } : {}),
      }
    : null;

  return {
    cover,
    sections,
    summary_markdown: typeof obj.summary_markdown === 'string' ? obj.summary_markdown.trim() || null : null,
    discussion_prompt_markdown: typeof obj.discussion_prompt_markdown === 'string' ? obj.discussion_prompt_markdown.trim() || null : null,
  };
}

// Soru üretme worker'ının (aiQuestionDraftGen.ts) kullandığı AYNI kaynak: kitap yüklenmiş
// bir ünitenin TÜM chunk'ları — konu-bazlı değil ünite-bazlı, çünkü rag_document_chunks
// konuya değil üniteye bağlı. Prompt, modele "sadece bu konuyla ilgili kısmı bul" diyor.
async function fetchUnitBookContent(supabase: Supabase, unitId: number): Promise<string | null> {
  const { data: docs } = await supabase.from('rag_documents').select('id').eq('unit_id', unitId);
  const documentIds = ((docs as { id: number }[] | null) || []).map((d) => d.id);
  if (!documentIds.length) return null;

  const { data: chunks } = await supabase
    .from('rag_document_chunks')
    .select('content')
    .in('document_id', documentIds)
    .order('document_id', { ascending: true })
    .order('chunk_index', { ascending: true });
  const chunkRows = (chunks as { content: string }[] | null) || [];
  if (!chunkRows.length) return null;

  return chunkRows.map((c) => c.content).join('\n\n');
}

export async function generateNextAiContentDraft(
  supabase: Supabase,
  profile: ContentWorkerProfile
): Promise<ContentDraftGenerationResult> {
  const { data: eligibleRows, error: eligibleError } = await supabase.rpc('find_next_ai_content_draft_topic');
  if (eligibleError) return { generated: false, reason: `Uygun konu sorgusu başarısız: ${eligibleError.message}` };

  const eligible = (eligibleRows as EligibleTopicRow[] | null)?.[0];
  if (!eligible) return { generated: false, reason: 'Uygun konu yok (RAG sentezi veya kitabı hazır, alt başlığı hiç yok, kazanım kodları tam olan bir konu bulunamadı)' };

  const [{ data: topicRow }, { data: unitRow }, { data: lessonRow }, { data: gradeRow }] = await Promise.all([
    supabase.from('topics').select('id, title').eq('id', eligible.topic_id).maybeSingle(),
    supabase.from('units').select('id, title').eq('id', eligible.unit_id).maybeSingle(),
    supabase.from('lessons').select('id, name').eq('id', eligible.lesson_id).maybeSingle(),
    supabase.from('grades').select('id, name').eq('id', eligible.grade_id).maybeSingle(),
  ]);
  if (!topicRow || !unitRow || !lessonRow || !gradeRow) {
    return { generated: false, reason: 'Konu/ünite/ders/sınıf kaydı okunamadı' };
  }

  let sourceText = '';
  if (eligible.source_kind === 'synthesis') {
    const { data: synthesisDoc } = await supabase
      .from('rag_documents')
      .select('raw_text')
      .eq('topic_id', eligible.topic_id)
      .eq('source', 'ai_generated')
      .eq('is_synthesis', true)
      .maybeSingle();
    sourceText = ((synthesisDoc as { raw_text: string | null } | null)?.raw_text || '').trim();
    if (!sourceText) return { generated: false, reason: `Konu ${eligible.topic_id} için sentez metni bulunamadı` };
  } else {
    sourceText = (await fetchUnitBookContent(supabase, eligible.unit_id)) || '';
    if (!sourceText) return { generated: false, reason: `Ünite ${eligible.unit_id} için RAG kitap içeriği bulunamadı (belge/chunk yok)` };
  }

  const { data: outcomeRows } = await supabase
    .from('outcomes')
    .select('id, description, order_index, code')
    .eq('topic_id', eligible.topic_id)
    .eq('is_current', true)
    .order('order_index', { ascending: true });
  const outcomes = outcomeRows || [];
  const outcomeIds = outcomes.map((o: { id: number }) => o.id);
  const { data: weeksData } = outcomeIds.length
    ? await supabase.from('outcome_weeks').select('outcome_id, start_week').in('outcome_id', outcomeIds)
    : { data: [] as { outcome_id: number; start_week: number }[] };
  const weekByOutcomeId = new Map<number, number>();
  (weeksData || []).forEach((w: { outcome_id: number; start_week: number }) => weekByOutcomeId.set(w.outcome_id, w.start_week));
  const sortedOutcomes = sortOutcomesByWeek(
    outcomes.map((o: { id: number; description: string; order_index: number | null; code: string | null }) => ({
      ...o,
      startWeek: weekByOutcomeId.get(o.id) ?? null,
    }))
  );
  const outcomesText = sortedOutcomes.length
    ? sortedOutcomes.map((o: { code: string | null; description: string }) => `${o.code}) ${o.description}`).join('\n')
    : 'Bu konu için tanımlı kazanım bulunamadı.';

  const pacingMap = await computeUnitTopicPacing(supabase, unitRow.id, eligible.lesson_id, eligible.grade_id);
  const pacingGuidance = buildPacingGuidance(pacingMap.get(topicRow.id), 'content');
  const teacherGuideGuidance = await fetchTeacherGuideGuidance(supabase, topicRow.id);

  const templateFile = eligible.source_kind === 'synthesis' ? '20-rag-synthesis-full-topic.md' : '31-rag-book-full-topic.md';
  const sourcePlaceholder = eligible.source_kind === 'synthesis' ? '{source_text}' : '{book_content}';

  const promptDir = path.join(process.cwd(), 'app', 'prompt');
  const [explanationNotebookRules, topicSummaryDiscussionRules, topicHighlightsRules, template] = await Promise.all([
    readFile(path.join(promptDir, '_explanation-notebook-rules.md'), 'utf8').catch(() => ''),
    readFile(path.join(promptDir, '_topic-summary-discussion-rules.md'), 'utf8').catch(() => ''),
    readFile(path.join(promptDir, '_topic-highlights-rules.md'), 'utf8').catch(() => ''),
    readFile(path.join(promptDir, templateFile), 'utf8'),
  ]);

  const prompt = template
    .replaceAll('{explanation_notebook_rules}', explanationNotebookRules)
    .replaceAll('{topic_summary_discussion_rules}', topicSummaryDiscussionRules)
    .replaceAll('{topic_highlights_rules}', topicHighlightsRules)
    .replaceAll('{grade}', gradeRow.name)
    .replaceAll('{lesson}', lessonRow.name)
    .replaceAll('{unit}', unitRow.title)
    .replaceAll('{topic}', topicRow.title)
    .replaceAll('{outcomes listesi, kod + metin}', outcomesText)
    .replaceAll('{pacing_guidance}', pacingGuidance)
    .replaceAll('{teacher_guide_guidance}', teacherGuideGuidance)
    .replaceAll('{existing_headings}', '')
    .replaceAll(sourcePlaceholder, sourceText);

  let raw: unknown;
  try {
    raw = await generateTopicContentJson(prompt, profile);
  } catch (e) {
    return { generated: false, reason: `Gemini çağrısı başarısız: ${e instanceof Error ? e.message : String(e)}` };
  }

  const parsed = parseContentDraft(raw);
  if (!parsed) return { generated: false, reason: 'Gemini çıktısı beklenen JSON şemasına uymadı' };

  // İki içerik worker'ı (:13 ve :23) üretim sürerken aynı konuyu seçmiş olabilir — geç kalan
  // taraf yayınlanmış içeriğin üzerine yazmasın.
  const { count: existingContentCount } = await supabase
    .from('topic_contents')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', eligible.topic_id);
  if (existingContentCount) {
    return { generated: false, reason: `Konu ${eligible.topic_id} bu sırada diğer worker tarafından üretildi, atlandı` };
  }

  const { data: draftRow, error: insertError } = await supabase
    .from('topic_section_content_drafts')
    .insert({
      topic_id: eligible.topic_id,
      unit_id: eligible.unit_id,
      lesson_id: eligible.lesson_id,
      grade_id: eligible.grade_id,
      // Modelin kendi bildirdiği ai_model alanına güvenilmiyor — denemede Gemini'ye
      // Claude'un adını yazdırdığını gördük (şablondaki örnek değeri papağan gibi
      // tekrarlamış), bu yüzden burayı sabit ve doğru veriyoruz.
      ai_model: profile.label,
      cover: parsed.cover,
      sections: parsed.sections,
      summary_markdown: parsed.summary_markdown,
      discussion_prompt_markdown: parsed.discussion_prompt_markdown,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !draftRow) return { generated: false, reason: `Taslak kaydedilemedi: ${insertError?.message}` };

  const draftId = (draftRow as { id: number }).id;

  // Taslak kaydedildikten hemen sonra otomatik yayınla — admin panelindeki "AI İçerik
  // Taslakları" listesi artık bir onay kuyruğu değil, sadece yayınlanan/başarısız olan
  // taslakların geçmişi. Yayınlama başarısız olursa taslağı 'pending' bırakıyoruz ki admin
  // panelde görünüp elle onaylanabilsin (best-effort otomasyon, sessizce kaybolmasın).
  const publishResult = await publishTopicContent(supabase, {
    topicId: eligible.topic_id,
    sections: parsed.sections,
    cover: parsed.cover,
    ai_model: profile.label,
    summary_markdown: parsed.summary_markdown,
    discussion_prompt_markdown: parsed.discussion_prompt_markdown,
  });

  if (!publishResult.ok) {
    return {
      generated: true,
      draftId,
      topicId: eligible.topic_id,
      reason: `Taslak üretildi ama otomatik yayınlanamadı, admin onayı bekliyor: ${publishResult.error}`,
    };
  }

  await supabase
    .from('topic_section_content_drafts')
    .update({ status: 'saved', reviewed_at: new Date().toISOString() })
    .eq('id', draftId);

  return { generated: true, draftId, topicId: eligible.topic_id };
}
