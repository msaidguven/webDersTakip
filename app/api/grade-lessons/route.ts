import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Konu sayfasındaki hiyerarşi barında "Sınıf" değiştirildiğinde, o YENİ sınıftaki dersleri
// (Ders dropdown'unu yeniden doldurmak için) client tarafından çekmek için — tek çağıranı
// DersClient.tsx'teki bu dropdown zinciri. O sayfa admin dahil KİMSEYE taslak göstermiyor
// (bkz. [gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]/page.tsx'teki fetchGradeLessons'ın
// KOŞULSUZ is_active filtresi) — bu yüzden burada da admin bypass'ı YOK, her zaman filtrelenir.
type LessonRow = { id: number; name: string; slug: string | null; icon: string | null; is_active: boolean };
type Row = { lesson_id: number; is_active: boolean; lessons: LessonRow | LessonRow[] | null };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gradeId = Number(searchParams.get('gradeId'));

  if (!Number.isFinite(gradeId)) {
    return NextResponse.json({ error: 'Eksik veya hatalı parametre' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from('lesson_grades')
    .select('lesson_id, is_active, lessons(id, name, slug, icon, is_active)')
    .eq('grade_id', gradeId)
    .eq('is_active', true);

  const lessons: { id: number; name: string; slug: string | null; icon: string | null }[] = [];
  for (const row of (data as Row[] | null) || []) {
    const lessonRow = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
    if (!lessonRow || lessonRow.is_active === false) continue;
    lessons.push({ id: lessonRow.id, name: lessonRow.name, slug: lessonRow.slug, icon: lessonRow.icon });
  }
  lessons.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  return NextResponse.json({ lessons });
}
