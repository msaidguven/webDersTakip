import type { SupabaseClient } from '@supabase/supabase-js';
import { markdownToHtml } from '@/app/src/lib/topicContentV11';

type WeekOutcomeRow = { outcome_id: number };
type OutcomeRow = {
  id: number;
  description: string;
  topic_id: number;
  order_index: number | null;
};
type TopicRow = { id: number; title: string; slug: string | null; order_no: number; is_archived: boolean };
type TopicContentRow = {
  id: number;
  topic_id: number;
  hero_image_url: string | null;
  subtitle: string | null;
  generation_meta: unknown;
  summary_markdown: string | null;
  discussion_prompt_markdown: string | null;
};
type SectionRow = {
  id: number;
  topic_content_id: number;
  order_no: number;
  heading: string;
  body_markdown: string | null;
  notebook_markdown: string | null;
  activity_prompt_markdown: string | null;
  activity_example_markdown: string | null;
  image_url: string | null;
  image_prompt: string | null;
  image_alt: string | null;
  diagram_svg: string | null;
  video_url: string | null;
  video_prompt: string | null;
  video_type: string | null;
};
type HighlightRow = {
  topic_content_id: number;
  icon: string | null;
  title: string;
  description: string;
  order_no: number;
};

export type LessonWeekOutcome = { id: number; description: string; topicId: number | null; topicTitle: string };
export type LessonWeekSection = {
  id: number;
  heading: string;
  html: string | null;
  notebookHtml: string | null;
  // Bundan sonra üretilen içerikte notebookHtml'in yerini alan "Düşün/Hayal Et/Dene"
  // etkinlik kutusu — eski konularda ikisi de null kalır (bkz. topic_activity_and_summary.sql).
  activityPromptHtml: string | null;
  activityExampleHtml: string | null;
  imageUrl: string | null;
  imagePrompt: string | null;
  imageAlt: string | null;
  diagramSvg: string | null;
  videoUrl: string | null;
  videoPrompt: string | null;
  videoType: 'ai_generated' | 'youtube' | null;
};
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
  // Konu sonunda gösterilen tek toplu "Konu Özeti" — eski konularda null (notebookHtml'ler
  // üzerinden alt başlık bazlı gösterime düşülür, bkz. SectionContent.tsx).
  summaryHtml: string | null;
  // Konu sonundaki "Düşün ve Yorumla" kapanış sorusu — var olan tartışma bölümüne bağlanır
  // (bkz. DersClient.tsx). Eski konularda null.
  discussionPromptHtml: string | null;
  highlights: { icon: string | null; title: string; description: string }[];
  // false ise bu konunun section/highlight içeriği henüz çekilmedi (bkz. activeTopic parametresi) —
  // sidebar'da başlık/slug göstermek için yeterli ama tam içerik client tarafında ayrıca yüklenmeli.
  contentLoaded: boolean;
  // Konu artık güncel müfredatta değil ama sayfası hâlâ canlı — bkz. topics.is_archived.
  isArchived: boolean;
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
    .select('id, title, slug, order_no, is_archived')
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

  // Arşivlenmiş konular normal navigasyondan (sidebar/hafta listesi) gizlenir — AMA
  // doğrudan açılan konu (activeTopic) arşivli olsa bile kendi sayfası canlı kalmalı
  // (bkz. /farkli-konular). Bu yüzden filtre burada, sorgu seviyesinde DEĞİL, activeTopic'i
  // istisna tutacak şekilde JS tarafında uygulanıyor.
  const allTopics = (topicsData as TopicRow[] | null) || [];
  const topics = !isAdmin
    ? allTopics.filter((t) => !t.is_archived || t.id === activeTopic?.id || (activeTopic?.slug && t.slug === activeTopic.slug))
    : allTopics;
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
    .select('id, topic_id, hero_image_url, subtitle, generation_meta, summary_markdown, discussion_prompt_markdown')
    .in('topic_id', contentTopicIds);
  if (!isAdmin) topicContentsQuery = topicContentsQuery.eq('is_published', true);

  // outcomes ve topic_contents sorguları birbirinden bağımsız (ikisi de sadece yukarıda
  // hesaplanan id listelerine bağlı) — sıralı değil paralel çekiyoruz.
  const [{ data: outcomesData }, { data: topicContentsData, error: topicContentsError }] = await Promise.all([
    topicIds.length
      ? supabase
          .from('outcomes')
          .select('id, description, topic_id, order_index')
          .in('topic_id', topicIds)
          .eq('is_current', true)
          .order('order_index', { ascending: true })
      : Promise.resolve({ data: [] as OutcomeRow[] }),
    contentTopicIds.length ? topicContentsQuery : Promise.resolve({ data: [] as TopicContentRow[], error: null }),
  ]);

  // Bu sorgu hata verirse (ör. eksik migration) topicContentRows/contentIds boş kalır ve
  // AŞAĞIDAKİ sections/highlights sorguları hiç çalışmaz — sessizce "içerik yok" görünmesi
  // yerine (2026-09-15'te fark edilen sessiz regresyon) logluyoruz, TÜM konuların içeriği
  // aynı anda kaybolduğunda kök nedeni teşhis etmek için (bkz. sectionsError loglaması, aynı gerekçe).
  if (topicContentsError) {
    console.error('[getLessonWeekData] topic_contents sorgusu başarısız:', topicContentsError.message);
  }

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
    summaryHtml: null,
    discussionPromptHtml: null,
    highlights: [],
    contentLoaded: false,
    isArchived: t.is_archived,
  }));

  if (contentTopicIds.length) {
    const topicContentRows = (topicContentsData as TopicContentRow[] | null) || [];
    const topicIdByContentId = new Map(topicContentRows.map((tc) => [tc.id, tc.topic_id]));
    const contentIds = topicContentRows.map((tc) => tc.id);

    const heroByTopic = new Map<number, { heroImageUrl: string | null; heroImageAlt: string | null; subtitle: string | null; summaryHtml: string | null; discussionPromptHtml: string | null }>();
    for (const tc of topicContentRows) {
      heroByTopic.set(tc.topic_id, {
        heroImageUrl: tc.hero_image_url,
        heroImageAlt: extractHeroImageAlt(tc.generation_meta),
        subtitle: tc.subtitle,
        summaryHtml: tc.summary_markdown ? markdownToHtml(tc.summary_markdown) : null,
        discussionPromptHtml: tc.discussion_prompt_markdown ? markdownToHtml(tc.discussion_prompt_markdown) : null,
      });
    }

    const sectionsByTopic = new Map<number, LessonWeekSection[]>();
    const highlightsByTopic = new Map<number, { icon: string | null; title: string; description: string }[]>();

    if (contentIds.length) {
      const [{ data: sectionsData, error: sectionsError }, { data: highlightsData }] = await Promise.all([
        supabase
          .from('topic_content_sections')
          .select('id, topic_content_id, order_no, heading, body_markdown, notebook_markdown, activity_prompt_markdown, activity_example_markdown, image_url, image_prompt, image_alt, diagram_svg, video_url, video_prompt, video_type')
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
          notebookHtml: row.notebook_markdown ? markdownToHtml(row.notebook_markdown) : null,
          activityPromptHtml: row.activity_prompt_markdown ? markdownToHtml(row.activity_prompt_markdown) : null,
          activityExampleHtml: row.activity_example_markdown ? markdownToHtml(row.activity_example_markdown) : null,
          imageUrl: row.image_url,
          imagePrompt: row.image_prompt,
          imageAlt: row.image_alt,
          diagramSvg: row.diagram_svg,
          videoUrl: row.video_url,
          videoPrompt: row.video_prompt,
          videoType: row.video_type === 'ai_generated' || row.video_type === 'youtube' ? row.video_type : null,
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
      summaryHtml: heroByTopic.get(c.id)?.summaryHtml || null,
      discussionPromptHtml: heroByTopic.get(c.id)?.discussionPromptHtml || null,
      highlights: highlightsByTopic.get(c.id) || [],
      contentLoaded: loadedTopicIds.has(c.id),
    }));
  }

  return { outcomes, contents };
}
