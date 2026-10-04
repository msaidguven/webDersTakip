// app/src/lib/publicGradeLesson.ts
// Public sayfaların (ünite tanıtım, soru bankası ünite/konu, test sayfaları) URL'deki sınıf + ders
// slug'ını çözdüğü ortak nokta. Yalnız YAYINDAKİ ders-sınıf eşleşmesini döndürür: ders
// (lessons.is_active) ve o sınıftaki dersi (lesson_grades.is_active) açık olmalı.
//
// 2026-10-03: bu kontrol sayfa sayfa dağınıktı ve ünite/konu sayfalarında hiç yoktu — hazırlanırken
// kapalı tutulan 6. sınıf Türkçe'nin ünite sayfası doğrudan URL ile açılıyordu. Tek sorgu
// (lesson_grades → grades + lessons inner join) eski iki ayrı sorgunun yerini de alıyor.
import type { SupabaseClient } from '@supabase/supabase-js';

export type PublicGrade = { id: number; name: string; slug: string | null };
export type PublicLesson = { id: number; name: string; slug: string | null };

export async function resolvePublicGradeLesson(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  gradeSlug: string,
  lessonSlug: string,
): Promise<{ grade: PublicGrade; lesson: PublicLesson } | null> {
  const { data } = await supabase
    .from('lesson_grades')
    .select('grades!inner(id, name, slug), lessons!inner(id, name, slug)')
    .eq('grades.slug', gradeSlug)
    .eq('lessons.slug', lessonSlug)
    .eq('is_active', true)
    .eq('lessons.is_active', true)
    .maybeSingle();
  const row = data as { grades: PublicGrade | PublicGrade[]; lessons: PublicLesson | PublicLesson[] } | null;
  if (!row) return null;
  const grade = Array.isArray(row.grades) ? row.grades[0] : row.grades;
  const lesson = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
  return grade && lesson ? { grade, lesson } : null;
}

// Yayındaki tüm ders-sınıf eşleşmeleri ("lessonId:gradeId") — dersten bağımsız, karışık listeler
// (anasayfa: günün sorusu, son eklenenler, okulda bu hafta) kapalı ders/sınıfın konusunu
// göstermesin diye (2026-10-04: kapalı 6. sınıf Türkçe konuları anasayfada çıkıyordu — bu sorgular
// yalnız konu/ünite/sınıf açıklığına bakıyordu). Tek küçük sorgu.
export async function getPublishedLessonGradeKeys(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('lesson_grades')
    .select('lesson_id, grade_id, lessons!inner(is_active), grades!inner(is_active)')
    .eq('is_active', true)
    .eq('lessons.is_active', true)
    .eq('grades.is_active', true);
  return new Set(((data as { lesson_id: number; grade_id: number }[] | null) || []).map((r) => `${r.lesson_id}:${r.grade_id}`));
}

export const lessonGradeKey = (lessonId: number, gradeId: number) => `${lessonId}:${gradeId}`;
