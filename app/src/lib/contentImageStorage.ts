export const CONTENT_IMAGE_BUCKET = 'topic-content-images';

export type ImageHierarchy = {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
};

type UnitsEmbed = {
  id?: number;
  slug: string | null;
  grades: { slug: string | null } | { slug: string | null }[] | null;
  lessons: { slug: string | null } | { slug: string | null }[] | null;
} | null;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

// PostgREST embedded select'lerden gelen sınıf/ders/ünite slug'larını çıkarır.
// Slug eksikse (ör. ileride biri boş bırakırsa) id tabanlı bir path segmentine düşer.
export function extractHierarchy(units: UnitsEmbed, unitId?: number): ImageHierarchy | null {
  if (!units) return null;
  const grade = firstOf(units.grades);
  const lesson = firstOf(units.lessons);
  if (!grade || !lesson) return null;

  return {
    gradeSlug: grade.slug || 'sinif-bilinmiyor',
    lessonSlug: lesson.slug || 'ders-bilinmiyor',
    unitSlug: units.slug || `unite-${units.id ?? unitId ?? 'bilinmiyor'}`,
  };
}

export function buildSectionFolderPrefix(hierarchy: ImageHierarchy): string {
  return `${hierarchy.gradeSlug}/${hierarchy.lessonSlug}/${hierarchy.unitSlug}/sections`;
}

export function buildHeroFolderPrefix(hierarchy: ImageHierarchy): string {
  return `${hierarchy.gradeSlug}/${hierarchy.lessonSlug}/${hierarchy.unitSlug}/hero`;
}

// Her yükleme benzersiz bir dosya adı alır (timestamp) — aynı bölüme/kapağa
// tekrar yükleme eskisinin üzerine yazmaz, galeri için birikmeye devam eder.
export function buildSectionImagePath(hierarchy: ImageHierarchy, sectionId: string | number): string {
  return `${buildSectionFolderPrefix(hierarchy)}/${sectionId}-${Date.now()}.webp`;
}

export function buildHeroImagePath(hierarchy: ImageHierarchy, topicContentId: string | number): string {
  return `${buildHeroFolderPrefix(hierarchy)}/${topicContentId}-${Date.now()}.webp`;
}

// Supabase public URL'inden bucket-relative object path'i çıkarır, ör:
// https://.../storage/v1/object/public/topic-content-images/5-sinif/matematik/x/sections/1.webp
// -> 5-sinif/matematik/x/sections/1.webp
export function extractStoragePath(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null;
  const marker = `/object/public/${CONTENT_IMAGE_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  const path = publicUrl.slice(idx + marker.length);
  return path || null;
}
