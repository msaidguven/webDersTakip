// app/src/lib/topicPageRevalidation.ts
// Genel (SEO'lu) konu sayfası artık ISR ile cache'leniyor (bkz. [topicSlug]/page.tsx'teki
// revalidate=3600). Admin bir konunun içeriğini/sorularını/ünite-ders aktifliğini
// değiştirdiğinde, o değişikliğin en geç 1 saat sonra değil ANINDA görünmesi için ilgili
// admin kayıt endpoint'lerinin DB yazması başarılı olduktan SONRA bu fonksiyonlardan
// birini çağırması gerekir. Mantık burada TEK yerde toplanıyor ki her endpoint kendi
// slug-bulma kodunu tekrar yazmasın (ve biri unutulup sessizce bayatlamasın).
//
// Kapsam bilinçli olarak sınırlı: sadece BU public sayfayı besleyen, sık ve aciliyeti
// yüksek değişiklikler (konu içeriği, sorular, ünite/ders aktiflik) anında invalide
// edilir. Müfredat takvimi gibi nadir ve sitenin tamamını etkileyen değişiklikler
// saatlik fallback'e (revalidate=3600) bırakılır — yüzlerce sayfayı tek tek revalidate
// etmek yerine.
//
// Bazı admin endpoint'leri TOPLU çalışır (ör. "birden fazla soruyu aynı anda düzenle"),
// bu yüzden her fonksiyonun tek-id değil id LİSTESİ alan bir hâli var; tekli çağrılar da
// aynı bulk mantığı (tek sorguda çözüp dedupe ederek) kullansın diye bulk sürüm üzerine
// kuruldu.
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

async function resolveTopicPaths(supabase: Supabase, topicIds: number[]): Promise<string[]> {
  const uniqueTopicIds = Array.from(new Set(topicIds));
  if (!uniqueTopicIds.length) return [];

  const { data: topics } = await supabase.from('topics').select('slug, unit_id').in('id', uniqueTopicIds);
  const topicRows = (topics as { slug: string | null; unit_id: number | null }[] | null) || [];
  const unitIds = Array.from(new Set(topicRows.map((t) => t.unit_id).filter((id): id is number => id != null)));
  if (!unitIds.length) return [];

  const { data: units } = await supabase.from('units').select('id, slug, lesson_id, grade_id').in('id', unitIds);
  const unitRows = (units as { id: number; slug: string | null; lesson_id: number | null; grade_id: number | null }[] | null) || [];
  const unitById = new Map(unitRows.map((u) => [u.id, u]));

  const lessonIds = Array.from(new Set(unitRows.map((u) => u.lesson_id).filter((id): id is number => id != null)));
  const gradeIds = Array.from(new Set(unitRows.map((u) => u.grade_id).filter((id): id is number => id != null)));

  const [{ data: lessons }, { data: grades }] = await Promise.all([
    lessonIds.length ? supabase.from('lessons').select('id, slug').in('id', lessonIds) : Promise.resolve({ data: [] }),
    gradeIds.length ? supabase.from('grades').select('id, slug').in('id', gradeIds) : Promise.resolve({ data: [] }),
  ]);
  const lessonSlugById = new Map(((lessons as { id: number; slug: string | null }[] | null) || []).map((l) => [l.id, l.slug]));
  const gradeSlugById = new Map(((grades as { id: number; slug: string | null }[] | null) || []).map((g) => [g.id, g.slug]));

  const paths: string[] = [];
  for (const topic of topicRows) {
    if (!topic.slug || topic.unit_id == null) continue;
    const unit = unitById.get(topic.unit_id);
    if (!unit?.slug || unit.lesson_id == null || unit.grade_id == null) continue;
    const lessonSlug = lessonSlugById.get(unit.lesson_id);
    const gradeSlug = gradeSlugById.get(unit.grade_id);
    if (!lessonSlug || !gradeSlug) continue;
    paths.push(`/${gradeSlug}/${lessonSlug}/${unit.slug}/${topic.slug}`);
    // Soru bankası (cevap anahtarı) sayfası aynı konunun sorularını gösteriyor — soru
    // eklendiğinde/silindiğinde veya konu içeriği değiştiğinde bu da güncel olmalı.
    paths.push(`/soru-bankasi/${gradeSlug}/${lessonSlug}/${unit.slug}/${topic.slug}`);
  }
  return paths;
}

// Bir/birden fazla konunun kendi içeriği değiştiğinde (section metni/diyagramı,
// highlight, hero/galeri görseli, yayın durumu) o konu(lar)ın sayfasını anında invalide eder.
export async function revalidateTopicPages(supabase: Supabase, topicIds: number[]): Promise<void> {
  try {
    const paths = await resolveTopicPaths(supabase, topicIds);
    paths.forEach((path) => revalidatePath(path));
  } catch (error) {
    console.error('[revalidateTopicPages] revalidate başarısız:', error);
  }
}

export async function revalidateTopicPage(supabase: Supabase, topicId: number): Promise<void> {
  await revalidateTopicPages(supabase, [topicId]);
}

// unitSlug verilmişse (birden fazla farklı ünite aynı grade+lesson çiftini paylaşabileceği
// için pair anahtarına dahil edilir) o ünitenin soru bankası hub'ı da (/soru-bankasi/
// [sinif]/[ders]/[unite]) invalide edilir.
async function resolveGradeLessonPaths(
  supabase: Supabase,
  pairs: { gradeId: number; lessonId: number; unitSlug?: string | null }[]
): Promise<string[]> {
  const uniquePairs = Array.from(new Map(pairs.map((p) => [`${p.gradeId}:${p.lessonId}:${p.unitSlug ?? ''}`, p])).values());
  if (!uniquePairs.length) return [];

  const gradeIds = Array.from(new Set(uniquePairs.map((p) => p.gradeId)));
  const lessonIds = Array.from(new Set(uniquePairs.map((p) => p.lessonId)));
  const [{ data: grades }, { data: lessons }] = await Promise.all([
    supabase.from('grades').select('id, slug').in('id', gradeIds),
    supabase.from('lessons').select('id, slug').in('id', lessonIds),
  ]);
  const gradeSlugById = new Map(((grades as { id: number; slug: string | null }[] | null) || []).map((g) => [g.id, g.slug]));
  const lessonSlugById = new Map(((lessons as { id: number; slug: string | null }[] | null) || []).map((l) => [l.id, l.slug]));

  const paths = new Set<string>();
  for (const p of uniquePairs) {
    const gradeSlug = gradeSlugById.get(p.gradeId);
    if (!gradeSlug) continue;
    paths.add(`/${gradeSlug}`);
    paths.add(`/soru-bankasi/${gradeSlug}`);
    const lessonSlug = lessonSlugById.get(p.lessonId);
    if (!lessonSlug) continue;
    paths.add(`/${gradeSlug}/${lessonSlug}`);
    paths.add(`/soru-bankasi/${gradeSlug}/${lessonSlug}`);
    if (p.unitSlug) paths.add(`/soru-bankasi/${gradeSlug}/${lessonSlug}/${p.unitSlug}`);
  }
  return Array.from(paths);
}

// Sınıf sayfası (/[gradeSlug]) ders kartlarını, ders sayfası (/[gradeSlug]/[lessonSlug])
// ünite/konu listesini, soru bankası hub'ları (/soru-bankasi/...) da aynı hiyerarşiyi
// gösteriyor — bir ünitenin kendisi (aktiflik, hafta aralığı) veya içindeki bir konu/soru
// değişince BUNLARIN hepsi güncel olmalı, sadece konu sayfaları değil.
export async function revalidateGradeLessonPagesForUnits(supabase: Supabase, unitIds: number[]): Promise<void> {
  try {
    const uniqueUnitIds = Array.from(new Set(unitIds));
    if (!uniqueUnitIds.length) return;
    const { data: units } = await supabase.from('units').select('grade_id, lesson_id, slug').in('id', uniqueUnitIds);
    const pairs = ((units as { grade_id: number | null; lesson_id: number | null; slug: string | null }[] | null) || [])
      .filter((u): u is { grade_id: number; lesson_id: number; slug: string | null } => u.grade_id != null && u.lesson_id != null)
      .map((u) => ({ gradeId: u.grade_id, lessonId: u.lesson_id, unitSlug: u.slug }));
    const paths = await resolveGradeLessonPaths(supabase, pairs);
    paths.forEach((p) => revalidatePath(p));
  } catch (error) {
    console.error('[revalidateGradeLessonPagesForUnits] revalidate başarısız:', error);
  }
}

// lesson_grades.is_active değişince (bir dersin tüm sınıftaki yayın durumu) o TEK
// sınıf+ders çiftinin sınıf/ders sayfalarını invalide eder — ünite bazlı bir olay
// olmadığı için revalidateGradeLessonPagesForUnits'in kapsamına girmiyor.
export async function revalidateGradeLessonPage(supabase: Supabase, gradeId: number, lessonId: number): Promise<void> {
  try {
    const paths = await resolveGradeLessonPaths(supabase, [{ gradeId, lessonId }]);
    paths.forEach((p) => revalidatePath(p));
  } catch (error) {
    console.error('[revalidateGradeLessonPage] revalidate başarısız:', error);
  }
}

// Bir/birden fazla ünitenin kendisi değişince (aktif/pasif, veya bir soru eklenip
// "Ünite Testi" sayacı değişince) o ünite(ler)deki TÜM konu sayfalarını invalide eder —
// çünkü sidebar'daki ünite listesi ve soru sayısı her konu sayfasında ortak gösteriliyor.
export async function revalidateUnitPages(supabase: Supabase, unitIds: number[]): Promise<void> {
  try {
    const uniqueUnitIds = Array.from(new Set(unitIds));
    if (!uniqueUnitIds.length) return;
    const { data: topics } = await supabase.from('topics').select('id').in('unit_id', uniqueUnitIds);
    const topicIds = ((topics as { id: number }[] | null) || []).map((t) => t.id);
    await Promise.all([
      revalidateTopicPages(supabase, topicIds),
      revalidateGradeLessonPagesForUnits(supabase, uniqueUnitIds),
    ]);
  } catch (error) {
    console.error('[revalidateUnitPages] revalidate başarısız:', error);
  }
}

// questions.topic_id'den (bir/birden fazla soru) ünitelerini bulup revalidateUnitPages'i
// çağırır — soru eklendiğinde/silindiğinde/düzenlendiğinde o ünitedeki tüm konu
// sayfalarının "Ünite Testi" sayacı güncellensin diye.
export async function revalidateUnitPagesForTopics(supabase: Supabase, topicIds: number[]): Promise<void> {
  try {
    const uniqueTopicIds = Array.from(new Set(topicIds));
    if (!uniqueTopicIds.length) return;
    const { data: topics } = await supabase.from('topics').select('unit_id').in('id', uniqueTopicIds);
    const unitIds = ((topics as { unit_id: number | null }[] | null) || [])
      .map((t) => t.unit_id)
      .filter((id): id is number => id != null);
    await revalidateUnitPages(supabase, unitIds);
  } catch (error) {
    console.error('[revalidateUnitPagesForTopics] revalidate başarısız:', error);
  }
}

// topic_contents.id'den (bir/birden fazla) topic_id çözüp revalidateTopicPages'i çağırır.
export async function revalidateTopicPagesByContentIds(supabase: Supabase, topicContentIds: (number | string)[]): Promise<void> {
  try {
    const uniqueIds = Array.from(new Set(topicContentIds));
    if (!uniqueIds.length) return;
    const { data: contents } = await supabase.from('topic_contents').select('topic_id').in('id', uniqueIds);
    const topicIds = ((contents as { topic_id: number | null }[] | null) || [])
      .map((c) => c.topic_id)
      .filter((id): id is number => id != null);
    await revalidateTopicPages(supabase, topicIds);
  } catch (error) {
    console.error('[revalidateTopicPagesByContentIds] revalidate başarısız:', error);
  }
}

// questions.id'den (bir/birden fazla) topic_id çözüp revalidateUnitPagesForTopics'i
// çağırır. Silme işlemlerinde satırlar cascade ile silinmeden ÖNCE çağrılmalı (yoksa
// topic_id çözülemez).
export async function revalidateUnitPagesForQuestionIds(supabase: Supabase, questionIds: number[]): Promise<void> {
  try {
    const uniqueIds = Array.from(new Set(questionIds));
    if (!uniqueIds.length) return;
    const { data: questions } = await supabase.from('questions').select('topic_id').in('id', uniqueIds);
    const topicIds = ((questions as { topic_id: number | null }[] | null) || [])
      .map((q) => q.topic_id)
      .filter((id): id is number => id != null);
    await revalidateUnitPagesForTopics(supabase, topicIds);
  } catch (error) {
    console.error('[revalidateUnitPagesForQuestionIds] revalidate başarısız:', error);
  }
}

// topic_content_sections.id'den (bir/birden fazla) topic_content_id -> topic_id çözüp
// revalidateTopicPages'i çağırır.
export async function revalidateTopicPagesBySectionIds(supabase: Supabase, sectionIds: (number | string)[]): Promise<void> {
  try {
    const uniqueIds = Array.from(new Set(sectionIds));
    if (!uniqueIds.length) return;
    const { data: sections } = await supabase.from('topic_content_sections').select('topic_content_id').in('id', uniqueIds);
    const contentIds = ((sections as { topic_content_id: number | null }[] | null) || [])
      .map((s) => s.topic_content_id)
      .filter((id): id is number => id != null);
    await revalidateTopicPagesByContentIds(supabase, contentIds);
  } catch (error) {
    console.error('[revalidateTopicPagesBySectionIds] revalidate başarısız:', error);
  }
}

// Ana sayfa (bkz. app/page.tsx, revalidate=3600) istatistik sayaçlarını (yayınlanmış
// konu/soru sayısı) ve ders kartlarını gösteriyor. Bu sayılar/kart listesi değişebilecek
// bir olay (konu yayınlandı, soru eklendi/silindi, ünite/ders/ders-sınıf aktifliği
// değişti) sonrası çağrılır — sorgu gerekmiyor, tek bir path invalidation.
export function revalidateHomepage(): void {
  try {
    revalidatePath('/');
  } catch (error) {
    console.error('[revalidateHomepage] revalidate başarısız:', error);
  }
}
