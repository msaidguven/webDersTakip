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
import { buildSvgLessonGuidance, buildMathNotationGuidance } from '@/app/src/lib/promptHelpers';
import { generateQuestionsJson } from '@/app/src/lib/geminiQuestionGen';
import { prettyModelName } from '@/app/src/lib/geminiWorkerProfile';
import { QUESTION_WORKER_PROFILES, type QuestionWorkerProfile } from '@/app/src/lib/questionWorkerProfiles';
import { parseQuestions } from '@/app/src/lib/parseMixedQuestions';
import { extractTopicBookSection, fetchTopicContentGoals, fetchUnitBookRawText, formatContentGoals } from '@/app/src/lib/topicBookSection';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

// Worker saatte bir çalıştığı için tek bir geçici ağ/gateway hatası (Vercel<->Supabase
// arası "Gateway Timeout" gibi) bütün bir saati boşa harcıyordu — aynı alt başlık bir
// sonraki saate kadar hiç denenmiyordu (kullanıcının 2026-09-10 "hep aynı ünite" şikayeti;
// aslında ünite ilerliyordu ama kalan alt başlıklarda üst üste şansızlık yaşanıyordu).
// Supabase sorgularını burada 2 kez, kısa bir bekleyişle tekrar deniyoruz ki geçici bir
// blip yüzünden koca bir saat kaybedilmesin.
async function withRetry<T extends { error: { message: string } | null }>(
  fn: () => PromiseLike<T>,
  attempts = 3
): Promise<T> {
  let last: T | null = null;
  for (let i = 0; i < attempts; i++) {
    last = await fn();
    if (!last.error) return last;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  return last as T;
}

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
  // Bu alt başlığın kaçıncı turu (0 = ilk) — bkz. ai_question_draft_rounds.sql.
  round_no: number;
};

export interface DraftGenerationResult {
  generated: boolean;
  reason?: string;
  draftId?: number;
  sectionId?: number;
  // Yalnız dryRun'da dolu: Gemini'ye gidecek tam prompt.
  prompt?: string;
  // İki aşamalı derslerde (Türkçe) doğrulama geçişinin yaptığı düzeltmeler.
  reviewCorrections?: { question: string; issue: string; fix: string }[];
}

// Derse özel soru şablonu (ders slug'ı → app/prompt dosyaları). Türkçe'de sorular yazım/noktalama/
// dil bilgisi ve anlam bilgisi soruları; tek doğru cevaplı yazmak zor (çeldirici şıkta gözden kaçan
// bir yazım hatası soruyu iki cevaplı yapar) — bu yüzden ikinci bir çağrı soruları kitap + TDK'ye
// göre çözüp denetler (kullanıcının 2026-10-03 onayı). Doğrulama başarısızsa taslak kaydedilmez.
const LESSON_QUESTION_TEMPLATES: Record<string, { questions: string; review: string }> = {
  turkce: { questions: '35-turkce-section-questions.md', review: '36-turkce-questions-review.md' },
};

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

// 2. turdan itibaren (kullanıcının 2026-10-02 isteği) AI'ya alt başlığın mevcut soruları verilir
// ki aynı bilgiyi farklı kelimelerle tekrar sormasın. Soru yoksa blok boş kalır — ilk tur
// prompt'u değişmez.
const EXISTING_QUESTIONS_LIMIT = 40;
const EXISTING_QUESTION_MAX_CHARS = 220;

async function buildExistingQuestionsText(supabase: Supabase, sectionId: number): Promise<string> {
  const { data } = await withRetry(() =>
    supabase.from('questions').select('question_text').eq('section_id', sectionId).order('id', { ascending: true }).limit(EXISTING_QUESTIONS_LIMIT)
  );
  const texts = ((data as { question_text: string | null }[] | null) || [])
    .map((q) => (q.question_text || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!texts.length) return '';
  const list = texts
    .map((t, i) => `${i + 1}. ${t.length > EXISTING_QUESTION_MAX_CHARS ? `${t.slice(0, EXISTING_QUESTION_MAX_CHARS)}…` : t}`)
    .join('\n');
  return `
Bu alt başlık için soru bankasında ZATEN şu ${texts.length} soru var. Bunları ve aynı bilgiyi farklı kelimelerle soran varyasyonlarını TEKRAR ÜRETME. Kitapta bu alt başlıkla ilgili henüz sorulmamış bilgilere, eksik kalan kazanımlara ve farklı zorluk düzeylerine odaklan. Sorulmamış yeterli bilgi kalmadıysa yukarıdaki 3-7 aralığının altına inebilirsin (en az 2 soru); tekrar eden soru üretmektense az soru üretmek daha iyidir.
Mevcut sorular:
${list}
`;
}

async function buildSectionOutcomesText(supabase: Supabase, topicId: number, sectionId: number): Promise<string> {
  const { data: outcomesData } = await supabase
    .from('outcomes')
    .select('id, description, order_index, code')
    .eq('topic_id', topicId)
    .eq('is_current', true)
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
  const { data: docs, error: docsError } = await withRetry(() => supabase.from('rag_documents').select('id').eq('unit_id', unitId));
  if (docsError) throw new Error(`rag_documents sorgusu başarısız: ${docsError.message}`);
  const documentIds = ((docs as { id: number }[] | null) || []).map((d) => d.id);
  if (!documentIds.length) return null;

  const { data: chunks, error: chunksError } = await withRetry(() =>
    supabase
      .from('rag_document_chunks')
      .select('document_id, chunk_index, content')
      .in('document_id', documentIds)
      .order('document_id', { ascending: true })
      .order('chunk_index', { ascending: true })
  );
  if (chunksError) throw new Error(`rag_document_chunks sorgusu başarısız: ${chunksError.message}`);
  const chunkRows = (chunks as { document_id: number; chunk_index: number; content: string }[] | null) || [];
  if (!chunkRows.length) return null;

  return chunkRows.map((c) => c.content).join('\n\n');
}

// Bir sonraki uygun alt başlık için taslak üretir, ai_question_drafts'a 'pending' olarak
// kaydeder. Uygun alt başlık yoksa veya üretim/doğrulama başarısız olursa generated:false
// döner — çağıran (cron endpoint'i) bunu sessizce no-op olarak ele alır.
export async function generateNextAiQuestionDraft(
  supabase: Supabase,
  profile: QuestionWorkerProfile = QUESTION_WORKER_PROFILES.primary
): Promise<DraftGenerationResult> {
  const { data: eligibleRows, error: eligibleError } = await withRetry(() => supabase.rpc('find_next_ai_question_draft_section'));
  if (eligibleError) return { generated: false, reason: `Uygun alt başlık sorgusu başarısız: ${eligibleError.message}` };

  const eligible = (eligibleRows as EligibleSectionRow[] | null)?.[0];
  if (!eligible) return { generated: false, reason: 'Uygun alt başlık yok (kitabı yüklü, sorusuz, kazanımı olan bir alt başlık bulunamadı)' };

  return generateQuestionDraftForSection(supabase, eligible, profile);
}

// Tek bir alt başlığa elle soru taslağı üretmek için (scripts/generate-section-questions.ts) —
// worker'ın uygunluk sorgusunu atlar (ör. ders henüz kapalıyken yeni bir dersin şablonunu denemek).
// Taslak worker'daki gibi 'pending' kaydedilir; admin panelinden onaylanır.
export async function generateQuestionDraftForSectionId(
  supabase: Supabase,
  sectionId: number,
  profile: QuestionWorkerProfile,
  opts: { dryRun?: boolean } = {}
): Promise<DraftGenerationResult> {
  const { data } = await supabase
    .from('topic_content_sections')
    .select('id, heading, topic_contents!inner(topic_id, topics!inner(id, title, unit_id, units!inner(id, title, lesson_id, grade_id, lessons!inner(name), grades!inner(name))))')
    .eq('id', sectionId)
    .maybeSingle();
  const one = <T,>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v);
  type Row = { id: number; heading: string; topic_contents: { topics: { id: number; title: string; unit_id: number; units: { id: number; title: string; lesson_id: number; grade_id: number; lessons: { name: string }; grades: { name: string } } } } };
  const row = data as unknown as Row | null;
  if (!row) return { generated: false, reason: `Alt başlık ${sectionId} bulunamadı` };
  const topic = one(one(row.topic_contents).topics);
  const unit = one(topic.units);
  return generateQuestionDraftForSection(
    supabase,
    {
      section_id: row.id,
      topic_id: topic.id,
      unit_id: unit.id,
      lesson_id: unit.lesson_id,
      grade_id: unit.grade_id,
      grade_name: one(unit.grades).name,
      lesson_name: one(unit.lessons).name,
      unit_title: unit.title,
      topic_title: topic.title,
      section_heading: row.heading,
      round_no: 0,
    },
    profile,
    opts
  );
}

async function generateQuestionDraftForSection(
  supabase: Supabase,
  eligible: EligibleSectionRow,
  profile: QuestionWorkerProfile,
  opts: { dryRun?: boolean } = {}
): Promise<DraftGenerationResult> {
  const { data: lessonRow } = await supabase.from('lessons').select('slug').eq('id', eligible.lesson_id).maybeSingle();
  const lessonTemplate = LESSON_QUESTION_TEMPLATES[(lessonRow as { slug: string | null } | null)?.slug ?? ''];

  let bookContent: string | null;
  try {
    // Türkçe: temanın metninden yalnız bu konunun bölümü (bkz. topicBookSection.ts).
    const rawBook = lessonTemplate ? await fetchUnitBookRawText(supabase, eligible.unit_id) : null;
    bookContent = rawBook ? extractTopicBookSection(rawBook, eligible.topic_title).text : await fetchUnitBookContent(supabase, eligible.unit_id);
  } catch (e) {
    return { generated: false, reason: `Ünite ${eligible.unit_id} kitap içeriği sorgusu hata verdi: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!bookContent) return { generated: false, reason: `Ünite ${eligible.unit_id} için RAG kitap içeriği bulunamadı (belge/chunk yok)` };

  const [sectionOutcomesText, otherHeadingsText, existingQuestionsText] = await Promise.all([
    buildSectionOutcomesText(supabase, eligible.topic_id, eligible.section_id),
    buildOtherHeadingsText(supabase, eligible.section_id),
    buildExistingQuestionsText(supabase, eligible.section_id),
  ]);

  const topicGoalsText = lessonTemplate ? formatContentGoals(await fetchTopicContentGoals(supabase, eligible.topic_id)) : '';

  const svgQuestionInstructions = await readFile(path.join(process.cwd(), 'app', 'prompt', '_svg-question-fragment.md'), 'utf8');
  const svgBlock = svgQuestionInstructions.replaceAll('{svg_lesson_guidance}', buildSvgLessonGuidance(eligible.lesson_name));

  const promptDir = path.join(process.cwd(), 'app', 'prompt');
  const template = await readFile(path.join(promptDir, lessonTemplate?.questions ?? '17-section-questions-rag.md'), 'utf8');
  const prompt = template
    .replaceAll('{grade}', eligible.grade_name)
    .replaceAll('{lesson}', eligible.lesson_name)
    .replaceAll('{unit}', eligible.unit_title)
    .replaceAll('{topic}', eligible.topic_title)
    .replaceAll('{heading}', eligible.section_heading)
    .replaceAll('{section_outcomes}', sectionOutcomesText)
    .replaceAll('{topic_goals}', topicGoalsText)
    .replaceAll('{other_headings}', otherHeadingsText)
    .replaceAll('{existing_questions}', existingQuestionsText)
    .replaceAll('{book_content}', bookContent)
    .replaceAll('{math_notation_guidance}', buildMathNotationGuidance(eligible.lesson_name))
    .replaceAll('{svg_question_instructions}', svgBlock);

  if (opts.dryRun) return { generated: false, reason: 'dry-run', sectionId: eligible.section_id, prompt };

  let raw: unknown;
  let usedModel: string;
  try {
    ({ data: raw, model: usedModel } = await generateQuestionsJson(prompt, profile));
  } catch (e) {
    return { generated: false, reason: `Gemini çağrısı başarısız: ${e instanceof Error ? e.message : String(e)}` };
  }

  let parsed = parseQuestions(raw, 7);
  if (!parsed) return { generated: false, reason: 'Gemini çıktısı beklenen JSON şemasına uymadı' };

  let reviewCorrections: DraftGenerationResult['reviewCorrections'];
  if (lessonTemplate) {
    const reviewTemplate = await readFile(path.join(promptDir, lessonTemplate.review), 'utf8');
    const reviewPrompt = reviewTemplate
      .replaceAll('{grade}', eligible.grade_name)
      .replaceAll('{lesson}', eligible.lesson_name)
      .replaceAll('{unit}', eligible.unit_title)
      .replaceAll('{topic}', eligible.topic_title)
      .replaceAll('{heading}', eligible.section_heading)
      .replaceAll('{section_outcomes}', sectionOutcomesText)
      .replaceAll('{topic_goals}', topicGoalsText)
      .replaceAll('{book_content}', bookContent)
      .replaceAll('{draft_json}', JSON.stringify((raw as { questions: unknown[] }).questions, null, 1));
    let reviewRaw: unknown;
    try {
      ({ data: reviewRaw } = await generateQuestionsJson(reviewPrompt, profile));
    } catch (e) {
      return { generated: false, reason: `Doğrulama çağrısı başarısız, taslak kaydedilmedi: ${e instanceof Error ? e.message : String(e)}` };
    }
    const reviewed = parseQuestions(reviewRaw, 7);
    if (!reviewed) return { generated: false, reason: 'Doğrulama çıktısı beklenen JSON şemasına uymadı (ya da tüm sorular elendi), taslak kaydedilmedi' };
    parsed = reviewed;
    raw = reviewRaw;
    const corrections = (reviewRaw as { corrections?: unknown }).corrections;
    reviewCorrections = Array.isArray(corrections)
      ? corrections
          .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
          .map((c) => ({ question: String(c.question ?? ''), issue: String(c.issue ?? ''), fix: String(c.fix ?? '') }))
      : [];
  }

  // Modelin JSON'da kendini beyan ettiği ai_model değil, cevabı gerçekten veren model
  // (503 yedeği devreye girmiş olabilir) — worker istatistikleri buna dayanıyor.
  const aiModel = prettyModelName(usedModel);
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

  // Aynı dakikada başka bir soru worker'ı aynı alt başlığı seçip önce kaydettiyse
  // uq_ai_question_drafts_one_pending_per_section ihlali — çift taslak yerine sessizce çık.
  if (insertError?.code === '23505') {
    return { generated: false, reason: `Alt başlık ${eligible.section_id} için başka bir worker taslak üretti (çakışma)` };
  }
  if (insertError || !draftRow) return { generated: false, reason: `Taslak kaydedilemedi: ${insertError?.message}` };

  return { generated: true, draftId: (draftRow as { id: number }).id, sectionId: eligible.section_id, reviewCorrections };
}
