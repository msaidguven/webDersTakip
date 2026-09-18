import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// 50MB Storage limitini aşan kılavuz kitaplar için: admin bu prompt'u NotebookLM'e (kaynak
// olarak kılavuz kitabın PDF'ini yüklediği notebook'ta) sorar, dönen JSON'u
// /api/admin/teacher-guide/documents/from-json ile sisteme kaydeder. Ünite bazlı değil DERS
// bazlı — kılavuz kitaplar ders kitabının aksine kısa olduğundan (kullanıcının 2026-09-18
// gözlemi) tüm üniteleri tek promptta isteyip admin'in ünite ünite tekrar etmesini
// gerektirmiyoruz.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const gradeId = Number(request.nextUrl.searchParams.get('gradeId'));
  const lessonId = Number(request.nextUrl.searchParams.get('lessonId'));
  if (!Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const [{ data: grade }, { data: lesson }, { data: unitsData }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gradeId).maybeSingle(),
    supabase.from('lessons').select('name').eq('id', lessonId).maybeSingle(),
    supabase.from('units').select('id, title, order_no').eq('grade_id', gradeId).eq('lesson_id', lessonId).eq('is_active', true).order('order_no', { ascending: true }),
  ]);

  const units = (unitsData as { id: number; title: string; order_no: number | null }[] | null) || [];
  if (!units.length) return NextResponse.json({ error: 'Bu sınıf/derste aktif ünite yok' }, { status: 400 });

  const unitIds = units.map((u) => u.id);
  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, title, unit_id, order_no')
    .in('unit_id', unitIds)
    .eq('is_active', true)
    .order('order_no', { ascending: true });
  const topics = (topicsData as { id: number; title: string; unit_id: number; order_no: number | null }[] | null) || [];

  const topicsByUnitId = new Map<number, { id: number; title: string }[]>();
  for (const t of topics) {
    const list = topicsByUnitId.get(t.unit_id) || [];
    list.push({ id: t.id, title: t.title });
    topicsByUnitId.set(t.unit_id, list);
  }

  const unitTopicListText = units
    .map((u) => {
      const unitTopics = topicsByUnitId.get(u.id) || [];
      if (!unitTopics.length) return null;
      return `## Ünite: ${u.title}\n${unitTopics.map((t) => `- (topic_id=${t.id}) ${t.title}`).join('\n')}`;
    })
    .filter((s): s is string => !!s)
    .join('\n\n');

  const templatePath = path.join(process.cwd(), 'app', 'prompt', '30-teacher-guide-lesson-extract.md');
  const template = await readFile(templatePath, 'utf8');

  const prompt = template
    .replaceAll('{grade}', grade?.name || '')
    .replaceAll('{lesson}', lesson?.name || '')
    .replaceAll('{unit_topic_list}', unitTopicListText || 'Bu ders için henüz konu tanımlanmamış.');

  return NextResponse.json({ prompt, gradeId, lessonId });
}
