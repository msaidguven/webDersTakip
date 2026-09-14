import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type SectionRow = { id: number; heading: string; body_markdown: string | null; notebook_markdown: string | null; order_no: number | null };

// "Doğruluk Kontrolü" (27. prompt): yayındaki konu içeriğini, o konunun zaten çoklu-AI ile
// karşılaştırılmış RAG kaynak metniyle (bkz. 18/19. promptlar) karşılaştırıp hata arattırır.
// unit-source-dedup-prompt/route.ts ile aynı desen (şablon dosyası okuma + yer tutucu
// doldurma) — ama tekil konu seviyesinde ve tekrar değil doğruluk arıyor.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = Number(request.nextUrl.searchParams.get('topicId'));
  if (!Number.isFinite(topicId)) return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: topic } = await supabase.from('topics').select('id, title, unit_id, rag_last_checked_at').eq('id', topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });

  const { data: unit } = await supabase.from('units').select('id, title, grade_id, lesson_id').eq('id', topic.unit_id).maybeSingle();
  if (!unit) return NextResponse.json({ error: 'Ünite bulunamadı' }, { status: 404 });

  const [{ data: grade }, { data: lesson }, { data: synthesisDoc }, { data: topicContent }, { data: openFlagsData }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', unit.grade_id).maybeSingle(),
    supabase.from('lessons').select('name').eq('id', unit.lesson_id).maybeSingle(),
    supabase.from('rag_documents').select('raw_text').eq('topic_id', topicId).eq('source', 'ai_generated').eq('is_synthesis', true).maybeSingle(),
    supabase.from('topic_contents').select('id').eq('topic_id', topicId).maybeSingle(),
    supabase
      .from('rag_topic_review_flags')
      .select('id, section_id, note, created_at')
      .eq('topic_id', topicId)
      .eq('kind', 'accuracy_check')
      .is('resolved_at', null)
      .order('created_at', { ascending: false }),
  ]);

  const sourceText = (synthesisDoc as { raw_text: string | null } | null)?.raw_text?.trim();
  if (!sourceText) {
    return NextResponse.json(
      { error: 'Bu konu için henüz sentezlenmiş bir RAG kaynak metni yok — önce "RAG Kaynak Metni Sentezle" ile bir tane oluşturun.' },
      { status: 409 }
    );
  }

  const topicContentId = (topicContent as { id: number } | null)?.id;
  const sections = topicContentId
    ? (
      (
        await supabase
          .from('topic_content_sections')
          .select('id, heading, body_markdown, notebook_markdown, order_no')
          .eq('topic_content_id', topicContentId)
          .order('order_no', { ascending: true })
      ).data as SectionRow[] | null
    ) || []
    : [];

  if (!sections.length) {
    return NextResponse.json({ error: 'Bu konu için henüz yayında alt başlık yok.' }, { status: 409 });
  }

  const sectionsBlock = sections
    .map((s) => {
      const notebook = s.notebook_markdown?.trim();
      return `### ${s.heading} (section_id=${s.id})\n${s.body_markdown?.trim() || '(boş)'}${notebook ? `\n\nDefterine Not Al:\n${notebook}` : ''}`;
    })
    .join('\n\n---\n\n');

  const templatePath = path.join(process.cwd(), 'app', 'prompt', '27-rag-topic-accuracy-check.md');
  const template = await readFile(templatePath, 'utf8');

  const prompt = template
    .replaceAll('{grade}', grade?.name || '')
    .replaceAll('{lesson}', lesson?.name || '')
    .replaceAll('{unit}', unit.title)
    .replaceAll('{topic}', topic.title)
    .replaceAll('{source_text}', sourceText)
    .replaceAll('{sections_block}', sectionsBlock);

  const openFlags = ((openFlagsData as { id: number; section_id: number | null; note: string; created_at: string }[] | null) || []).map((f) => ({
    id: f.id,
    sectionId: f.section_id,
    sectionHeading: sections.find((s) => s.id === f.section_id)?.heading || null,
    note: f.note,
    createdAt: f.created_at,
  }));

  return NextResponse.json({
    prompt,
    topicId,
    sections: sections.map((s) => ({ id: s.id, heading: s.heading })),
    openFlags,
    lastCheckedAt: topic.rag_last_checked_at || null,
  });
}
