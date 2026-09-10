import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// 2-3 farklı AI'ın (topic-source-prompt/route.ts çıktısını ayrı ayrı verip DB'ye
// kaydettiğimiz) bağımsız ürettiği kaynak taslaklarını (rag_documents.raw_text, source=
// 'ai_generated', is_synthesis=false, topic_id=X) tek bir sentez metnine birleştiren
// prompt'u (19-rag-topic-source-synthesis.md) doldurur — admin artık kaynakları elle
// yapıştırmıyor, hepsi zaten DB'de, tek tıkla kopyalanabilir tam prompt burada üretiliyor.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = Number(request.nextUrl.searchParams.get('topicId'));
  if (!Number.isFinite(topicId)) return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: topic } = await supabase.from('topics').select('id, title, unit_id').eq('id', topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });

  const { data: unit } = await supabase.from('units').select('id, title, grade_id, lesson_id').eq('id', topic.unit_id).maybeSingle();
  if (!unit) return NextResponse.json({ error: 'Ünite bulunamadı' }, { status: 404 });

  const [{ data: grade }, { data: lesson }, { data: draftsData }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', unit.grade_id).maybeSingle(),
    supabase.from('lessons').select('name').eq('id', unit.lesson_id).maybeSingle(),
    supabase
      .from('rag_documents')
      .select('id, title, raw_text, created_at')
      .eq('topic_id', topicId)
      .eq('source', 'ai_generated')
      .eq('is_synthesis', false)
      .order('created_at', { ascending: true }),
  ]);

  const drafts = ((draftsData as { id: number; title: string; raw_text: string | null; created_at: string }[] | null) || []).filter((d) => !!d.raw_text?.trim());

  if (drafts.length < 2) {
    return NextResponse.json(
      { error: `Bu konu için en az 2 kaynak taslağı gerekiyor, şu an ${drafts.length} var — önce "RAG Kaynak Metni" ile taslak ekleyin.` },
      { status: 400 }
    );
  }

  const sourcesBlock = drafts
    .map((d, i) => `KAYNAK METİN ${i + 1}:\n${d.raw_text!.trim()}`)
    .join('\n\n');

  const templatePath = path.join(process.cwd(), 'app', 'prompt', '19-rag-topic-source-synthesis.md');
  const template = await readFile(templatePath, 'utf8');

  const prompt = template
    .replaceAll('{grade}', grade?.name || '')
    .replaceAll('{lesson}', lesson?.name || '')
    .replaceAll('{unit}', unit.title)
    .replaceAll('{topic}', topic.title)
    .replaceAll('{sources_block}', sourcesBlock);

  return NextResponse.json({
    prompt,
    topicTitle: topic.title,
    unitId: unit.id,
    gradeId: unit.grade_id,
    lessonId: unit.lesson_id,
    draftCount: drafts.length,
    drafts: drafts.map((d) => ({ id: d.id, title: d.title, createdAt: d.created_at })),
  });
}
