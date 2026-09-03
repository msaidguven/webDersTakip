import type { SupabaseClient } from '@supabase/supabase-js';
import { markdownToHtml } from '@/app/src/lib/topicContentV11';

type WeekOutcomeRow = { outcome_id: number };
type OutcomeRow = {
  id: number;
  description: string;
  topic_id: number;
  order_index: number | null;
};
type TopicRow = { id: number; title: string; slug: string | null; order_no: number };
type TopicContentRow = { id: number; topic_id: number; hero_image_url: string | null; subtitle: string | null; generation_meta: unknown };
type SectionRow = {
  id: number;
  topic_content_id: number;
  order_no: number;
  heading: string;
  body_markdown: string | null;
  image_url: string | null;
  image_prompt: string | null;
  image_alt: string | null;
  diagram_svg: string | null;
};
type HighlightRow = {
  topic_content_id: number;
  icon: string | null;
  title: string;
  description: string;
  order_no: number;
};

export type LessonWeekOutcome = { id: number; description: string; topicId: number | null; topicTitle: string };
export type LessonWeekSection = { id: number; heading: string; html: string | null; imageUrl: string | null; imagePrompt: string | null; imageAlt: string | null; diagramSvg: string | null };
export type LessonWeekContent = {
  id: number;
  title: string;
  slug: string | null;
  content: string | null;
  orderNo: number;
  sections: LessonWeekSection[];
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  subtitle: string | null;
  highlights: { icon: string | null; title: string; description: string }[];
  // false ise bu konunun section/highlight içeriği henüz çekilmedi (bkz. activeTopic parametresi) —
  // sidebar'da başlık/slug göstermek için yeterli ama tam içerik client tarafında ayrıca yüklenmeli.
  contentLoaded: boolean;
};

function extractHeroImageAlt(generationMeta: unknown): string | null {
  if (!generationMeta || typeof generationMeta !== 'object') return null;
  const val = (generationMeta as Record<string, unknown>).heroImageAlt;
  return typeof val === 'string' && val.trim() ? val : null;
}

// activeTopic verilirse (id ve/veya slug) SADECE o konunun ağır içeriği (topic_contents,
// section, highlight) çekilir; ünitedeki diğer konular sidebar/ilerleme için gerekli olan
// başlık+slug ile hafif (contentLoaded:false) döner. Verilmezse (ör. hafta değişimi veya
// başka bir ünitenin arkaplanda ısıtılması) eskisi gibi ünitedeki TÜM konuların tam içeriği
// çekilir — bu yüzden parametre opsiyonel ve geriye dönük uyumlu.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getLessonWeekData(supabase: SupabaseClient<any, any, any>, unitId: number, week: number, isAdmin = false, activeTopic?: { id?: number; slug?: string } | null) {
  let topicsQuery = supabase
    .from('topics')
    .select('id, title, slug, order_no')
    .eq('unit_id', unitId)
    .order('order_no', { ascending: true });
  if (!isAdmin) topicsQuery = topicsQuery.eq('is_active', true);

  const [
    { data: topicsData },
    { data: weekOutcomes },
  ] = await Promise.all([
    topicsQuery,
    supabase
      .from('outcome_weeks')
      .select('outcome_id')
      .lte('start_week', week)
      .gte('end_week', week),
  ]);

  const topics = (topicsData as TopicRow[] | null) || [];
  const topicIds = topics.map((t) => t.id);
  const topicTitleById = new Map(topics.map((topic) => [topic.id, topic.title]));

  // activeTopic verilmişse ağır içerik sorgusunu SADECE o konuya daraltıyoruz — ünitedeki
  // diğer konuların tam içeriğini (section/highlight, markdown->HTML render dahil) her sayfa
  // açılışında gereksiz yere çekmemek için (bkz. dosya başındaki açıklama).
  let resolvedActiveTopicId = activeTopic?.id ?? null;
  if (resolvedActiveTopicId == null && activeTopic?.slug) {
    resolvedActiveTopicId = topics.find((t) => t.slug === activeTopic.slug)?.id ?? null;
  }
  const contentTopicIds = resolvedActiveTopicId != null ? topicIds.filter((id) => id === resolvedActiveTopicId) : topicIds;
  const loadedTopicIds = new Set(contentTopicIds);

  let topicContentsQuery = supabase
    .from('topic_contents')
    .select('id, topic_id, hero_image_url, subtitle, generation_meta')
    .in('topic_id', contentTopicIds);
  if (!isAdmin) topicContentsQuery = topicContentsQuery.eq('is_published', true);

  // outcomes ve topic_contents sorguları birbirinden bağımsız (ikisi de sadece yukarıda
  // hesaplanan id listelerine bağlı) — sıralı değil paralel çekiyoruz.
  const [{ data: outcomesData }, { data: topicContentsData }] = await Promise.all([
    topicIds.length
      ? supabase
          .from('outcomes')
          .select('id, description, topic_id, order_index')
          .in('topic_id', topicIds)
          .order('order_index', { ascending: true })
      : Promise.resolve({ data: [] as OutcomeRow[] }),
    contentTopicIds.length ? topicContentsQuery : Promise.resolve({ data: [] as TopicContentRow[] }),
  ]);

  let outcomes: LessonWeekOutcome[] = [];

  if (topicIds.length) {
    const allTopicOutcomesRaw = (outcomesData as OutcomeRow[] | null) || [];

    // order_index her konuda 1'den başlar (konuya özel) — birden fazla konunun kazanımlarını
    // tek sorguda çekip SADECE order_index'e göre sıralamak, aynı order_index değerine sahip
    // farklı konuların kazanımlarını birbirine karıştırır (ör. konu A'nın 2. kazanımı, konu
    // B'nin 1. kazanımından önce/sonra rastgele düşebilir). Bunun yerine kazanımları önce
    // konuya göre grupluyor, sonra topics dizisini (zaten order_no'ya göre sıralı) baz alarak
    // doğru müfredat sırasıyla diziyoruz (bkz. app/api/lesson-outcomes/route.ts'teki aynı düzeltme).
    const outcomesByTopic = new Map<number, OutcomeRow[]>();
    for (const o of allTopicOutcomesRaw) {
      const list = outcomesByTopic.get(o.topic_id) || [];
      list.push(o);
      outcomesByTopic.set(o.topic_id, list);
    }
    const allTopicOutcomes = topics.flatMap((t) => outcomesByTopic.get(t.id) || []);

    const weekOutcomeIds = new Set(((weekOutcomes as WeekOutcomeRow[] | null) || []).map((w) => w.outcome_id));
    const weekMatchedOutcomes = allTopicOutcomes.filter((outcome) => weekOutcomeIds.has(outcome.id));
    const filtered = weekMatchedOutcomes.length ? weekMatchedOutcomes : allTopicOutcomes;

    outcomes = filtered.map((o) => ({
      id: o.id,
      description: o.description,
      topicId: o.topic_id,
      topicTitle: topicTitleById.get(o.topic_id) || '',
    }));
  }

  let contents: LessonWeekContent[] = topics.map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    content: null,
    orderNo: t.order_no,
    sections: [],
    heroImageUrl: null,
    heroImageAlt: null,
    subtitle: null,
    highlights: [],
    contentLoaded: false,
  }));

  if (contentTopicIds.length) {
    const topicContentRows = (topicContentsData as TopicContentRow[] | null) || [];
    const topicIdByContentId = new Map(topicContentRows.map((tc) => [tc.id, tc.topic_id]));
    const contentIds = topicContentRows.map((tc) => tc.id);

    const heroByTopic = new Map<number, { heroImageUrl: string | null; heroImageAlt: string | null; subtitle: string | null }>();
    for (const tc of topicContentRows) {
      heroByTopic.set(tc.topic_id, {
        heroImageUrl: tc.hero_image_url,
        heroImageAlt: extractHeroImageAlt(tc.generation_meta),
        subtitle: tc.subtitle,
      });
    }

    const sectionsByTopic = new Map<number, LessonWeekSection[]>();
    const highlightsByTopic = new Map<number, { icon: string | null; title: string; description: string }[]>();

    if (contentIds.length) {
      const [{ data: sectionsData, error: sectionsError }, { data: highlightsData }] = await Promise.all([
        supabase
          .from('topic_content_sections')
          .select('id, topic_content_id, order_no, heading, body_markdown, image_url, image_prompt, image_alt, diagram_svg')
          .in('topic_content_id', contentIds)
          .order('order_no', { ascending: true }),
        supabase
          .from('topic_content_highlights')
          .select('topic_content_id, icon, title, description, order_no')
          .in('topic_content_id', contentIds)
          .order('order_no', { ascending: true }),
      ]);

      // Sorgu bir sebeple (ör. eksik migration) hata verirse sessizce boş alt başlık
      // listesine düşmek yerine logluyoruz — aksi halde TÜM konularda alt başlık/içerik
      // aynı anda kaybolur ve neden anlaşılmaz.
      if (sectionsError) {
        console.error('[getLessonWeekData] topic_content_sections sorgusu başarısız:', sectionsError.message);
      }

      for (const row of (sectionsData as SectionRow[] | null) || []) {
        const topicId = topicIdByContentId.get(row.topic_content_id);
        if (!topicId) continue;
        const list = sectionsByTopic.get(topicId) || [];
        list.push({
          id: row.id,
          heading: row.heading,
          html: row.body_markdown ? markdownToHtml(row.body_markdown) : null,
          imageUrl: row.image_url,
          imagePrompt: row.image_prompt,
          imageAlt: row.image_alt,
          diagramSvg: row.diagram_svg,
        });
        sectionsByTopic.set(topicId, list);
      }

      for (const row of (highlightsData as HighlightRow[] | null) || []) {
        const topicId = topicIdByContentId.get(row.topic_content_id);
        if (!topicId) continue;
        const list = highlightsByTopic.get(topicId) || [];
        list.push({ icon: row.icon, title: row.title, description: row.description });
        highlightsByTopic.set(topicId, list);
      }
    }

    contents = contents.map((c) => ({
      ...c,
      sections: sectionsByTopic.get(c.id) || [],
      heroImageUrl: heroByTopic.get(c.id)?.heroImageUrl || null,
      heroImageAlt: heroByTopic.get(c.id)?.heroImageAlt || null,
      subtitle: heroByTopic.get(c.id)?.subtitle || null,
      highlights: highlightsByTopic.get(c.id) || [],
      contentLoaded: loadedTopicIds.has(c.id),
    }));
  }

  return { outcomes, contents };
}
