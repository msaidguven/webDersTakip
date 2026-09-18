import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// 50MB Storage limitini aşan kılavuz kitaplar için: admin bu prompt'u NotebookLM'e (kaynak
// olarak kılavuz kitabın PDF'ini yüklediği notebook'ta) sorar, dönen JSON'u
// /api/admin/teacher-guide/documents/from-json ile sisteme kaydeder — rag/unit-prompt ile
// aynı desen, ama düz metin yerine doğrudan yapılandırılmış JSON isteniyor.
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
    supabase.from('topics').select('id, title, order_no').eq('unit_id', unitId).eq('is_active', true).order('order_no', { ascending: true }),
  ]);

  const topics = (topicsData as { id: number; title: string; order_no: number | null }[] | null) || [];
  if (!topics.length) return NextResponse.json({ error: 'Bu ünitede aktif konu yok' }, { status: 400 });

  const topicListText = topics.map((t) => `- (topic_id=${t.id}) ${t.title}`).join('\n');

  const templatePath = path.join(process.cwd(), 'app', 'prompt', '30-teacher-guide-unit-extract.md');
  const template = await readFile(templatePath, 'utf8');

  const prompt = template
    .replaceAll('{grade}', grade?.name || '')
    .replaceAll('{lesson}', lesson?.name || '')
    .replaceAll('{unit}', unit.title)
    .replaceAll('{topic_list}', topicListText);

  return NextResponse.json({ prompt, unitTitle: unit.title, gradeId: unit.grade_id, lessonId: unit.lesson_id });
}
