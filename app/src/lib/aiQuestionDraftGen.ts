// RAG kuyruğu boşken (saatte bir, Supabase pg_cron+pg_net üzerinden tetiklenen ayrı bir
// worker — bkz. supabase/migrations/pg_cron_workers.sql) kitabı yüklü ünitelerdeki, hiç
// sorusu olmayan alt başlıklar için AI ile taslak soru üretimi (kullanıcının 2026-09-08 isteği).
// Kullanılan prompt, admin panelindeki "Soru Ekle (NotebookLM)" akışıyla (bkz.
// app/prompt/10-section-questions-notebooklm.md) AYNI kurallar/JSON şeması — tek fark,
// NotebookLM'in kendi yüklü kaynağına güvenmek yerine, o ünitenin RAG'a yüklenmiş kitap
// içeriğini (rag_document_chunks) doğrudan prompta gömüyoruz (bkz. 17-section-questions-rag.md).
import { readFile } from 'fs/promises';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sortOutcomesByWeek } from '@/app/src/lib/outcomeCodes';
import { buildSvgLessonGuidance } from '@/app/src/lib/promptHelpers';
import { generateQuestionsJson } from '@/app/src/lib/geminiQuestionGen';
import { parseQuestions } from '@/app/src/lib/parseMixedQuestions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

type EligibleSectionRow = {
  section_id: number;
  topic_id: number;
  unit_id: number;
  lesson_id: number;
  grade_id: number;
  grade_name: string;
  lesson_name: string;
  unit_title: string;
  topic_title: string;
  section_heading: string;
};

export interface DraftGenerationResult {
  generated: boolean;
  reason?: string;
  draftId?: number;
  sectionId?: number;
}

// Kardeş alt başlıklarla örtüşen soru üretilmesin diye (kullanıcının 2026-09-08 bulduğu
// sorun) — manuel "Soru Ekle (NotebookLM)" akışındaki AYNI {other_headings} deseni
// (bkz. app/api/admin/topic-sections/prompt/route.ts).
async function buildOtherHeadingsText(supabase: Supabase, sectionId: number): Promise<string> {
  const { data: currentSection } = await supabase.from('topic_content_sections').select('topic_content_id').eq('id', sectionId).maybeSingle();
  const topicContentId = (currentSection as { topic_content_id: number } | null)?.topic_content_id;
  if (topicContentId == null) return 'Yok';

  const { data: siblingSections } = await supabase
    .from('topic_content_sections')
    .select('id, heading')
    .eq('topic_content_id', topicContentId)
    .order('order_no', { ascending: true });
  const others = ((siblingSections as { id: number; heading: string }[] | null) || []).filter((s) => s.id !== sectionId).map((s) => s.heading);
  return others.length ? others.join(', ') : 'Yok';
}

async function buildSectionOutcomesText(supabase: Supabase, topicId: number, sectionId: number): Promise<string> {
  const { data: outcomesData } = await supabase
    .from('outcomes')
    .select('id, description, order_index, code')
    .eq('topic_id', topicId)
    .order('order_index', { ascending: true });
  const outcomeRows = (outcomesData as { id: number; description: string; order_index: number | null; code: string | null }[] | null) || [];

  const outcomeIds = outcomeRows.map((o) => o.id);
  const weekByOutcomeId = new Map<number, number>();
  if (outcomeIds.length) {
    const { data: weeksData } = await supabase.from('outcome_weeks').select('outcome_id, start_week').in('outcome_id', outcomeIds);
    ((weeksData as { outcome_id: number; start_week: number }[] | null) || []).forEach((w) => weekByOutcomeId.set(w.outcome_id, w.start_week));
  }
  const outcomes = sortOutcomesByWeek(outcomeRows.map((o) => ({ ...o, startWeek: weekByOutcomeId.get(o.id) ?? null })));

  const { data: linksData } = await supabase.from('topic_content_section_outcomes').select('outcome_id').eq('section_id', sectionId);
  const linkedOutcomeIds = ((linksData as { outcome_id: number }[] | null) || []).map((l) => l.outcome_id);
  const matchedOutcomes = linkedOutcomeIds.length ? outcomes.filter((o) => linkedOutcomeIds.includes(o.id)) : outcomes;

  return matchedOutcomes.length ? matchedOutcomes.map((o) => `${o.code || '?'}) ${o.description}`).join('\n') : 'Bu alt başlık için tanımlı kazanım bulunamadı.';
}

// Ünitenin RAG'a yüklenmiş TÜM kitap içeriği — chunk'lar sadece document_id üzerinden
// üniteye bağlı (bkz. rag_documents.unit_id), chunk'ların kendisinde unit_id yok
// (kullanıcının 2026-09-08 sohbetinde doğrulanan gerçek şema).
//
// Sorgu hatalarını (izin/RLS, geçici bağlantı sorunu vb.) "içerik yok"tan AYRI tutmak
// için burada FIRLATIYORUZ — eskiden ikisi de sessizce null'a düşüp aynı "RAG kitap
// içeriği bulunamadı" mesajını üretiyordu, bu da 2026-09-09'da gerçek bir izin/RLS
// sorununu "içerik hiç yüklenmemiş" sanıp yanlış teşhis etmemize yol açmıştı.
async function fetchUnitBookContent(supabase: Supabase, unitId: number): Promise<string | null> {
  const { data: docs, error: docsError } = await supabase.from('rag_documents').select('id').eq('unit_id', unitId);
  if (docsError) throw new Error(`rag_documents sorgusu başarısız: ${docsError.message}`);
  const documentIds = ((docs as { id: number }[] | null) || []).map((d) => d.id);
  if (!documentIds.length) return null;

  const { data: chunks, error: chunksError } = await supabase
    .from('rag_document_chunks')
    .select('document_id, chunk_index, content')
    .in('document_id', documentIds)
    .order('document_id', { ascending: true })
    .order('chunk_index', { ascending: true });
  if (chunksError) throw new Error(`rag_document_chunks sorgusu başarısız: ${chunksError.message}`);
  const chunkRows = (chunks as { document_id: number; chunk_index: number; content: string }[] | null) || [];
  if (!chunkRows.length) return null;

  return chunkRows.map((c) => c.content).join('\n\n');
}

// Bir sonraki uygun alt başlık için taslak üretir, ai_question_drafts'a 'pending' olarak
// kaydeder. Uygun alt başlık yoksa veya üretim/doğrulama başarısız olursa generated:false
// döner — çağıran (cron endpoint'i) bunu sessizce no-op olarak ele alır.
export async function generateNextAiQuestionDraft(supabase: Supabase): Promise<DraftGenerationResult> {
  const { data: eligibleRows, error: eligibleError } = await supabase.rpc('find_next_ai_question_draft_section');
  if (eligibleError) return { generated: false, reason: `Uygun alt başlık sorgusu başarısız: ${eligibleError.message}` };

  const eligible = (eligibleRows as EligibleSectionRow[] | null)?.[0];
  if (!eligible) return { generated: false, reason: 'Uygun alt başlık yok (kitabı yüklü, sorusuz, kazanımı olan bir alt başlık bulunamadı)' };

  let bookContent: string | null;
  try {
    bookContent = await fetchUnitBookContent(supabase, eligible.unit_id);
  } catch (e) {
    return { generated: false, reason: `Ünite ${eligible.unit_id} kitap içeriği sorgusu hata verdi: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!bookContent) return { generated: false, reason: `Ünite ${eligible.unit_id} için RAG kitap içeriği bulunamadı (belge/chunk yok)` };

  const [sectionOutcomesText, otherHeadingsText] = await Promise.all([
    buildSectionOutcomesText(supabase, eligible.topic_id, eligible.section_id),
    buildOtherHeadingsText(supabase, eligible.section_id),
  ]);

  const svgQuestionInstructions = await readFile(path.join(process.cwd(), 'app', 'prompt', '_svg-question-fragment.md'), 'utf8');
  const svgBlock = svgQuestionInstructions.replaceAll('{svg_lesson_guidance}', buildSvgLessonGuidance(eligible.lesson_name));

  const template = await readFile(path.join(process.cwd(), 'app', 'prompt', '17-section-questions-rag.md'), 'utf8');
  const prompt = template
    .replaceAll('{grade}', eligible.grade_name)
    .replaceAll('{lesson}', eligible.lesson_name)
    .replaceAll('{unit}', eligible.unit_title)
    .replaceAll('{topic}', eligible.topic_title)
    .replaceAll('{heading}', eligible.section_heading)
    .replaceAll('{section_outcomes}', sectionOutcomesText)
    .replaceAll('{other_headings}', otherHeadingsText)
    .replaceAll('{book_content}', bookContent)
    .replaceAll('{svg_question_instructions}', svgBlock);

  let raw: unknown;
  try {
    raw = await generateQuestionsJson(prompt);
  } catch (e) {
    return { generated: false, reason: `Gemini çağrısı başarısız: ${e instanceof Error ? e.message : String(e)}` };
  }

  const parsed = parseQuestions(raw, 7);
  if (!parsed) return { generated: false, reason: 'Gemini çıktısı beklenen JSON şemasına uymadı' };

  const aiModel = typeof (raw as { ai_model?: unknown } | null)?.ai_model === 'string' ? (raw as { ai_model: string }).ai_model.trim() || null : 'Gemini 2.5 Flash';
  const questionsPayload = (raw as { questions: unknown[] }).questions;

  const { data: draftRow, error: insertError } = await supabase
    .from('ai_question_drafts')
    .insert({
      section_id: eligible.section_id,
      topic_id: eligible.topic_id,
      unit_id: eligible.unit_id,
      lesson_id: eligible.lesson_id,
      grade_id: eligible.grade_id,
      ai_model: aiModel,
      questions: questionsPayload,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !draftRow) return { generated: false, reason: `Taslak kaydedilemedi: ${insertError?.message}` };

  return { generated: true, draftId: (draftRow as { id: number }).id, sectionId: eligible.section_id };
}
