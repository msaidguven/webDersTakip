import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_BULLETS = 5;
const MAX_OBJECTIVES = 5;
const MAX_CONCEPTS = 8;

// Sunum sınıfta öğretmen anlatımında da kullanılıyor (kullanıcı isteği, 2026-09-27) —
// alt başlık özetlerinin yanına kazanımlar, anahtar kavramlar, etkinlik, konu özeti ve
// tartışma slaytları eklendi. Hepsi içerik üretiminde ZATEN üretilen alanlardan geliyor,
// ek AI çağrısı yok. Veri yoksa o slayt atlanır.
export type SlideKind = 'cover' | 'objectives' | 'concepts' | 'section' | 'activity' | 'summary' | 'discussion';

export type SlideConcept = { term: string; description: string };

// Ortak alanlar (heading/bullets/görsel) her tipte dolu tutuluyor — pptx dışa aktarımı
// (presentation/route.ts) her slaytı "başlık + madde listesi" olarak çizdiği için yeni
// tipler orada ek kod gerektirmeden çalışır. items/label/reveal sadece oynatıcı içindir.
export type SlideDeckSlide = {
  kind: SlideKind;
  heading: string;
  subtitle: string | null;
  bullets: string[];
  imageUrl: string | null;
  diagramSvg: string | null;
  // concepts, summary: terim + açıklama çiftleri (summary sadece tüm satırlar "**X**: Y" ise).
  items?: SlideConcept[];
  // activity: çerçeve etiketi ("Sen Olsan?" vb.) ve tıklayınca açılan örnek yaklaşım.
  label?: string | null;
  reveal?: string | null;
  // Sınıf içi tahmini süre (dk) — bkz. SLIDE_MINUTES / fitToTimeBudget.
  minutes?: number;
};

export type SlideDeckTip = { title: string; content: string };

export type SlideDeck = {
  topicTitle: string;
  eyebrowText: string;
  slides: SlideDeckSlide[];
  tip: SlideDeckTip | null;
  // Sınıf içi tahmini toplam süre (dk). Eski, cache'lenmiş (topic_content_slides) desteklerde yok.
  estimatedMinutes?: number;
  // En az bir alt başlıkta review_summary yok, kaba cümle-bölme yedeğine düşüldü (bkz.
  // deriveBullets) — admin panelinde "bu içerik eski, yeniden kaydet" uyarısı için.
  hasStaleSections: boolean;
};

type TopicRow = { id: number; title: string; unit_id: number };
type UnitRow = { id: number; title: string; lesson_id: number; grade_id: number };
type LessonRow = { id: number; name: string };
type GradeRow = { id: number; name: string };
type TopicContentRow = { id: number; title: string; subtitle: string | null; hero_image_url: string | null };
type SectionRow = {
  id: number;
  order_no: number;
  heading: string;
  body_markdown: string | null;
  review_summary: string | null;
  image_url: string | null;
  diagram_svg: string | null;
};
type TipRow = { title: string; content: string };
type ActivityRow = { activity_prompt_markdown: string | null; activity_example_markdown: string | null };
type HighlightRow = { title: string; description: string };
type OutcomeRow = { description: string };
type TopicWrapRow = { summary_markdown: string | null; discussion_prompt_markdown: string | null };

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackBullets(bodyMarkdown: string | null): string[] {
  const text = stripMarkdown(bodyMarkdown || '');
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_BULLETS);
}

// Slayt bullet'ları artık ayrı bir AI çağrısıyla değil, içerik üretimiyle AYNI adımda
// üretilen review_summary'den ("Ev Tekrar Özeti" — 2-4 kısa, bağımsız cümle, madde başına
// en fazla 12-15 kelime, bkz. _explanation-notebook-rules.md madde 3) türetiliyor. Bu alan
// zaten her 3 üretim yolunda (otomatik RAG sentez/kitap worker'ı VE manuel NotebookLM
// yapıştırma) aynı prompt şemasında geliyor, o yüzden slaytlar içerikle senkron kalıyor —
// içerik her kaydedildiğinde /api/admin/topic-sections/plan slaytları da otomatik
// yeniden üretiyor (bkz. o route'un sonu). AI review_summary'yi tek paragraf ya da satır
// satır madde döndürebilir, ikisini de kabul ediyoruz.
function splitReviewSummary(reviewSummary: string): string[] {
  const lines = reviewSummary
    .split(/\n+/)
    .map((l) => stripMarkdown(l.replace(/^[\s*•-]+/, '')))
    .filter(Boolean);
  if (lines.length >= 2) return lines.slice(0, MAX_BULLETS);

  const text = stripMarkdown(reviewSummary);
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_BULLETS);
}

function deriveBullets(section: SectionRow): { bullets: string[]; stale: boolean } {
  if (section.review_summary?.trim()) {
    const bullets = splitReviewSummary(section.review_summary);
    if (bullets.length) return { bullets, stale: false };
  }
  // review_summary henüz üretilmemiş eski konular için (bu alan 2026-09-15'te eklendi) —
  // içerik gövdesinden kaba bir madde listesine düş, ve bunu "stale" olarak işaretle.
  return { bullets: fallbackBullets(section.body_markdown), stale: true };
}

// İçerik promptunun etkinlik çerçeveleri (bkz. app/prompt/_explanation-notebook-rules.md).
const ACTIVITY_FRAMES = ['Günlük Hayattan Bul', 'Sen Olsan?', 'Karşılaştır', 'Hayal Et', 'Düşün', 'Dene'];

function parseActivity(promptMarkdown: string): { label: string; text: string } {
  const text = stripMarkdown(promptMarkdown);
  for (const frame of ACTIVITY_FRAMES) {
    if (text.toLocaleLowerCase('tr-TR').startsWith(frame.toLocaleLowerCase('tr-TR'))) {
      const rest = text.slice(frame.length).replace(/^\s*[:：]\s*/, '').trim();
      if (rest) return { label: frame, text: rest };
    }
  }
  return { label: 'Düşün', text };
}

// Konu özeti AI'dan "- **Terim**: açıklama" satırları olarak geliyor; hepsi bu kalıptaysa
// terim/açıklama kartı, değilse düz madde olarak gösterilir.
function parseSummary(summaryMarkdown: string): { bullets: string[]; items?: SlideConcept[] } {
  const lines = summaryMarkdown.split(/\n+/).map((l) => l.replace(/^\s*(?:[-•]|\*(?!\*))\s*/, '').trim()).filter(Boolean);
  const pairs = lines.map((l) => /^\*\*(.+?)\*\*\s*[:：]\s*(.+)$/.exec(l));
  const bullets = lines.map((l) => stripMarkdown(l)).filter(Boolean).slice(0, MAX_BULLETS + 1);
  if (pairs.length && pairs.every(Boolean)) {
    const items = pairs.slice(0, MAX_BULLETS + 1).map((m) => ({ term: stripMarkdown(m![1]), description: stripMarkdown(m![2]) }));
    return { bullets: items.map((i) => `${i.term}: ${i.description}`), items };
  }
  return { bullets };
}

// Sınıf içi tahmini süreler (dk) — öğretmenin anlatma/soru sorma temposuna göre kaba
// değerler. Amaç kesin ölçüm değil, sunumun 20-25 dk'yı aşmaması (kullanıcı isteği).
const SLIDE_MINUTES = {
  cover: () => 0.5,
  objectives: () => 1,
  concepts: (n: number) => 0.5 + 0.3 * n,
  section: (bullets: number, hasVisual: boolean) => 1 + 0.6 * bullets + (hasVisual ? 0.5 : 0),
  activity: () => 2,
  summary: () => 1.5,
  discussion: () => 2,
};
const TIME_BUDGET_MINUTES = 25;

const sumMinutes = (slides: SlideDeckSlide[]) => slides.reduce((t, s) => t + (s.minutes ?? 0), 0);

// Bütçe aşılırsa kırpma sırası: önce etkinlikler (kalanlar konuya eşit yayılır), sonra
// tartışma, kazanımlar, kavramlar. Kapak, alt başlıklar ve konu özeti hiç atılmaz — alt
// başlıklar tek başına bütçeyi aşıyorsa sunum yine de eksiksiz gösterilir.
function fitToTimeBudget(slides: SlideDeckSlide[]): SlideDeckSlide[] {
  if (sumMinutes(slides) <= TIME_BUDGET_MINUTES) return slides;

  const activityIdx = slides.flatMap((s, i) => (s.kind === 'activity' ? [i] : []));
  const withoutActivities = slides.filter((s) => s.kind !== 'activity');
  const room = TIME_BUDGET_MINUTES - sumMinutes(withoutActivities);
  const keepCount = Math.max(0, Math.min(activityIdx.length, Math.floor(room / SLIDE_MINUTES.activity())));
  const keep = new Set<number>();
  for (let j = 0; j < keepCount; j++) {
    keep.add(activityIdx[Math.floor(((j + 0.5) * activityIdx.length) / keepCount)]);
  }
  let result = slides.filter((s, i) => s.kind !== 'activity' || keep.has(i));

  for (const kind of ['discussion', 'objectives', 'concepts'] as const) {
    if (sumMinutes(result) <= TIME_BUDGET_MINUTES) break;
    result = result.filter((s) => s.kind !== kind);
  }
  return result;
}

export type GenerateSlideDeckResult =
  | { ok: true; topicContentId: number; deck: SlideDeck }
  | { ok: false; status: number; error: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateSlideDeck(supabase: SupabaseClient<any>, topicId: number): Promise<GenerateSlideDeckResult> {
  const { data: topic } = await supabase.from('topics').select('id, title, unit_id').eq('id', topicId).maybeSingle();
  if (!topic) return { ok: false, status: 404, error: 'Konu bulunamadı' };
  const topicRow = topic as TopicRow;

  const { data: unit } = await supabase.from('units').select('id, title, lesson_id, grade_id').eq('id', topicRow.unit_id).maybeSingle();
  const unitRow = unit as UnitRow | null;

  let lessonRow: LessonRow | null = null;
  let gradeRow: GradeRow | null = null;
  if (unitRow) {
    const [{ data: lesson }, { data: grade }] = await Promise.all([
      supabase.from('lessons').select('id, name').eq('id', unitRow.lesson_id).maybeSingle(),
      supabase.from('grades').select('id, name').eq('id', unitRow.grade_id).maybeSingle(),
    ]);
    lessonRow = lesson as LessonRow | null;
    gradeRow = grade as GradeRow | null;
  }
  const eyebrowText = [gradeRow?.name, lessonRow?.name, unitRow?.title].filter(Boolean).join(' · ').toLocaleUpperCase('tr-TR');

  const { data: topicContent } = await supabase
    .from('topic_contents')
    .select('id, title, subtitle, hero_image_url')
    .eq('topic_id', topicRow.id)
    .maybeSingle();
  const topicContentRow = topicContent as TopicContentRow | null;
  if (!topicContentRow) return { ok: false, status: 404, error: 'Bu konu için içerik hazırlanmamış' };

  const [{ data: sectionsData }, { data: tipData }, { data: highlightsData }, { data: outcomesData }, { data: wrapData }] = await Promise.all([
    supabase
      .from('topic_content_sections')
      .select('id, order_no, heading, body_markdown, review_summary, image_url, diagram_svg, activity_prompt_markdown, activity_example_markdown')
      .eq('topic_content_id', topicContentRow.id)
      .order('order_no', { ascending: true }),
    supabase.from('topic_content_tips').select('title, content').eq('topic_content_id', topicContentRow.id).maybeSingle(),
    supabase
      .from('topic_content_highlights')
      .select('title, description')
      .eq('topic_content_id', topicContentRow.id)
      .order('order_no', { ascending: true })
      .limit(MAX_CONCEPTS),
    supabase
      .from('outcomes')
      .select('description')
      .eq('topic_id', topicRow.id)
      .eq('is_current', true)
      .order('order_index', { ascending: true }),
    supabase.from('topic_contents').select('summary_markdown, discussion_prompt_markdown').eq('id', topicContentRow.id).maybeSingle(),
  ]);
  const sections = (sectionsData as (SectionRow & ActivityRow)[] | null) || [];
  const tipRow = tipData as TipRow | null;
  const highlights = ((highlightsData as HighlightRow[] | null) || []).filter((h) => h.title?.trim() && h.description?.trim());
  const outcomes = ((outcomesData as OutcomeRow[] | null) || []).map((o) => o.description.trim()).filter(Boolean);
  const wrap = wrapData as TopicWrapRow | null;

  if (!sections.length) return { ok: false, status: 404, error: 'Bu konuda henüz alt başlık yok' };

  let hasStaleSections = false;
  const slides: SlideDeckSlide[] = [
    {
      kind: 'cover',
      heading: topicRow.title,
      subtitle: topicContentRow.subtitle,
      bullets: [],
      imageUrl: topicContentRow.hero_image_url,
      diagramSvg: null,
      minutes: SLIDE_MINUTES.cover(),
    },
  ];

  if (outcomes.length) {
    const shown = outcomes.slice(0, MAX_OBJECTIVES);
    const hidden = outcomes.length - shown.length;
    slides.push({
      kind: 'objectives',
      heading: 'Bu derste neler öğreneceğiz?',
      subtitle: hidden > 0 ? `+${hidden} kazanım daha` : null,
      bullets: shown,
      imageUrl: null,
      diagramSvg: null,
      minutes: SLIDE_MINUTES.objectives(),
    });
  }

  if (highlights.length) {
    const items = highlights.map((h) => ({ term: h.title.trim(), description: h.description.trim() }));
    slides.push({
      kind: 'concepts',
      heading: 'Anahtar kavramlar',
      subtitle: null,
      bullets: items.map((i) => `${i.term}: ${i.description}`),
      imageUrl: null,
      diagramSvg: null,
      items,
      minutes: SLIDE_MINUTES.concepts(items.length),
    });
  }

  for (const section of sections) {
    const { bullets, stale } = deriveBullets(section);
    if (stale) hasStaleSections = true;
    slides.push({
      kind: 'section',
      heading: section.heading,
      subtitle: null,
      bullets,
      imageUrl: section.image_url,
      diagramSvg: section.diagram_svg,
      minutes: SLIDE_MINUTES.section(bullets.length, !!(section.image_url || section.diagram_svg)),
    });

    if (section.activity_prompt_markdown?.trim()) {
      const { label, text } = parseActivity(section.activity_prompt_markdown);
      const example = section.activity_example_markdown?.trim() ? stripMarkdown(section.activity_example_markdown) : null;
      slides.push({
        kind: 'activity',
        heading: section.heading,
        subtitle: null,
        bullets: example ? [`${label}: ${text}`, `Örnek yaklaşım: ${example}`] : [`${label}: ${text}`],
        imageUrl: null,
        diagramSvg: null,
        label,
        reveal: example,
        minutes: SLIDE_MINUTES.activity(),
      });
    }
  }

  if (wrap?.summary_markdown?.trim()) {
    const { bullets, items } = parseSummary(wrap.summary_markdown);
    if (bullets.length) {
      slides.push({
        kind: 'summary',
        heading: 'Konuyu toparlayalım',
        subtitle: null,
        bullets,
        imageUrl: null,
        diagramSvg: null,
        items,
        minutes: SLIDE_MINUTES.summary(),
      });
    }
  }

  if (wrap?.discussion_prompt_markdown?.trim()) {
    slides.push({
      kind: 'discussion',
      heading: 'Tartışalım',
      subtitle: null,
      bullets: [stripMarkdown(wrap.discussion_prompt_markdown)],
      imageUrl: null,
      diagramSvg: null,
      minutes: SLIDE_MINUTES.discussion(),
    });
  }

  const fitted = fitToTimeBudget(slides);

  return {
    ok: true,
    topicContentId: topicContentRow.id,
    deck: {
      topicTitle: topicRow.title,
      eyebrowText,
      slides: fitted,
      tip: tipRow?.content ? { title: tipRow.title, content: tipRow.content } : null,
      hasStaleSections,
      estimatedMinutes: Math.round(sumMinutes(fitted)),
    },
  };
}
