import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isViewerAdmin } from '@/app/src/lib/publishGuard';

// Konu sayfasındaki hiyerarşi barında "Sınıf" değiştirildiğinde, o YENİ sınıftaki dersleri
// (Ders dropdown'unu yeniden doldurmak için) client tarafından çekmek için — bkz.
// [gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]/page.tsx'teki fetchGradeLessons ile
// aynı filtreleme mantığı (lesson_grades.is_active + lessons.is_active).
type LessonRow = { id: number; name: string; slug: string | null; icon: string | null; is_active: boolean };
type Row = { lesson_id: number; is_active: boolean; lessons: LessonRow | LessonRow[] | null };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gradeId = Number(searchParams.get('gradeId'));

  if (!Number.isFinite(gradeId)) {
    return NextResponse.json({ error: 'Eksik veya hatalı parametre' }, { status: 400 });
  }

  const supabase = await createClient();
  const isAdmin = await isViewerAdmin(supabase);

  let query = supabase
    .from('lesson_grades')
    .select('lesson_id, is_active, lessons(id, name, slug, icon, is_active)')
    .eq('grade_id', gradeId);
  if (!isAdmin) query = query.eq('is_active', true);
  const { data } = await query;

  const lessons: { id: number; name: string; slug: string | null; icon: string | null }[] = [];
  for (const row of (data as Row[] | null) || []) {
    const lessonRow = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
    if (!lessonRow) continue;
    if (!isAdmin && lessonRow.is_active === false) continue;
    lessons.push({ id: lessonRow.id, name: lessonRow.name, slug: lessonRow.slug, icon: lessonRow.icon });
  }
  lessons.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  return NextResponse.json({ lessons });
}
