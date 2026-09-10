import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// MEB'in kitap yayınlamadığı dersler için: unit-prompt (13-rag-unit-text.md) "kitaptan
// çıkar" diyordu, bu route ise "kitap yok, kazanımlara dayanarak SEN yaz" promptu üretir
// (18-rag-topic-source-notext.md). Admin bu prompt'u dışarıda bir AI'a sorar, dönen düz
// metni /api/admin/rag/documents/from-text ile (source='ai_generated') sisteme kaydeder.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = Number(request.nextUrl.searchParams.get('topicId'));
  if (!Number.isFinite(topicId)) return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: topic } = await supabase
    .from('topics')
    .select('id, title, unit_id')
    .eq('id', topicId)
    .maybeSingle();
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });

  const { data: unit } = await supabase
    .from('units')
    .select('id, title, grade_id, lesson_id, key_concepts')
    .eq('id', topic.unit_id)
    .maybeSingle();
  if (!unit) return NextResponse.json({ error: 'Ünite bulunamadı' }, { status: 404 });

  const [{ data: grade }, { data: lesson }, { data: outcomesData }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', unit.grade_id).maybeSingle(),
    supabase.from('lessons').select('name').eq('id', unit.lesson_id).maybeSingle(),
    supabase.from('outcomes').select('code, description').eq('topic_id', topicId).order('id', { ascending: true }),
  ]);

  const outcomeRows = (outcomesData as { code: string | null; description: string }[] | null) || [];
  if (!outcomeRows.length) {
    return NextResponse.json({ error: 'Bu konu için hiç kazanım tanımlı değil — önce kazanımları ekleyin.' }, { status: 400 });
  }
  const outcomesText = outcomeRows.map((o) => (o.code ? `- ${o.code}. ${o.description}` : `- ${o.description}`)).join('\n');

  const keyConcepts = (unit.key_concepts as string[] | null) || [];
  const keyConceptsBlock = keyConcepts.length
    ? `Ünitenin anahtar kavramları (uygun yerlerde kullan): ${keyConcepts.join(', ')}`
    : '';

  const templatePath = path.join(process.cwd(), 'app', 'prompt', '18-rag-topic-source-notext.md');
  const template = await readFile(templatePath, 'utf8');

  const prompt = template
    .replaceAll('{grade}', grade?.name || '')
    .replaceAll('{lesson}', lesson?.name || '')
    .replaceAll('{unit}', unit.title)
    .replaceAll('{topic}', topic.title)
    .replaceAll('{outcomes}', outcomesText)
    .replaceAll('{key_concepts_block}', keyConceptsBlock);

  return NextResponse.json({
    prompt,
    topicTitle: topic.title,
    unitId: unit.id,
    gradeId: unit.grade_id,
    lessonId: unit.lesson_id,
  });
}
