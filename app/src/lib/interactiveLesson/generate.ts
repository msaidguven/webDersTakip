import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateGeminiJson } from '@/app/src/lib/geminiJsonGen';
import type { GeminiWorkerProfile } from '@/app/src/lib/geminiWorkerProfile';
import { getQuestionsByIds } from '@/app/src/lib/quizQuestions';
import { ROBOT_NAME } from './guide';
import { LESSON_ICON_NAMES, type IconName } from './icons';
import { BLOCK_LIMITS, STEP_TEMPLATES, VISUAL_TEMPLATES, validateLesson, validateVisual } from './templates';
import { TERM_LINK, termSlug, type LessonBlock, type LessonDefinition, type LessonStep, type LessonVisual } from './types';

// Etkileşimli ders üretimi (Aşama 2, 2026-11-01): konunun yayındaki içeriği + anahtar kavramları + soru havuzu
// → tek AI çağrısı → şemaya göre ayıklama (AI'ın JSON'una güvenilmez, her alan yeniden kurulur) → elle yazılan
// derslerle aynı denetim (validateLesson). Bu aşamada YALNIZ bileşen görselleri (kart/tablo/ağaç/akış/parçala):
// dokunmalı harita (keşfet/etiketle/bul) ve SVG/resim AI'a verilmez — bölgeleri doğru çizilmiş şema ve gerçek
// fotoğraf gerektiriyor, sonradan seçilen konulara elle eklenir.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

const MAX_SECTIONS = 9;
// Tek AI çağrısında tek alt konu (kullanıcı kararı 2026-11-01): çıktı kısa kalır, süre sınırına rahat sığar, model
// tek konuya odaklanır; geçemeyen bölüm tek başına yeniden üretilir. (3 bölüm uzun içerikte 230 sn'yi aşmıştı.)
// Bölümler birbirini tekrar etmesin diye her çağrıya önceki bölümlerin özeti verilir (LessonPart.previous).
export const SECTIONS_PER_CALL = 1;

// Parça parça üretim: first = ilk parça (guide yalnız onda), of = konunun bölüm sayısı, previous = önceki
// bölümlerin özeti (başlıklar + kullanılan etkinlik türleri).
export type LessonPart = { first: boolean; of: number; previous?: string };

// Önceki bölümlerin kısa özeti: anlatım başlıkları ve etkinlik türleri (sonraki bölüm tekrar etmesin).
export function summarizeBlocks(blocks: LessonBlock[]): string {
  return blocks
    .map((b) => {
      const titles = b.steps.flatMap((st) => (st.kind === 'anlatim' ? [st.title] : []));
      const kinds = b.steps.flatMap((st) => (st.kind === 'anlatim' || st.kind === 'soru' || st.kind === 'klasik' ? [] : [STEP_TEMPLATES[st.kind].name]));
      return `- ${b.title}: anlatımlar "${titles.join('", "')}"; etkinlikler: ${kinds.join(', ') || 'yok'}`;
    })
    .join('\n');
}
const MAX_POOL_PER_SECTION = 8;
const MAX_SECTION_CHARS = 4500;
const ICONS = new Set<string>(LESSON_ICON_NAMES);

type PoolQuestion = { id: number; text: string; answer: string };
type SourceSection = { id: number; heading: string; body: string; pool: PoolQuestion[]; classical: { id: number; text: string }[] };
export type LessonSource = { topicId: number; title: string; grade: string; lesson: string; sections: SourceSection[]; terms: { slug: string; title: string; description: string }[] };

export async function loadLessonSource(supabase: Supabase, topicId: number): Promise<LessonSource | { error: string }> {
  const [topicRes, contentRes, highlightRes] = await Promise.all([
    supabase.from('topics').select('title, units!inner(grades!inner(name), lessons!inner(name))').eq('id', topicId).single(),
    supabase.from('topic_contents').select('id, order_no, topic_content_sections(id, heading, body_markdown, order_no)').eq('topic_id', topicId).eq('is_published', true).order('order_no'),
    supabase.from('topic_content_highlights').select('title, description, topic_contents!inner(topic_id, is_published)').eq('topic_contents.topic_id', topicId).eq('topic_contents.is_published', true),
  ]);
  const failed = topicRes.error ?? contentRes.error ?? highlightRes.error;
  if (failed) return { error: failed.message };
  type Row = { title: string; units: { grades: { name: string }; lessons: { name: string } } };
  const topic = topicRes.data as unknown as Row;
  type Sec = { id: number; heading: string; body_markdown: string | null; order_no: number };
  const rawSections = ((contentRes.data ?? []) as { topic_content_sections: Sec[] }[]).flatMap((c) => [...c.topic_content_sections].sort((a, b) => a.order_no - b.order_no));
  if (!rawSections.length) return { error: 'Yayında içerik bölümü yok' };

  const ids = rawSections.map((s) => s.id);
  const { data: qRows, error: qErr } = await supabase.from('questions').select('id, section_id, question_type_id, question_text').in('section_id', ids).eq('is_active', true).in('question_type_id', [1, 3, 4]).order('id');
  if (qErr) return { error: qErr.message };
  const rows = (qRows ?? []) as { id: number; section_id: number; question_type_id: number; question_text: string }[];
  const testIds = rows.filter((r) => r.question_type_id !== 4).map((r) => r.id);
  const resolved = new Map((await getQuestionsByIds(testIds)).map((q) => [q.id, q]));

  const sections: SourceSection[] = rawSections.map((s) => {
    const pool = rows
      .filter((r) => r.section_id === s.id && r.question_type_id !== 4)
      .flatMap((r): PoolQuestion[] => {
        const q = resolved.get(r.id);
        if (q?.type !== 'multiple_choice' && q?.type !== 'blank') return [];
        const opts = q.type === 'multiple_choice' ? q.choices : q.options;
        return [{ id: q.id, text: q.question_text, answer: opts.find((o) => o.is_correct)?.text ?? '' }];
      })
      .slice(0, MAX_POOL_PER_SECTION);
    const classical = rows.filter((r) => r.section_id === s.id && r.question_type_id === 4).slice(0, 3).map((r) => ({ id: r.id, text: r.question_text }));
    return { id: s.id, heading: s.heading, body: (s.body_markdown ?? '').slice(0, MAX_SECTION_CHARS), pool, classical };
  });
  // Bölüm en az 2 test sorusu ister (BLOCK_LIMITS.soru); sorusu yetmeyen bölüm derse girmez.
  const eligible = sections.filter((s) => s.pool.length >= BLOCK_LIMITS.soru[0]).slice(0, MAX_SECTIONS);
  if (!eligible.length) return { error: 'Hiçbir bölümde en az 2 test sorusu yok' };
  const terms = ((highlightRes.data ?? []) as { title: string; description: string }[]).map((h) => ({ slug: termSlug(h.title), title: h.title, description: h.description }));
  return { topicId, title: topic.title, grade: topic.units.grades.name, lesson: topic.units.lessons.name, sections: eligible, terms };
}

// part: uzun konu parça parça üretilirken src.sections yalnız bu çağrının bölümleridir; guide yalnız ilk parçada.
// Görsel türleri + seçim kuralları: ders üretimi ve hazır derslerin görsel yenilemesi (revisualizeLesson) ortak.
function visualRules(): string {
  const V = VISUAL_TEMPLATES;
  const r = (x: readonly [number, number]) => `${x[0]}-${x[1]}`;
  return `GÖRSELLER (visual; hepsinde "caption"? isteğe bağlı):
- {"kind":"kartlar","cards":[{"icon"?,"title":"≤${V.kartlar.titleMax}","text"?:"≤${V.kartlar.textMax}","tag"?:"≤${V.kartlar.tagMax}"}]} ${r(V.kartlar.cards)} kart — türler/çeşitler/örnekler.
- {"kind":"tablo","columns":[${r(V.tablo.columns)}],"rows":[[...]]} ${r(V.tablo.rows)} satır, hücre ≤${V.tablo.cellMax}; "✓"/"✗" hücreleri simge olur — karşılaştırma.
- {"kind":"agac","root":{"label","icon"?},"children":[{"label","icon"?,"items"?:[≤3]}]} ${r(V.agac.children)} dal — hiyerarşi/sınıflandırma.
- {"kind":"akis","steps":[{"label":"≤${V.akis.labelMax}","icon"?}]} ${r(V.akis.steps)} adım — süreç, sıra, neden-sonuç.
- {"kind":"parcala","parts":[{"text":"≤${V.parcala.textMax}","label","note"?}]} ${r(V.parcala.parts)} parça — YALNIZ yazılı bir ifadeyi (dosya adı, e-posta/web adresi, kelime + ek) parçalarına ayırma.
- {"kind":"denklem","inputs":[{"label":"≤${V.denklem.labelMax}","icon"?,"text"?:"≤${V.denklem.textMax}"}],"result":{"label","icon"?,"text"?}} ${r(V.denklem.inputs)} girdi — iki-üç şeyin birleşmesiyle oluşan kavram (Gerçek çevre + Dijital bilgi = Artırılmış gerçeklik).
- {"kind":"dongu","center"?:"≤${V.dongu.centerMax}","steps":[{"label":"≤${V.dongu.labelMax}","icon"?}]} ${r(V.dongu.steps)} adım — kendini tekrarlayan süreç (son adım başa döner).
- {"kind":"merkez","center":{"label","icon"?},"parts":[{"label":"≤${V.merkez.labelMax}","icon"?,"text"?:"≤${V.merkez.textMax}"}]} ${r(V.merkez.parts)} parça — bir bütün ve parçaları / bileşenleri / kullanım alanları.
- {"kind":"karsilastir","sides":[{"title":"≤${V.karsilastir.titleMax}","icon"?,"points":[${r(V.karsilastir.points)} madde ≤${V.karsilastir.pointMax}]}, {…}],"common"?:[≤${V.karsilastir.common[1]} ortak madde]} — TAM 2 şeyin farkları.
- {"kind":"cubuk","bars":[{"label":"≤${V.cubuk.labelMax}","value":<sayı>,"display"?:"gösterilecek değer, ör. %60","icon"?}]} ${r(V.cubuk.bars)} çubuk — sayısal büyüklükleri karşılaştırma; YALNIZ kaynakta yazan sayılar, sayı uydurma.
İkon yalnız şu adlardan: ${LESSON_ICON_NAMES.join(', ')}. Uygun yoksa icon yazma (ikon görseli çok güçlendirir, uygun olanı mutlaka seç).

GÖRSEL SEÇİMİ (bilginin şekline göre; görsel bilgiyi ÇİZEREK taşısın, metni kutuya koymak görsel değildir):
- iki-üç şey birleşip yeni bir şey oluşturuyorsa → denklem
- bir bütün ve parçaları / bileşenleri / kullanım alanları → merkez
- tekrarlayan süreç → dongu; başı ve sonu olan süreç, sıra, neden-sonuç → akis
- iki şeyin farkı → karsilastir; 3+ öğe aynı özelliklerle → tablo
- türler, çeşitler, örnekler → kartlar; ana öğe → alt gruplar hiyerarşisi → agac
- kaynakta sayısal değer (yüzde, miktar, süre) varsa → cubuk
- parcala YALNIZ yazılı bir ifadeyi bölmek için; kavram anlatmak için ASLA kullanma.
- Bir bölümdeki anlatım ekranlarında mümkünse farklı görsel türleri seç.`;
}

export function buildLessonPrompt(src: LessonSource, previousErrors?: string, part?: LessonPart): string {
  const T = STEP_TEMPLATES;
  const r = (x: readonly [number, number]) => `${x[0]}-${x[1]}`;
  const sections = src.sections
    .map((s) => [
      `### BÖLÜM sectionId=${s.id}: ${s.heading}`,
      s.body,
      'Test soruları (soru adımında yalnız bunların id’si):',
      ...s.pool.map((q) => `- #${q.id}: ${q.text.replace(/\s+/g, ' ').slice(0, 220)} → doğru: ${q.answer}`),
      s.classical.length ? 'Açık uçlu sorular (klasik adımında kullanılabilir):' : 'Bu bölümde açık uçlu soru yok: klasik adımını prompt + modelAnswer ile kendin yaz.',
      ...s.classical.map((q) => `- #${q.id}: ${q.text.replace(/\s+/g, ' ').slice(0, 220)}`),
    ].join('\n'))
    .join('\n\n');
  const terms = src.terms.map((t) => `- ${t.slug}: ${t.title} — ${t.description}`).join('\n') || '(anahtar kavram yok: kavram bağı kullanma)';

  return `Sen ortaokul öğrencileri için oyun havasında ETKİLEŞİMLİ DERS hazırlayan bir eğitim tasarımcısısın.
Konu: ${src.grade} ${src.lesson} · "${src.title}". Dersi "${ROBOT_NAME}" adlı sevimli robot anlatır; öğrenci her ekranda bir şey yapar.
${part && part.of > src.sections.length ? `Ders ${part.of} bölümden oluşuyor; bu çağrıda yalnız aşağıdaki ${src.sections.length === 1 ? 'bölümü' : `${src.sections.length} bölümü`} yaz.${part.first ? '' : ' Bu ilk parça değil: "guide" yazma.'}\n` : ''}${part?.previous ? `ÖNCEKİ BÖLÜMLERDE YAZILANLAR (aynı bilgiyi ve aynı anlatım başlıklarını tekrar etme; mümkünse farklı etkinlik türleri ve görseller seç):\n${part.previous}\n` : ''}
KAYNAK (yalnız buradaki bilgileri kullan, yeni bilgi ekleme, kaynakla çelişme):
${sections}

ANAHTAR KAVRAMLAR (anlatım metninde [[görünen metin|kimlik]] ile bağlanabilir; YALNIZ bu kimlikler):
${terms}

ÇIKTI: yalnız JSON.
{
  "guide": { "intro": "${ROBOT_NAME} adlı robotun konuya özel kısa hikâyeli açılışı (1-2 cümle, 'Merhaba! Ben ${ROBOT_NAME}.' ile başlar)", "finish": "kapanış (1-2 cümle)" },
  "blocks": [ { "sectionId": <yukarıdaki id>, "title": "<kısa bölüm adı>", "steps": [ ... ] } ]
}
Yukarıdaki HER bölüm için sırasıyla bir blok yaz. Blok içi sıra: anlatım ekranları → pekiştirme → test soruları → klasik.
Blok başına: anlatım ${r(BLOCK_LIMITS.anlatim)}, pekiştirme ${r(BLOCK_LIMITS.pekistirme)}, test sorusu ${r(BLOCK_LIMITS.soru)}, klasik ${r(BLOCK_LIMITS.klasik)}.

ADIM TÜRLERİ:
- {"kind":"anlatim","title":"≤${T.anlatim.titleMax} karakter","body":"≤${T.anlatim.bodyWordsMax} kelime, tek fikir, **kalın** olabilir","visual":<GÖRSEL ZORUNLU>,"predict"?:{"question","options":[${r(T.anlatim.predictOptions)} seçenek],"answer":<doğru indeks>},"misconception"?:{"wrong":"yaygın yanlış inanç","right":"doğrusu"} (ikisi de ≤${T.anlatim.misconceptionCharsMax} karakter)}
  Metin görselde yazanı tekrar etmez, kuralı/örüntüyü söyler. Bloğun ilk anlatımına merak uyandıran bir predict koy.
- {"kind":"eslestirme","prompt","targets":[...],"items":[{"text","target":<targets indeksi>}],"explanation"} — bire bir: ${r(T.eslestirme.items)} öğe; gruplama (öğe > hedef): ${r(T.eslestirme.groupTargets)} grup, ${r(T.eslestirme.groupItems)} öğe; her metin ≤${T.eslestirme.itemCharsMax} karakter.
- {"kind":"dogru_yanlis","prompt","statements":[{"text":"≤${T.dogru_yanlis.statementCharsMax} karakter","correct":true|false,"note":"neden doğru/yanlış, kısa"}]} — ${r(T.dogru_yanlis.statements)} ifade, hem doğru hem yanlış olsun.
- {"kind":"bosluk","prompt","text":"≤${T.bosluk.textCharsMax} karakter, boşluklar {0} {1}…","answers":[boşluk sırasıyla],"distractors":[${r(T.bosluk.distractors)} çeldirici],"explanation"} — ${r(T.bosluk.blanks)} boşluk.
- {"kind":"siralama","prompt","items":[DOĞRU sırada ${r(T.siralama.items)} öğe],"explanation"} — yalnız gerçekten sırası olan bilgi.
- {"kind":"coklu_secim","prompt","options":[{"text","correct":true|false,"icon"?}],"explanation"} — ${r(T.coklu_secim.options)} seçenek, ${r(T.coklu_secim.correct)} doğru, en az 2 yanlış.
- {"kind":"soru","questionId":<aynı bölümün test soru id'si>} — her soru en çok bir kez.
- {"kind":"klasik","questionId":<aynı bölümün açık uçlu soru id'si>} ya da {"kind":"klasik","prompt":"≤${T.klasik.promptCharsMax} karakter","modelAnswer":"örnek cevap, 2-3 cümle"}

${visualRules()}

KURALLAR:
- Dil: ${src.grade} öğrencisine sade, kısa, samimi Türkçe. "Yazılı" sözcüğünü hiç kullanma.
- Numaralı/harfli öğeleri ("1. adım", "A)") doğal sırasıyla yaz.
- Pekiştirmeler o bölümün anlatımında geçen bilgiyi yoklar; her pekiştirmenin explanation'ı kısa ve öğretici olsun.
- Aynı bilgiyi art arda iki ekranda tekrar etme; her ekran tek fikir.
${previousErrors ? `\nÖNCEKİ DENEMEN ŞU HATALARLA REDDEDİLDİ, HEPSİNİ DÜZELT:\n${previousErrors}\n` : ''}`;
}

/* ---------------- AI cevabını şemaya göre ayıklama ---------------- */

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const icon = (v: unknown) => (typeof v === 'string' && ICONS.has(v) ? (v as IconName) : undefined);
const opt = (v: unknown) => str(v) || undefined;

const iconItem = (v: unknown) => (isObj(v) && str(v.label) ? { label: str(v.label), icon: icon(v.icon), text: opt(v.text) } : null);

function parseVisual(v: unknown): LessonVisual | null {
  if (!isObj(v)) return null;
  const caption = opt(v.caption);
  switch (v.kind) {
    case 'kartlar':
      return { kind: 'kartlar', caption, cards: arr(v.cards).filter(isObj).map((c) => ({ icon: icon(c.icon), title: str(c.title), text: opt(c.text), tag: opt(c.tag) })).filter((c) => c.title) };
    case 'tablo':
      return { kind: 'tablo', caption, columns: arr(v.columns).map(str), rows: arr(v.rows).map((row) => arr(row).map(str)) };
    case 'agac':
      if (!isObj(v.root)) return null;
      return {
        kind: 'agac',
        caption,
        root: { label: str(v.root.label), icon: icon(v.root.icon) },
        children: arr(v.children).filter(isObj).map((c) => ({ label: str(c.label), icon: icon(c.icon), items: arr(c.items).map(str).filter(Boolean) })),
      };
    case 'akis':
      return { kind: 'akis', caption, steps: arr(v.steps).filter(isObj).map((st) => ({ label: str(st.label), icon: icon(st.icon) })).filter((st) => st.label) };
    case 'parcala':
      return { kind: 'parcala', caption, parts: arr(v.parts).filter(isObj).map((p) => ({ text: str(p.text), label: str(p.label), note: opt(p.note) })) };
    case 'denklem': {
      const result = iconItem(v.result);
      return result ? { kind: 'denklem', caption, inputs: arr(v.inputs).map(iconItem).filter((it) => it !== null), result } : null;
    }
    case 'dongu':
      return { kind: 'dongu', caption, center: opt(v.center), steps: arr(v.steps).map(iconItem).filter((it) => it !== null) };
    case 'merkez': {
      const center = iconItem(v.center);
      return center ? { kind: 'merkez', caption, center, parts: arr(v.parts).map(iconItem).filter((it) => it !== null) } : null;
    }
    case 'karsilastir': {
      const sides = arr(v.sides).filter(isObj).map((s) => ({ title: str(s.title), icon: icon(s.icon), points: arr(s.points).map(str).filter(Boolean) }));
      if (sides.length !== 2) return null;
      return { kind: 'karsilastir', caption, sides: [sides[0], sides[1]], common: arr(v.common).map(str).filter(Boolean) };
    }
    case 'cubuk':
      return { kind: 'cubuk', caption, bars: arr(v.bars).filter(isObj).map((b) => ({ label: str(b.label), value: Number(b.value), display: opt(b.display), icon: icon(b.icon) })).filter((b) => b.label) };
    default:
      return null;
  }
}

function parseStep(s: Raw, where: string, errors: string[]): LessonStep | null {
  const explanation = str(s.explanation);
  switch (s.kind) {
    case 'anlatim': {
      const visual = parseVisual(s.visual) ?? undefined;
      const p = isObj(s.predict) ? s.predict : null;
      const predict = p && Number.isInteger(p.answer) ? { question: str(p.question), options: arr(p.options).map(str), answer: Number(p.answer) } : undefined;
      if (predict && (predict.answer < 0 || predict.answer >= predict.options.length)) errors.push(`${where}: predict.answer geçersiz`);
      const m = isObj(s.misconception) ? s.misconception : null;
      return { kind: 'anlatim', title: str(s.title), body: opt(s.body), visual, predict, misconception: m && str(m.wrong) && str(m.right) ? { wrong: str(m.wrong), right: str(m.right) } : undefined };
    }
    case 'eslestirme':
      return { kind: 'eslestirme', prompt: str(s.prompt), targets: arr(s.targets).map(str), items: arr(s.items).filter(isObj).map((it) => ({ text: str(it.text), target: Number(it.target) })), explanation, visual: parseVisual(s.visual) ?? undefined };
    case 'dogru_yanlis':
      return { kind: 'dogru_yanlis', prompt: str(s.prompt), statements: arr(s.statements).filter(isObj).map((st) => ({ text: str(st.text), correct: st.correct === true, note: str(st.note) })) };
    case 'bosluk':
      return { kind: 'bosluk', prompt: str(s.prompt), text: str(s.text), answers: arr(s.answers).map(str), distractors: arr(s.distractors).map(str), explanation, visual: parseVisual(s.visual) ?? undefined };
    case 'siralama':
      return { kind: 'siralama', prompt: str(s.prompt), items: arr(s.items).map(str).filter(Boolean), explanation, visual: parseVisual(s.visual) ?? undefined };
    case 'coklu_secim':
      return { kind: 'coklu_secim', prompt: str(s.prompt), options: arr(s.options).filter(isObj).map((o) => ({ text: str(o.text), correct: o.correct === true, icon: icon(o.icon) })), explanation, visual: parseVisual(s.visual) ?? undefined };
    case 'soru':
      return Number.isInteger(s.questionId) ? { kind: 'soru', questionId: Number(s.questionId) } : (errors.push(`${where}: soru id'si yok`), null);
    case 'klasik':
      if (Number.isInteger(s.questionId)) return { kind: 'klasik', questionId: Number(s.questionId) };
      if (str(s.prompt) && str(s.modelAnswer)) return { kind: 'klasik', prompt: str(s.prompt), modelAnswer: str(s.modelAnswer) };
      errors.push(`${where}: klasik adımında questionId ya da prompt + modelAnswer yok`);
      return null;
    default:
      errors.push(`${where}: izin verilmeyen adım türü "${String(s.kind)}"`);
      return null;
  }
}

// Boş errors = ders kullanılabilir.
export function parseGeneratedLesson(data: unknown, src: LessonSource, needGuide = true): { lesson: LessonDefinition; errors: string[] } {
  const errors: string[] = [];
  const root = isObj(data) ? data : {};
  const guide = isObj(root.guide) && str(root.guide.intro) && str(root.guide.finish) ? { intro: str(root.guide.intro), finish: str(root.guide.finish) } : undefined;
  if (needGuide && !guide) errors.push('guide.intro / guide.finish eksik');
  const bySection = new Map(src.sections.map((s) => [s.id, s]));
  const used = new Set<number>();
  const blocks: LessonBlock[] = arr(root.blocks)
    .filter(isObj)
    .flatMap((b, bi): LessonBlock[] => {
      const sec = bySection.get(Number(b.sectionId));
      if (!sec) {
        errors.push(`Blok ${bi + 1}: geçersiz sectionId ${String(b.sectionId)}`);
        return [];
      }
      const steps = arr(b.steps)
        .filter(isObj)
        .flatMap((s, si) => {
          const where = `Bölüm ${bi + 1}, adım ${si + 1}`;
          const step = parseStep(s, where, errors);
          if (!step) return [];
          if (step.kind === 'soru' || (step.kind === 'klasik' && 'questionId' in step)) {
            const ok = step.kind === 'soru' ? sec.pool.some((q) => q.id === step.questionId) : sec.classical.some((q) => q.id === step.questionId);
            if (!ok) errors.push(`${where}: #${step.questionId} bu bölümün havuzunda yok`);
            else if (used.has(step.questionId)) errors.push(`${where}: #${step.questionId} iki kez kullanılmış`);
            used.add(step.questionId);
          }
          return [step];
        });
      return [{ sectionId: sec.id, title: str(b.title) || sec.heading, steps }];
    });
  const missing = src.sections.filter((s) => !blocks.some((b) => b.sectionId === s.id));
  if (missing.length) errors.push(`Eksik bölüm: ${missing.map((s) => s.id).join(', ')}`);
  const lesson: LessonDefinition = { topicId: src.topicId, guide, blocks };
  errors.push(...validateLesson(lesson, src.terms.map((t) => t.slug)));
  return { lesson, errors };
}

// Üret → denetle → geçemezse aynı çalışmada hata listesiyle düzelttir (süre yettiği sürece, en çok 3 çağrı).
// İlk denemelerde hatalar çoğunlukla birkaç karakterlik sınır aşımı; bir düzeltme turu yetiyor.
const REPAIR_MIN_MS = 80 * 1000;
export async function produceLesson(src: LessonSource, profile: GeminiWorkerProfile, previousErrors?: string, part?: LessonPart): Promise<{ lesson: LessonDefinition; errors: string[]; model: string; calls: number }> {
  let errorsText = previousErrors;
  for (let calls = 1; ; calls++) {
    const out = await generateGeminiJson(buildLessonPrompt(src, errorsText, part), profile);
    const { lesson, errors } = parseGeneratedLesson(out.data, src, part?.first ?? true);
    const timeLeft = profile.deadlineAt ? profile.deadlineAt - Date.now() : Infinity;
    if (!errors.length || calls >= 3 || timeLeft < REPAIR_MIN_MS) return { lesson, errors, model: out.model, calls };
    errorsText = errors.slice(0, 25).join('\n');
  }
}

/* ---------------- Hazır dersin görsellerini yenileme ---------------- */

// 2026-11-03 (kullanıcı isteği): yeni görsel türleri (denklem/döngü/merkez/karşılaştır/çubuk) gelmeden üretilmiş
// derslerin anlatım ekranlarına görseli yeniden seçtirir. Metin, sorular ve diğer adımlar AYNEN kalır (seslerin
// çoğu geçerli kalsın); geçerli görsel gelmeyen ekran eski görseliyle kalır. Bilgi kaynağı ekranın kendi metni +
// eski görseli: yeni bilgi eklenmez.
export async function revisualizeLesson(
  lesson: LessonDefinition,
  topic: { title: string; grade: string; lesson: string },
  profile: GeminiWorkerProfile,
): Promise<{ lesson: LessonDefinition; changed: string[]; errors: string[]; calls: number }> {
  type Screen = { id: string; bi: number; si: number };
  const screens: Screen[] = lesson.blocks.flatMap((b, bi) => b.steps.flatMap((st, si) => (st.kind === 'anlatim' ? [{ id: `b${bi}s${si}`, bi, si }] : [])));
  const next = structuredClone(lesson);
  const accepted = new Map<string, LessonVisual>();
  let errors: string[] = [];
  let calls = 0;
  const plain = (t?: string) => (t ?? '').replace(TERM_LINK, '$1');
  while (calls < 3) {
    const todo = screens.filter((sc) => !accepted.has(sc.id));
    if (!todo.length) break;
    const list = todo
      .map(({ id, bi, si }) => {
        const st = lesson.blocks[bi].steps[si];
        if (st.kind !== 'anlatim') return '';
        return [
          `### ${id} · Bölüm: ${lesson.blocks[bi].title} · Ekran: ${st.title}`,
          `Metin: ${plain(st.body)}`,
          st.misconception ? `Yanılgı: ${st.misconception.wrong} → Doğrusu: ${st.misconception.right}` : '',
          `Şu anki görsel: ${JSON.stringify(st.visual ?? null)}`,
        ].filter(Boolean).join('\n');
      })
      .join('\n\n');
    calls++;
    const out = await generateGeminiJson(
      `Sen ortaokul için oyun havasında etkileşimli ders hazırlayan bir eğitim tasarımcısısın. Konu: ${topic.grade} ${topic.lesson} · "${topic.title}".
Aşağıda hazır bir dersin anlatım ekranları var. Metinlere DOKUNMA; her ekran için bilgiyi en iyi taşıyan görseli seç.
Görseldeki bilgi YALNIZ o ekranın metninden, yanılgısından ve şu anki görselinden gelsin; yeni bilgi ekleme, kaynakla çelişme.
Şu anki görsel bilgiyi zaten iyi taşıyorsa (ör. gerçek bir karşılaştırma tablosu) aynı türde bırakabilirsin; "parcala" kavram anlatıyorsa MUTLAKA değiştir.
Aynı bölümdeki ekranlarda mümkünse farklı görsel türleri kullan.

EKRANLAR:
${list}

ÇIKTI: yalnız JSON. {"visuals":[{"id":"<ekran kimliği>","visual":{...}}]} — yukarıdaki HER ekran için bir tane.

${visualRules()}
${errors.length ? `\nÖNCEKİ DENEMEN ŞU HATALARLA REDDEDİLDİ, BU EKRANLARI DÜZELT:\n${errors.slice(0, 25).join('\n')}\n` : ''}`,
      profile,
    );
    errors = [];
    const root = isObj(out.data) ? out.data : {};
    for (const item of arr(root.visuals).filter(isObj)) {
      const sc = todo.find((x) => x.id === str(item.id));
      if (!sc) continue;
      const visual = parseVisual(item.visual);
      if (!visual) {
        errors.push(`${sc.id}: görsel okunamadı`);
        continue;
      }
      const found: string[] = [];
      validateVisual(found, sc.id, visual);
      if (found.length) errors.push(...found);
      else accepted.set(sc.id, visual);
    }
    for (const sc of todo) if (!accepted.has(sc.id) && !errors.some((e) => e.startsWith(sc.id))) errors.push(`${sc.id}: görsel yazılmamış`);
  }
  const changed: string[] = [];
  for (const { id, bi, si } of screens) {
    const st = next.blocks[bi].steps[si];
    const v = accepted.get(id);
    if (st.kind === 'anlatim' && v && JSON.stringify(v) !== JSON.stringify(st.visual)) {
      st.visual = v;
      changed.push(`${id} ${st.title}: ${v.kind}`);
    }
  }
  return { lesson: next, changed, errors, calls };
}
