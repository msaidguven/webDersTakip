import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type TopicRow = { id: number; title: string; unit_id: number; order_no: number | null };
type DocRow = { id: number; topic_id: number; raw_text: string; created_at: string };
type OutcomeRow = { topic_id: number; code: string | null; description: string };

// Ünite İçi Tekrar Kontrolü'nün (unit-dedup-prompt/route.ts) RAG kaynak metni seviyesindeki
// karşılığı: topic_content_sections (yayınlanan içerik) değil, rag_documents.raw_text
// (18/19. adımların ürettiği, öğrenci sorularını cevaplamakta kullanılan "sanal kitap"
// kaynağı) üzerinde çalışır. Kullanıcının 2026-09-13 bulduğu ayrım: içerik seviyesindeki
// düzeltme kaynağı değiştirmediği için, konu tekrar üretilirse (İçeriği Güncelle) veya RAG
// soru-cevabı bu kaynağı aradığı sürece aynı tekrar geri gelir/görünür — bu route kökten
// (kaynakta) düzeltiyor.
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
      .select('id, title, unit_id, order_no')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .order('order_no', { ascending: true }),
  ]);

  const topics = (topicsData as TopicRow[] | null) || [];
  const topicIds = topics.map((t) => t.id);
  if (topicIds.length < 2) {
    return NextResponse.json({ error: 'Bu ünitede karşılaştırılacak yeterli konu yok (en az 2 aktif konu gerekli).' }, { status: 400 });
  }

  const [{ data: docsData }, { data: outcomesData }] = await Promise.all([
    supabase
      .from('rag_documents')
      .select('id, topic_id, raw_text, created_at')
      .in('topic_id', topicIds)
      .eq('source', 'ai_generated')
      .eq('is_synthesis', true)
      .order('created_at', { ascending: false }),
    supabase.from('outcomes').select('topic_id, code, description').in('topic_id', topicIds),
  ]);

  // Bir konu için birden fazla sentez satırı olmamalı (topic-source-synthesis eskisini
  // sildikten sonra yenisini bırakıyor) ama sıra garantisi için en yeniyi (created_at DESC)
  // alıp aynı topic_id'nin fazlasını görmezden geliyoruz.
  const docByTopicId = new Map<number, DocRow>();
  for (const d of (docsData as DocRow[] | null) || []) {
    if (!docByTopicId.has(d.topic_id)) docByTopicId.set(d.topic_id, d);
  }

  const outcomesByTopicId = new Map<number, OutcomeRow[]>();
  for (const o of (outcomesData as OutcomeRow[] | null) || []) {
    const list = outcomesByTopicId.get(o.topic_id) || [];
    list.push(o);
    outcomesByTopicId.set(o.topic_id, list);
  }

  // "2. ünite yarım" gibi henüz RAG sentezi tamamlanmamış konular sessizce atlanıyor.
  const qualifyingTopics: { topic: TopicRow; doc: DocRow }[] = [];
  const skippedTopics: string[] = [];
  for (const topic of topics) {
    const doc = docByTopicId.get(topic.id);
    if (doc) {
      qualifyingTopics.push({ topic, doc });
    } else {
      skippedTopics.push(topic.title);
    }
  }

  if (qualifyingTopics.length < 2) {
    return NextResponse.json(
      { error: 'Bu ünitede RAG kaynak metni sentezi tamamlanmış en az 2 konu yok — karşılaştırılacak yeterli malzeme bulunmuyor.' },
      { status: 400 }
    );
  }

  const topicsBlock = qualifyingTopics
    .map(({ topic, doc }) => {
      const outcomes = outcomesByTopicId.get(topic.id) || [];
      const outcomesText = outcomes.length
        ? outcomes.map((o) => (o.code ? `${o.code}. ${o.description}` : o.description)).join(' | ')
        : '(kazanım tanımlı değil)';
      return `### Konu: ${topic.title} (topic_id=${topic.id})\nKazanımlar: ${outcomesText}\n\n${doc.raw_text}`;
    })
    .join('\n\n---\n\n');

  const templatePath = path.join(process.cwd(), 'app', 'prompt', '26-rag-unit-source-dedup.md');
  const template = await readFile(templatePath, 'utf8');

  const prompt = template
    .replaceAll('{grade}', grade?.name || '')
    .replaceAll('{lesson}', lesson?.name || '')
    .replaceAll('{unit}', unit.title)
    .replaceAll('{topics_block}', topicsBlock);

  // Admin panelin diff (eski/yeni) gösterebilmesi için mevcut hâlini de aynı yanıtta veriyoruz.
  const currentByTopicId = qualifyingTopics.map(({ topic, doc }) => ({
    topicId: topic.id,
    topicTitle: topic.title,
    rawText: doc.raw_text,
  }));

  return NextResponse.json({
    prompt,
    unitId,
    gradeId: unit.grade_id,
    lessonId: unit.lesson_id,
    unitTitle: unit.title,
    includedTopics: qualifyingTopics.map((q) => q.topic.title),
    skippedTopics,
    currentByTopicId,
  });
}
