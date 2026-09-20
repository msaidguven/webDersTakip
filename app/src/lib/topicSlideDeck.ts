import type { SupabaseClient } from '@supabase/supabase-js';
import { generateTopicContentJson } from '@/app/src/lib/geminiContentGen';

const MAX_BULLETS = 5;
export const SLIDE_DECK_AI_MODEL = 'gemini-3.6-flash';

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
  image_url: string | null;
  diagram_svg: string | null;
};
type TipRow = { title: string; content: string };
type SlideBullets = { heading: string; bullets: string[] };

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

// Gemini'yi kısa tutmak ve extractJson'ın (sadece { ... } eşleyen) beklediği tekil obje
// biçimine uysun diye dizi yerine {"slides": [...]} dönmesini istiyoruz.
async function summarizeToSlides(sections: SectionRow[]): Promise<Map<number, string[]>> {
  const input = sections
    .map((s, i) => `${i + 1}. Başlık: ${s.heading}\nİçerik: ${stripMarkdown(s.body_markdown || '').slice(0, 2000)}`)
    .join('\n\n');

  const prompt = `Aşağıda bir ders konusunun alt başlıkları ve içerik metinleri var. Her alt başlık için, öğretmenin sınıfta anlatırken slaytta gösterebileceği ${MAX_BULLETS} maddeyi ASLA GEÇMEYECEK şekilde kısa madde listesi hazırla. Her madde en fazla 12 kelime, sade ve öğrenci seviyesine uygun Türkçe olsun; sadece en önemli kavram/bilgiyi seç, tam cümle kurma zorunluluğu yok.

Sadece şu JSON formatında dön, başka hiçbir açıklama yazma:
{"slides": [{"heading": "<alt başlığın birebir aynısı>", "bullets": ["...", "..."]}]}

Alt başlıklar:
${input}`;

  try {
    const raw = await generateTopicContentJson(prompt);
    const slides = (raw as { slides?: unknown })?.slides;
    const map = new Map<number, string[]>();
    if (Array.isArray(slides)) {
      slides.forEach((s) => {
        const heading = (s as SlideBullets)?.heading;
        const bullets = (s as SlideBullets)?.bullets;
        const match = sections.find((sec) => sec.heading === heading);
        if (match && Array.isArray(bullets)) {
          map.set(match.id, bullets.filter((b): b is string => typeof b === 'string').slice(0, MAX_BULLETS));
        }
      });
    }
    return map;
  } catch {
    // AI özetleyemezse slayt boş kalmasın diye içerikten kaba bir madde listesine düş.
    return new Map();
  }
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
      .select('id, order_no, heading, body_markdown, image_url, diagram_svg')
      .eq('topic_content_id', topicContentRow.id)
      .order('order_no', { ascending: true }),
    supabase.from('topic_content_tips').select('title, content').eq('topic_content_id', topicContentRow.id).maybeSingle(),
  ]);
  const sections = (sectionsData as SectionRow[] | null) || [];
  const tipRow = tipData as TipRow | null;

  if (!sections.length) return { ok: false, status: 404, error: 'Bu konuda henüz alt başlık yok' };

  const bulletsBySection = await summarizeToSlides(sections);

  const slides: SlideDeckSlide[] = [
    {
      kind: 'cover',
      heading: topicRow.title,
      subtitle: topicContentRow.subtitle,
      bullets: [],
      imageUrl: topicContentRow.hero_image_url,
      diagramSvg: null,
    },
    ...sections.map((section): SlideDeckSlide => ({
      kind: 'section',
      heading: section.heading,
      subtitle: null,
      bullets: bulletsBySection.get(section.id)?.length ? bulletsBySection.get(section.id)! : fallbackBullets(section.body_markdown),
      imageUrl: section.image_url,
      diagramSvg: section.diagram_svg,
    })),
  ];

  return {
    ok: true,
    topicContentId: topicContentRow.id,
    deck: {
      topicTitle: topicRow.title,
      eyebrowText,
      slides,
      tip: tipRow?.content ? { title: tipRow.title, content: tipRow.content } : null,
    },
  };
}
