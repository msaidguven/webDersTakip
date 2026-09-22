import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type TopicRow = { id: number; title: string; order_no: number | null };
type ContentRow = { id: number; topic_id: number };
type SectionRow = { id: number; topic_content_id: number; order_no: number | null; heading: string; body_markdown: string | null; notebook_markdown: string | null };
type OutcomeRow = { topic_id: number; code: string | null; description: string };

// Aynı ünitenin konuları birbirinden habersiz (kardeş konudan bağımsız) üretildiği için
// aralarında istemeden tekrar eden bilgiler oluşabiliyor (bkz. kullanıcının 2026-09-13
// bulduğu "yapay zekâ nedir" tekrarı, 6. sınıf Bilişim 1. ünite). Bu route, ünitedeki
// içeriği hazır TÜM konuların alt başlıklarını (heading + explanation + notebook) tek
// promptta toplayıp AI'a "tekrarları bul, sadece gerekeni kısalt/güncelle" dedirtiyor —
// 19-rag-topic-source-synthesis.md'nin (bir konunun N taslağını birleştirme) ünite
// seviyesindeki karşılığı (22-rag-unit-dedup.md).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const unitId = Number(request.nextUrl.searchParams.get('unitId'));
  if (!Number.isFinite(unitId)) return NextResponse.json({ error: 'unitId gerekli' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: unit } = await supabase
    .from('units')
    .select('id, title, grade_id, lesson_id')
    .eq('id', unitId)
    .maybeSingle();
  if (!unit) return NextResponse.json({ error: 'Ünite bulunamadı' }, { status: 404 });

  const [{ data: grade }, { data: lesson }, { data: topicsData }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', unit.grade_id).maybeSingle(),
    supabase.from('lessons').select('name').eq('id', unit.lesson_id).maybeSingle(),
    supabase
      .from('topics')
      .select('id, title, order_no')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .order('order_no', { ascending: true }),
  ]);

  const topics = (topicsData as TopicRow[] | null) || [];
  const topicIds = topics.map((t) => t.id);
  if (topicIds.length < 2) {
    return NextResponse.json({ error: 'Bu ünitede karşılaştırılacak yeterli konu yok (en az 2 aktif konu gerekli).' }, { status: 400 });
  }

  const [{ data: contentsData }, { data: outcomesData }] = await Promise.all([
    supabase.from('topic_contents').select('id, topic_id').in('topic_id', topicIds),
    supabase.from('outcomes').select('topic_id, code, description').in('topic_id', topicIds).eq('is_current', true),
  ]);

  const contents = (contentsData as ContentRow[] | null) || [];
  const contentIdByTopicId = new Map(contents.map((c) => [c.topic_id, c.id]));
  const contentIds = contents.map((c) => c.id);

  const { data: sectionsData } = contentIds.length
    ? await supabase
        .from('topic_content_sections')
        .select('id, topic_content_id, order_no, heading, body_markdown, notebook_markdown')
        .in('topic_content_id', contentIds)
        .order('order_no', { ascending: true })
    : { data: [] as SectionRow[] };
  const sections = (sectionsData as SectionRow[] | null) || [];
  const sectionsByContentId = new Map<number, SectionRow[]>();
  for (const s of sections) {
    const list = sectionsByContentId.get(s.topic_content_id) || [];
    list.push(s);
    sectionsByContentId.set(s.topic_content_id, list);
  }

  const outcomesByTopicId = new Map<number, OutcomeRow[]>();
  for (const o of (outcomesData as OutcomeRow[] | null) || []) {
    const list = outcomesByTopicId.get(o.topic_id) || [];
    list.push(o);
    outcomesByTopicId.set(o.topic_id, list);
  }

  // Sadece alt başlığı (içeriği) hazır olan konuları karşılaştırmaya dahil ediyoruz —
  // "2. ünite yarım, ona bakma" dediğinde de otomatik olarak devre dışı kalsın diye
  // içeriksiz/boş konular sessizce atlanıyor, hata vermiyor.
  const qualifyingTopics: { topic: TopicRow; sections: SectionRow[] }[] = [];
  const skippedTopics: string[] = [];
  for (const topic of topics) {
    const contentId = contentIdByTopicId.get(topic.id);
    const topicSections = contentId != null ? sectionsByContentId.get(contentId) || [] : [];
    if (topicSections.length > 0) {
      qualifyingTopics.push({ topic, sections: topicSections });
    } else {
      skippedTopics.push(topic.title);
    }
  }

  if (qualifyingTopics.length < 2) {
    return NextResponse.json(
      { error: 'Bu ünitede içeriği hazır en az 2 konu yok — karşılaştırılacak yeterli malzeme bulunmuyor.' },
      { status: 400 }
    );
  }

  const topicsBlock = qualifyingTopics
    .map(({ topic, sections: topicSections }) => {
      const outcomes = outcomesByTopicId.get(topic.id) || [];
      const outcomesText = outcomes.length
        ? outcomes.map((o) => (o.code ? `${o.code}. ${o.description}` : o.description)).join(' | ')
        : '(kazanım tanımlı değil)';
      const sectionsText = topicSections
        .map(
          (s) =>
            `  (section_id=${s.id}) ${s.heading}\n  Explanation: ${s.body_markdown || '(boş)'}\n  Notebook: ${s.notebook_markdown || '(boş)'}`
        )
        .join('\n\n');
      return `### Konu: ${topic.title}\nKazanımlar: ${outcomesText}\n\n${sectionsText}`;
    })
    .join('\n\n---\n\n');

  const templatePath = path.join(process.cwd(), 'app', 'prompt', '22-rag-unit-dedup.md');
  const template = await readFile(templatePath, 'utf8');

  const prompt = template
    .replaceAll('{grade}', grade?.name || '')
    .replaceAll('{lesson}', lesson?.name || '')
    .replaceAll('{unit}', unit.title)
    .replaceAll('{topics_block}', topicsBlock);

  // Admin panelin diff (eski/yeni) gösterebilmesi için mevcut hâlini de aynı yanıtta veriyoruz —
  // AI'nın döndüreceği section_id'ler üzerinden ayrıca sorgu atmaya gerek kalmıyor.
  const currentSections = qualifyingTopics.flatMap(({ topic, sections: topicSections }) =>
    topicSections.map((s) => ({
      sectionId: s.id,
      topicTitle: topic.title,
      heading: s.heading,
      explanationMarkdown: s.body_markdown || '',
      notebookMarkdown: s.notebook_markdown || '',
    }))
  );

  return NextResponse.json({
    prompt,
    unitTitle: unit.title,
    includedTopics: qualifyingTopics.map((q) => q.topic.title),
    skippedTopics,
    currentSections,
  });
}
