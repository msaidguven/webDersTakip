export function buildSoruBankasiIndexPath() {
  return `/soru-bankasi`;
}
export function buildSoruBankasiGradePath(gradeSlug: string) {
  return `/soru-bankasi/${gradeSlug}`;
}
export function buildSoruBankasiLessonPath(gradeSlug: string, lessonSlug: string) {
  return `/soru-bankasi/${gradeSlug}/${lessonSlug}`;
}
export function buildSoruBankasiUnitPath(gradeSlug: string, lessonSlug: string, unitSlug: string) {
  return `/soru-bankasi/${gradeSlug}/${lessonSlug}/${unitSlug}`;
}
