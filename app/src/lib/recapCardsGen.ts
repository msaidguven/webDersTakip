import { readFile } from 'fs/promises';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateTopicContentJson } from '@/app/src/lib/geminiContentGen';
import type { ContentWorkerProfile } from '@/app/src/lib/contentWorkerProfiles';
import { fetchUnitBookContent } from '@/app/src/lib/aiContentDraftGen';
import { extractTopicBookSection, fetchUnitBookRawText } from '@/app/src/lib/topicBookSection';
import { normalizeRecapCard, type RecapCard } from '@/app/src/lib/recapCards';
import { buildRecapCardRules } from '@/app/src/lib/recapCardRules';
import { getCurriculumCalendar } from '@/app/src/lib/curriculumCalendar';
import { getCurrentCurriculumWeek } from '@/app/src/lib/routeParsing';

// Yayındaki bir konunun alt başlıklarına hap bilgi kartı üretir (2026-10-24 pilot, bkz. app/prompt/40-section-recap-cards.md).
// Konuyu yeniden üretmez: bölüm satırları (id → soru/görsel bağları) aynen kalır, yalnız recap_card yazılır.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

export interface RecapCardsResult {
  ok: boolean;
  reason?: string;
  prompt?: string;
  cards?: { sectionId: number; heading: string; card: RecapCard }[];
}

type SectionRow = { id: number; order_no: number; heading: string; body_markdown: string | null; review_summary: string | null };

export async function generateRecapCardsForTopic(
  supabase: Supabase,
  topicId: number,
  profile: ContentWorkerProfile,
  opts: { dryRun?: boolean; save?: boolean } = {}
): Promise<RecapCardsResult> {
  const { data: topic } = await supabase
    .from('topics')
    .select('id, title, unit_id, units!inner(title, lessons!inner(name, slug), grades!inner(name))')
    .eq('id', topicId)
    .maybeSingle();
  if (!topic) return { ok: false, reason: `Konu ${topicId} bulunamadı` };
  const one = <T,>(v: T | T[]) => (Array.isArray(v) ? v[0] : v);
  const unit = one(topic.units as { title: string; lessons: unknown; grades: unknown } | { title: string; lessons: unknown; grades: unknown }[]);
  const lesson = one(unit.lessons as { name: string; slug: string | null } | { name: string; slug: string | null }[]);
  const grade = one(unit.grades as { name: string } | { name: string }[]);

  const { data: content } = await supabase.from('topic_contents').select('id').eq('topic_id', topicId).maybeSingle();
  if (!content) return { ok: false, reason: `Konu ${topicId} için yayında içerik yok` };
  const { data: sectionRows } = await supabase
    .from('topic_content_sections')
    .select('id, order_no, heading, body_markdown, review_summary')
    .eq('topic_content_id', (content as { id: number }).id)
    .order('order_no', { ascending: true });
  const sections = ((sectionRows as SectionRow[] | null) || []).filter((s) => s.body_markdown?.trim());
  if (!sections.length) return { ok: false, reason: `Konu ${topicId} için anlatımı olan alt başlık yok` };

  const { data: outcomeRows } = await supabase
    .from('outcomes')
    .select('description, order_index')
    .eq('topic_id', topicId)
    .eq('is_current', true)
    .order('order_index', { ascending: true });
  const outcomesText = ((outcomeRows as { description: string }[] | null) || []).map((o) => `- ${o.description}`).join('\n') || 'Tanımlı kazanım yok.';

  const bookText = (await fetchUnitBookRawText(supabase, topic.unit_id)) || (await fetchUnitBookContent(supabase, topic.unit_id)) || '';
  const bookBlock = bookText
    ? `Ders kitabı (ünitenin tamamı olabilir — yalnız "${topic.title}" konusuyla ilgili kısmı kullan):\n${extractTopicBookSection(bookText, topic.title).text}`
    : 'Bu ünite için ders kitabı yüklenmemiş — yalnız alt başlıkların anlatım metnini kaynak al.';

  const sectionsJson = JSON.stringify(
    sections.map((s) => ({ order_no: s.order_no, heading: s.heading, explanation_markdown: s.body_markdown, review_summary: s.review_summary })),
    null,
    1
  );
  const [template, recapRules] = await Promise.all([
    readFile(path.join(process.cwd(), 'app', 'prompt', '40-section-recap-cards.md'), 'utf8'),
    buildRecapCardRules(lesson.slug, grade.name),
  ]);
  const prompt = template
    .replaceAll('{recap_card_rules}', recapRules)
    .replaceAll('{grade}', grade.name)
    .replaceAll('{lesson}', lesson.name)
    .replaceAll('{unit}', unit.title)
    .replaceAll('{topic}', topic.title)
    .replaceAll('{outcomes}', outcomesText)
    .replaceAll('{sections_json}', sectionsJson)
    .replaceAll('{book_content_block}', bookBlock);
  if (opts.dryRun) return { ok: true, reason: 'dry-run', prompt };

  let raw: unknown;
  try {
    ({ data: raw } = await generateTopicContentJson(prompt, profile));
  } catch (e) {
    return { ok: false, reason: `Gemini çağrısı başarısız: ${e instanceof Error ? e.message : String(e)}` };
  }
  const rawCards = raw && typeof raw === 'object' && Array.isArray((raw as { cards?: unknown }).cards) ? ((raw as { cards: unknown[] }).cards) : [];
  const byOrder = new Map<number, RecapCard>();
  for (const c of rawCards) {
    const order = c && typeof c === 'object' ? (c as { order_no?: unknown }).order_no : null;
    const card = normalizeRecapCard(c);
    if (typeof order === 'number' && card) byOrder.set(order, card);
  }
  // Hepsi ya da hiçbiri: yarım kartlı konu, kartlı/kartsız bölümleri karışık gösterirdi.
  const missing = sections.filter((s) => !byOrder.has(s.order_no));
  if (missing.length) return { ok: false, reason: `Model şu alt başlıklara kart üretmedi: ${missing.map((s) => s.heading).join(', ')}` };

  const cards = sections.map((s) => ({ sectionId: s.id, heading: s.heading, card: byOrder.get(s.order_no)! }));
  if (opts.save === false) return { ok: true, cards };
  for (const c of cards) {
    const { error } = await supabase.from('topic_content_sections').update({ recap_card: c.card }).eq('id', c.sectionId);
    if (error) return { ok: false, reason: `Kart kaydedilemedi (bölüm ${c.sectionId}): ${error.message}` };
  }
  return { ok: true, cards };
}

// İçerik worker'ı boştayken (üretecek yeni konu yok) çağrılır: kartı eksik sıradaki konu (bkz.
// supabase/migrations/recap_card_worker.sql — bu hafta ve sonrası önce, 3 kez başarısız olan atlanır).
export async function generateNextRecapCards(supabase: Supabase, profile: ContentWorkerProfile): Promise<RecapCardsResult & { topicId?: number }> {
  const calendar = await getCurriculumCalendar(supabase);
  const week = getCurrentCurriculumWeek(38, calendar.termStartDate, calendar.breaks);
  const { data, error } = await supabase.rpc('find_next_recap_card_topic', { p_current_week: week });
  if (error) return { ok: false, reason: `Kart sırası sorgusu başarısız: ${error.message}` };
  const topicId = (data as { topic_id: number }[] | null)?.[0]?.topic_id;
  if (!topicId) return { ok: false, reason: 'Kartı eksik konu yok' };
  const result = await generateRecapCardsForTopic(supabase, topicId, profile);
  return { ...result, cards: undefined, topicId };
}
