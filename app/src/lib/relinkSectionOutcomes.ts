// Bir konunun alt başlıklarını (topic_content_sections) kazanımlarla yeniden eşleştirir —
// içerik üretilirken AI'ın döndürdüğü kazanım kodları eşleşmeyip bölümler kazanımsız kaldıysa
// (bkz. outcomeCodes.buildOutcomeKeys'teki 2026-09-27 notu: iki öğrenme çıktılı konularda
// AI "F.5.2.1.1" gibi kod uyduruyordu) onarım için. İçeriğe DOKUNMAZ, sadece
// topic_content_section_outcomes bağlantılarını kurar; soru worker'ı bu bağlantılar olmadan
// o bölümlere soru üretmiyor.
//
// Eşleştirmeyi yeniden AI yapıyor (bölüm başlığı + metni ↔ benzersiz kodlu kazanım listesi);
// eski taslaktaki uydurma kodlardan geri çıkarım YAPILMIYOR — tahminle yanlış kazanıma bağlanan
// bölüm, yanlış kazanıma soru üretilmesi demek.
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateJsonCompletion } from '@/app/src/lib/rag/gemini';
import { attachLearningOutcomeCodes, buildOutcomeKeys, resolveOutcomeCode, sortOutcomesByWeek } from '@/app/src/lib/outcomeCodes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

const SECTION_TEXT_LIMIT = 1500;

export interface RelinkResult {
  topicId: number;
  status: 'linked' | 'skipped' | 'failed';
  reason?: string;
  linkCount?: number;
  unresolvedCodes?: string[];
  // Hiçbir bölüme bağlanamayan kazanımlar (bilgi amaçlı — içerik o kazanımı işlemiyor olabilir).
  uncoveredOutcomeKeys?: string[];
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced ? fenced[1] : raw).trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Gemini yoğunlukta geçici 503 döndürüyor (bkz. diğer worker'lardaki 503 notları) — kısa
// beklemeyle yeniden dene; diğer hatalar hemen yukarı çıkar.
async function withRetryOn503<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const is503 = e instanceof Error && e.message.includes('(503)');
      if (!is503 || i >= attempts) throw e;
      await new Promise((r) => setTimeout(r, 4000 * i));
    }
  }
}

// Konunun bölümlerinden HİÇBİRİ kazanıma bağlı değilse ve konunun güncel kazanımları varsa true.
export async function topicNeedsOutcomeRelink(supabase: Supabase, topicId: number): Promise<boolean> {
  const { data: contents } = await supabase.from('topic_contents').select('id').eq('topic_id', topicId);
  const contentIds = ((contents as { id: number }[] | null) || []).map((c) => c.id);
  if (!contentIds.length) return false;
  const { data: sections } = await supabase.from('topic_content_sections').select('id').in('topic_content_id', contentIds);
  const sectionIds = ((sections as { id: number }[] | null) || []).map((s) => s.id);
  if (!sectionIds.length) return false;
  const [{ count: linkCount }, { count: outcomeCount }] = await Promise.all([
    supabase.from('topic_content_section_outcomes').select('section_id', { count: 'exact', head: true }).in('section_id', sectionIds),
    supabase.from('outcomes').select('id', { count: 'exact', head: true }).eq('topic_id', topicId).eq('is_current', true),
  ]);
  return (linkCount ?? 0) === 0 && (outcomeCount ?? 0) > 0;
}

export async function relinkSectionOutcomes(supabase: Supabase, topicId: number, options: { force?: boolean } = {}): Promise<RelinkResult> {
  if (!options.force && !(await topicNeedsOutcomeRelink(supabase, topicId))) {
    return { topicId, status: 'skipped', reason: 'Bölümler zaten kazanıma bağlı (ya da içerik/kazanım yok)' };
  }

  const { data: topic } = await supabase.from('topics').select('id, title').eq('id', topicId).maybeSingle();
  const { data: contents } = await supabase
    .from('topic_contents')
    .select('id')
    .eq('topic_id', topicId)
    .order('is_published', { ascending: false })
    .order('version_no', { ascending: false })
    .limit(1);
  const contentId = (contents as { id: number }[] | null)?.[0]?.id;
  if (!topic || !contentId) return { topicId, status: 'failed', reason: 'Konu ya da içerik bulunamadı' };

  const { data: sectionRows } = await supabase
    .from('topic_content_sections')
    .select('id, heading, order_no, body_markdown')
    .eq('topic_content_id', contentId)
    .order('order_no', { ascending: true });
  const sections = (sectionRows as { id: number; heading: string; order_no: number; body_markdown: string | null }[] | null) || [];
  if (!sections.length) return { topicId, status: 'failed', reason: 'Alt başlık yok' };

  const { data: outcomeRows } = await supabase
    .from('outcomes')
    .select('id, description, order_index, code, learning_outcome_id')
    .eq('topic_id', topicId)
    .eq('is_current', true);
  const outcomes = sortOutcomesByWeek(await attachLearningOutcomeCodes(supabase, (outcomeRows as { id: number; description: string; order_index: number | null; code: string | null; learning_outcome_id: number | null }[] | null) || []));
  if (!outcomes.length) return { topicId, status: 'failed', reason: 'Konunun güncel kazanımı yok' };
  const keys = buildOutcomeKeys(outcomes);

  const prompt = [
    `Aşağıda "${(topic as { title: string }).title}" konusunun ders notu alt başlıkları ve konunun kazanımları var.`,
    'Görevin: her alt başlığın metninde GERÇEKTEN işlenen kazanımları eşleştirmek.',
    'Kurallar:',
    '- Kodları kazanım listesinde ")" işaretinden önce yazdığı gibi AYNEN kopyala; yeni kod üretme, numaralandırma, kısaltma.',
    '- Bir alt başlık birden fazla kazanımı işleyebilir. Her kazanım en az bir alt başlıkta geçmeli.',
    '- Süreç/beceri kazanımlarını ("araştırır", "değerlendirir" gibi) içerikçe en yakın alt başlığa ekle.',
    'Sadece şu JSON\'u döndür, başka hiçbir şey yazma:',
    '{"sections":[{"section_id":<sayı>,"codes":["<kod>", ...]}]}',
    '',
    'KAZANIMLAR:',
    ...outcomes.map((o) => `${keys.get(o.id)}) ${o.description}`),
    '',
    'ALT BAŞLIKLAR:',
    ...sections.map((s) => `### section_id=${s.id} — ${s.heading}\n${(s.body_markdown || '').slice(0, SECTION_TEXT_LIMIT)}`),
  ].join('\n');

  let parsed: unknown;
  try {
    parsed = extractJson(await withRetryOn503(() => generateJsonCompletion(prompt)));
  } catch (e) {
    return { topicId, status: 'failed', reason: `Gemini çağrısı başarısız: ${e instanceof Error ? e.message : String(e)}` };
  }
  const mapped = (parsed as { sections?: { section_id?: unknown; codes?: unknown }[] } | null)?.sections;
  if (!Array.isArray(mapped)) return { topicId, status: 'failed', reason: 'Gemini çıktısı beklenen JSON şemasına uymadı' };

  const sectionIds = new Set(sections.map((s) => s.id));
  const unresolved = new Set<string>();
  const linkKeys = new Set<string>();
  const links: { section_id: number; outcome_id: number }[] = [];
  for (const entry of mapped) {
    const sectionId = Number(entry.section_id);
    if (!sectionIds.has(sectionId) || !Array.isArray(entry.codes)) continue;
    for (const code of entry.codes) {
      if (typeof code !== 'string') continue;
      const outcomeId = resolveOutcomeCode(code, outcomes, keys);
      if (outcomeId == null) {
        unresolved.add(code);
        continue;
      }
      const k = `${sectionId}:${outcomeId}`;
      if (!linkKeys.has(k)) {
        linkKeys.add(k);
        links.push({ section_id: sectionId, outcome_id: outcomeId });
      }
    }
  }
  if (!links.length) return { topicId, status: 'failed', reason: 'Hiçbir kazanım eşleşmedi', unresolvedCodes: [...unresolved] };

  // force ile çalıştırıldıysa eski bağlantılar bu içeriğin bölümleri için yenileriyle değiştirilir.
  if (options.force) await supabase.from('topic_content_section_outcomes').delete().in('section_id', [...sectionIds]);
  const { error } = await supabase.from('topic_content_section_outcomes').insert(links);
  if (error) return { topicId, status: 'failed', reason: `Bağlantılar kaydedilemedi: ${error.message}` };

  const covered = new Set(links.map((l) => l.outcome_id));
  return {
    topicId,
    status: 'linked',
    linkCount: links.length,
    unresolvedCodes: [...unresolved],
    uncoveredOutcomeKeys: outcomes.filter((o) => !covered.has(o.id)).map((o) => keys.get(o.id) || String(o.id)),
  };
}

// İçeriği olup HİÇBİR bölümü kazanıma bağlı olmayan konular.
export async function findTopicsNeedingOutcomeRelink(supabase: Supabase): Promise<number[]> {
  const { data: contents } = await supabase.from('topic_contents').select('topic_id');
  const topicIds = [...new Set(((contents as { topic_id: number }[] | null) || []).map((c) => c.topic_id))];
  const result: number[] = [];
  for (const id of topicIds) if (await topicNeedsOutcomeRelink(supabase, id)) result.push(id);
  return result;
}
