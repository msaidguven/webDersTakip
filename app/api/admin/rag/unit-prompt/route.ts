import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// 50MB Storage limitini aşan PDF'ler için: admin bu prompt'u NotebookLM'e
// (kaynak olarak kitabın PDF'ini yüklediği notebook'ta) sorar, dönen düz metni
// /api/admin/rag/documents/from-text ile sisteme kaydeder.
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

  const [{ data: grade }, { data: lesson }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', unit.grade_id).maybeSingle(),
    supabase.from('lessons').select('name').eq('id', unit.lesson_id).maybeSingle(),
  ]);

  // Ünitenin bizim sistemimizdeki gerçek konu/alt başlık listesi — NotebookLM'e kitabın
  // KENDİ bölüm/etkinlik adları yerine bunları kullanmasını söylüyoruz (kullanıcının
  // 2026-09-08 bulduğu sorun: kitap "Farklı Dinamometrelerle Ölçüm Yapalım" gibi kendi
  // etkinlik adlarıyla anlatınca, bizim "Dinamometrenin Yapısı" / "Hassas Ölçüm" gibi ayrı
  // alt başlıklarımızla örtüşüyordu).
  const { data: topics } = await supabase
    .from('topics')
    .select('id, title, order_no')
    .eq('unit_id', unitId)
    .eq('is_active', true)
    .order('order_no', { ascending: true });
  const topicRows = (topics as { id: number; title: string; order_no: number | null }[] | null) || [];

  const topicIds = topicRows.map((t) => t.id);
  const { data: topicContents } = topicIds.length
    ? await supabase.from('topic_contents').select('id, topic_id').in('topic_id', topicIds)
    : { data: [] as { id: number; topic_id: number }[] };
  const topicContentRows = (topicContents as { id: number; topic_id: number }[] | null) || [];
  const topicContentIdByTopicId = new Map(topicContentRows.map((tc) => [tc.topic_id, tc.id]));

  const topicContentIds = topicContentRows.map((tc) => tc.id);
  const { data: sections } = topicContentIds.length
    ? await supabase.from('topic_content_sections').select('topic_content_id, heading, order_no').in('topic_content_id', topicContentIds).order('order_no', { ascending: true })
    : { data: [] as { topic_content_id: number; heading: string; order_no: number | null }[] };
  const sectionRows = (sections as { topic_content_id: number; heading: string; order_no: number | null }[] | null) || [];
  const headingsByTopicContentId = new Map<number, string[]>();
  for (const s of sectionRows) {
    const list = headingsByTopicContentId.get(s.topic_content_id) || [];
    list.push(s.heading);
    headingsByTopicContentId.set(s.topic_content_id, list);
  }

  const sectionHeadingsText = topicRows
    .map((t) => {
      const topicContentId = topicContentIdByTopicId.get(t.id);
      const headings = topicContentId != null ? headingsByTopicContentId.get(topicContentId) || [] : [];
      if (!headings.length) return null;
      return `- ${t.title}\n${headings.map((h) => `  - ${h}`).join('\n')}`;
    })
    .filter((s): s is string => !!s)
    .join('\n');

  const templatePath = path.join(process.cwd(), 'app', 'prompt', '13-rag-unit-text.md');
  const template = await readFile(templatePath, 'utf8');

  const prompt = template
    .replaceAll('{grade}', grade?.name || '')
    .replaceAll('{lesson}', lesson?.name || '')
    .replaceAll('{unit}', unit.title)
    .replaceAll('{section_headings}', sectionHeadingsText || 'Bu ünite için henüz alt başlık planı oluşturulmamış.');

  return NextResponse.json({
    prompt,
    unitTitle: unit.title,
    gradeId: unit.grade_id,
    lessonId: unit.lesson_id,
  });
}
