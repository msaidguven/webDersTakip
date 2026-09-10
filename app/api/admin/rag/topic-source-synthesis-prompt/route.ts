import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// 2-3 farklı AI'ın (topic-source-prompt/route.ts çıktısını ayrı ayrı verdiğimiz) bağımsız
// ürettiği kaynak metinleri tek, tutarlı bir metne birleştiren prompt'u (19-rag-topic-
// source-synthesis.md) doldurur — SADECE {grade}/{lesson}/{unit}/{topic} burada dolduruluyor,
// {source_1}/{source_2}/{source_3} admin'in yapıştıracağı metinler olduğu için client
// tarafında (RagTopicSourceSynthesisModal) dolduruluyor.
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

  const [{ data: grade }, { data: lesson }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', unit.grade_id).maybeSingle(),
    supabase.from('lessons').select('name').eq('id', unit.lesson_id).maybeSingle(),
  ]);

  const templatePath = path.join(process.cwd(), 'app', 'prompt', '19-rag-topic-source-synthesis.md');
  const template = await readFile(templatePath, 'utf8');

  const promptTemplate = template
    .replaceAll('{grade}', grade?.name || '')
    .replaceAll('{lesson}', lesson?.name || '')
    .replaceAll('{unit}', unit.title)
    .replaceAll('{topic}', topic.title);

  return NextResponse.json({
    promptTemplate,
    topicTitle: topic.title,
    unitId: unit.id,
    gradeId: unit.grade_id,
    lessonId: unit.lesson_id,
  });
}
