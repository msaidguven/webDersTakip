import { toSpeech } from './speech';

// Konu metnini (alt başlıkların body_markdown'u) sesli anlatım ekranlarına böler. Saf fonksiyon:
// AI çağrısı yok, ekranda sayfadaki metnin kendisi görünür (SEO metniyle birebir aynı içerik).
//
// Kurallar: her alt başlık bir "title" ekranıyla başlar; her cümle bir ekrandır (çok uzun cümleler
// noktalı virgülden bölünür); cümle 2-4 kelimelik gruplar halinde sesle birlikte belirir.

export type ScriptWord = { t: string; em: boolean };
export type ScriptChunk = { words: ScriptWord[]; speech: string };
export type ScriptScreen = { kind: 'title' | 'sentence'; eyebrow: string | null; chunks: ScriptChunk[]; speech: string };
export type ScriptSection = { sectionId: number; title: string; screens: ScriptScreen[] };

export type ScriptSourceSection = { id: number; heading: string; body_markdown: string | null };

const MAX_CHUNK_WORDS = 4;
const MAX_CHUNK_CHARS = 26;
const SPLIT_SENTENCE_OVER_WORDS = 22;
const BREAK_BEFORE = new Set(['ve', 'veya', 'ya', 'ama', 'fakat', 'ancak', 'çünkü', 'yani']);
const NO_CHUNK_START = new Set(['için', 'ile', 'ise', 'gibi', 'kadar', 'olarak', 'denir', 'de', 'da', 'ki', 'göre', 'sonra', 'önce']);

// İnline markdown'dan **kalın** bilgisini koruyarak kelime listesi çıkarır; diğer işaretler düşer.
function toWords(markdown: string): ScriptWord[] {
  const clean = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    // Tek yıldızlı italik sadece kelime sınırında — "=A2*B2" gibi formüllerdeki çarpma korunur.
    .replace(/(^|\s)\*([^*\s](?:[^*]*[^*\s])?)\*(?=\s|$|[.,;:!?])/g, '$1$2')
    .replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;:])/g, '$1$2');
  const words: ScriptWord[] = [];
  clean.split('**').forEach((piece, i) => {
    for (const t of piece.split(/\s+/)) if (t) words.push({ t, em: i % 2 === 1 });
  });
  // "**hücre**," gibi durumlarda noktalama ayrı bir "kelime" olarak kalır — öncekine yapıştır.
  return words.reduce<ScriptWord[]>((acc, w) => {
    if (/^[.,;:!?)]+$/.test(w.t) && acc.length) acc[acc.length - 1] = { ...acc[acc.length - 1], t: acc[acc.length - 1].t + w.t };
    else acc.push(w);
    return acc;
  }, []);
}

function splitSentences(words: ScriptWord[]): ScriptWord[][] {
  const sentences: ScriptWord[][] = [];
  let cur: ScriptWord[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (/[.!?]["”)]?$/.test(w.t) && (!next || /^["“(]?[A-ZÇĞİÖŞÜ0-9]/u.test(next.t))) {
      sentences.push(cur);
      cur = [];
    }
  });
  if (cur.length) sentences.push(cur);
  // Uzun cümleler noktalı virgülden (doğal duraklama) ayrı ekranlara bölünür.
  return sentences.flatMap((s) => {
    if (s.length <= SPLIT_SENTENCE_OVER_WORDS) return [s];
    const parts: ScriptWord[][] = [[]];
    for (const w of s) {
      parts[parts.length - 1].push(w);
      if (w.t.endsWith(';')) parts.push([]);
    }
    return parts.filter((p) => p.length);
  });
}

function chunkWords(words: ScriptWord[]): ScriptWord[][] {
  const chunks: ScriptWord[][] = [];
  let cur: ScriptWord[] = [];
  const len = (c: ScriptWord[]) => c.reduce((n, w) => n + w.t.length + 1, 0);
  const lower = (w?: ScriptWord) => w?.t.toLocaleLowerCase('tr').replace(/[.,;:!?]+$/, '') ?? '';
  words.forEach((w, i) => {
    if (cur.length >= 2 && BREAK_BEFORE.has(lower(w))) { chunks.push(cur); cur = []; }
    cur.push(w);
    const next = words[i + 1];
    // "için", "gibi", "denir" gibi kelimeler önceki kelimeye bağlı okunur; grup onlarla başlamaz.
    const nextIsTail = NO_CHUNK_START.has(lower(next)) && cur.length < MAX_CHUNK_WORDS + 2;
    // Virgülde bölme tek kelimelik grup üretmez: "A, B, C gibi" ve "80, 70, 90" tek parça kalır.
    const clauseEnd = /[;:]$/.test(w.t) || (/,$/.test(w.t) && cur.length >= 2 && !/^\S{1,3},$/.test(w.t));
    const full = cur.length >= MAX_CHUNK_WORDS || (cur.length >= 2 && len(cur) >= MAX_CHUNK_CHARS);
    if (clauseEnd || (full && !nextIsTail)) {
      chunks.push(cur);
      cur = [];
    }
  });
  if (cur.length) {
    if (cur.length === 1 && chunks.length) chunks[chunks.length - 1].push(...cur);
    else chunks.push(cur);
  }
  return chunks;
}

function toScreen(kind: ScriptScreen['kind'], eyebrow: string | null, words: ScriptWord[]): ScriptScreen {
  // Başlık ekranı bütün olarak belirir; gruplama sadece cümle ekranlarında.
  const chunks = (kind === 'title' ? [words] : chunkWords(words)).map((ws) => ({ words: ws, speech: toSpeech(ws.map((w) => w.t).join(' ')) }));
  return { kind, eyebrow, chunks, speech: chunks.map((c) => c.speech).join(' ') };
}

export function buildNarrationScript(sections: ScriptSourceSection[]): ScriptSection[] {
  return sections.map((sec) => {
    const screens: ScriptScreen[] = [toScreen('title', null, toWords(sec.heading.trim()))];
    let eyebrow: string | null = null;
    let paragraph: string[] = [];
    const flush = () => {
      const text = paragraph.join(' ').trim();
      paragraph = [];
      if (text) for (const s of splitSentences(toWords(text))) screens.push(toScreen('sentence', eyebrow, s));
    };
    for (const raw of (sec.body_markdown ?? '').split('\n')) {
      const line = raw.trim();
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      if (heading) { flush(); eyebrow = heading[1].replace(/\*\*/g, '').trim(); continue; }
      if (!line) { flush(); continue; }
      // Tablolar ve görsel/HTML satırları seslendirilmez (prototip kapsamı dışında).
      if (line.startsWith('|') || line.startsWith('<') || line.startsWith('![')) { flush(); continue; }
      const item = line.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
      if (item) { flush(); paragraph.push(/[.!?:]$/.test(item[1]) ? item[1] : `${item[1]}.`); flush(); continue; }
      paragraph.push(line);
    }
    flush();
    return { sectionId: sec.id, title: sec.heading.trim(), screens };
  });
}
