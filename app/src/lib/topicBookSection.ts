// app/src/lib/topicBookSection.ts
// Ünitenin (temanın) RAG kitap metninden yalnız bir konuya ait bölümü çıkarır. Türkçe'de NotebookLM
// metni konu konu yazdırılıyor (bkz. app/prompt/13-rag-unit-text-turkce.md): her konu
// "<Konu adı> konusunda kitapta şu bilgiler yer alır:" ile başlıyor, sonda "Listede olmayan diğer
// bilgiler:" ve "Tema metinleri:" paragrafları var. Konunun bölümünü + bu iki genel paragrafı
// vermek, modelin başka konudan kural taşımasını önlüyor ve prompt'u ~%40 kısaltıyor
// (2026-10-03). Başlık bulunamazsa (NotebookLM konuyu atlamış/başka adla yazmışsa) tam metne düşülür.
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

const TOPIC_MARKER = ' konusunda kitapta şu bilgiler yer alır:';
const GENERAL_MARKERS = ['Listede olmayan diğer bilgiler:', 'Tema metinleri:'];

// Chunk'lar değil ham metin: chunk sınırı bir konu başlığını ikiye bölerse eşleşme kaçardı.
export async function fetchUnitBookRawText(supabase: Supabase, unitId: number): Promise<string | null> {
  const { data } = await supabase.from('rag_documents').select('raw_text').eq('unit_id', unitId).order('id', { ascending: true });
  const text = ((data as { raw_text: string | null }[] | null) || []).map((d) => d.raw_text || '').filter(Boolean).join('\n\n');
  return text.trim() ? text : null;
}

export function extractTopicBookSection(fullText: string, topicTitle: string): { text: string; matched: boolean } {
  const start = fullText.indexOf(`${topicTitle}${TOPIC_MARKER}`);
  if (start < 0) return { text: fullText, matched: false };

  // Bölümün sonu: sonraki konu başlığı ya da genel paragraflardan ilki.
  const afterStart = start + topicTitle.length + TOPIC_MARKER.length;
  const ends = [fullText.indexOf(TOPIC_MARKER, afterStart), ...GENERAL_MARKERS.map((m) => fullText.indexOf(m, afterStart))].filter((i) => i >= 0);
  let end = ends.length ? Math.min(...ends) : fullText.length;
  // Sonraki konu başlığının adı, işaretten önceki satır/cümle başına kadar geri alınır.
  if (end === fullText.indexOf(TOPIC_MARKER, afterStart)) {
    const boundary = Math.max(fullText.lastIndexOf('\n', end), fullText.lastIndexOf('. ', end) + 1);
    if (boundary > afterStart) end = boundary;
  }

  const general = GENERAL_MARKERS.map((m) => {
    const i = fullText.indexOf(m);
    if (i < 0) return '';
    const next = GENERAL_MARKERS.map((o) => (o === m ? -1 : fullText.indexOf(o, i + m.length))).filter((x) => x > i);
    return fullText.slice(i, next.length ? Math.min(...next) : fullText.length).trim();
  }).filter(Boolean);

  return { text: [fullText.slice(start, end).trim(), ...general].join('\n\n'), matched: true };
}
