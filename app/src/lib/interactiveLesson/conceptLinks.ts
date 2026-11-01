// Kavram kartlarına OTOMATİK bağlantı: metinde (çözüm açıklaması, örnek cevap, geri bildirim) konunun kavram
// adlarını bulur. Veritabanındaki binlerce mevcut soruya işaret eklemeden geriye dönük çalışır.
// Kurallar: kelime başında eşleşir, Türkçe ekleri ve kesme işaretli ekleri kapsar ("Dünya'nın", "gök taşları");
// her kavram bir metinde yalnız İLK geçtiği yerde bağlanır (gürültü olmasın); uzun adlar önce denenir
// ("karasal gezegenler" > "gezegen"). Soru kökünde ve şıklarda KULLANILMAZ (cevabı ele verir) — çağıran seçer.
import type { LessonTerm } from './types';

export type ConceptSegment = { text: string; term?: string };

const LETTER = /[\p{L}\p{N}]/u;
const WORD_TAIL = /[\p{L}\p{N}'’]/u;
const lower = (s: string) => s.toLocaleLowerCase('tr-TR');

// Tamlama eki çoğulda düşer: "gök taşı" → "gök taşları"; çok kelimeli adlarda son ünlüyü atan kök de denenir.
function variants(name: string): string[] {
  return name.includes(' ') && /[ıiuü]$/.test(name) && name.length > 6 ? [name, name.slice(0, -1)] : [name];
}

export function linkConcepts(text: string, terms: Record<string, LessonTerm>, exclude: ReadonlySet<string> = new Set()): ConceptSegment[] {
  const needles = Object.entries(terms)
    .filter(([id]) => !exclude.has(id))
    .flatMap(([id, t]) => [t.title, ...(t.aliases ?? [])].flatMap((name) => variants(lower(name.trim())).map((needle) => ({ id, needle }))))
    .filter((n) => n.needle.length >= 3)
    .sort((a, b) => b.needle.length - a.needle.length);
  if (!needles.length) return [{ text }];

  const low = lower(text);
  // tr-TR küçük harfe çevirme Türkçe metinde uzunluğu korur; korumazsa (nadir karakterler) bağlantı yapma.
  if (low.length !== text.length) return [{ text }];

  const out: ConceptSegment[] = [];
  const used = new Set<string>();
  let plain = '';
  let i = 0;
  while (i < text.length) {
    const wordStart = i === 0 || !LETTER.test(text[i - 1]);
    const hit = wordStart ? needles.find((n) => !used.has(n.id) && low.startsWith(n.needle, i)) : undefined;
    if (!hit) {
      plain += text[i];
      i += 1;
      continue;
    }
    let end = i + hit.needle.length;
    while (end < text.length && WORD_TAIL.test(text[end])) end += 1;
    if (plain) out.push({ text: plain });
    plain = '';
    out.push({ text: text.slice(i, end), term: hit.id });
    used.add(hit.id);
    i = end;
  }
  if (plain) out.push({ text: plain });
  return out;
}

// Metinde geçen kavramlar (sırasıyla) — örnek cevabın altındaki "görsel açıklama" şeridi için.
export function conceptsIn(text: string, terms: Record<string, LessonTerm>, exclude?: ReadonlySet<string>): string[] {
  return linkConcepts(text, terms, exclude).flatMap((s) => (s.term ? [s.term] : []));
}
