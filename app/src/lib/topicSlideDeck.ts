import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_BULLETS = 5;

export type SlideDeckSlide = {
  kind: 'cover' | 'section';
  heading: string;
  subtitle: string | null;
  bullets: string[];
  imageUrl: string | null;
  diagramSvg: string | null;
};

export type SlideDeckTip = { title: string; content: string };

export type SlideDeck = {
  topicTitle: string;
  eyebrowText: string;
  slides: SlideDeckSlide[];
  tip: SlideDeckTip | null;
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

  const [{ data: sectionsData }, { data: tipData }] = await Promise.all([
    supabase
      .from('topic_content_sections')
      .select('id, order_no, heading, body_markdown, review_summary, image_url, diagram_svg')
      .eq('topic_content_id', topicContentRow.id)
      .order('order_no', { ascending: true }),
    supabase.from('topic_content_tips').select('title, content').eq('topic_content_id', topicContentRow.id).maybeSingle(),
  ]);
  const sections = (sectionsData as SectionRow[] | null) || [];
  const tipRow = tipData as TipRow | null;

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
    },
    ...sections.map((section): SlideDeckSlide => {
      const { bullets, stale } = deriveBullets(section);
      if (stale) hasStaleSections = true;
      return {
        kind: 'section',
        heading: section.heading,
        subtitle: null,
        bullets,
        imageUrl: section.image_url,
        diagramSvg: section.diagram_svg,
      };
    }),
  ];

  return {
    ok: true,
    topicContentId: topicContentRow.id,
    deck: {
      topicTitle: topicRow.title,
      eyebrowText,
      slides,
      tip: tipRow?.content ? { title: tipRow.title, content: tipRow.content } : null,
      hasStaleSections,
    },
  };
}
