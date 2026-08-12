export function parseGradeSegment(segment: string): number | null {
  const value = decodeURIComponent(segment || '').trim().toLowerCase();
  const match = value.match(/^(\d+)-s(?:inif|ınıf)$/);
  if (!match) return null;
  const gradeId = Number(match[1]);
  if (!Number.isFinite(gradeId) || gradeId <= 0) return null;
  return gradeId;
}

export function parseWeekSegment(segment: string): number | null {
  const value = decodeURIComponent(segment || '').trim().toLowerCase();
  const match = value.match(/^hafta-(\d+)$/);
  if (!match) return null;
  const week = Number(match[1]);
  if (!Number.isFinite(week) || week <= 0) return null;
  return week;
}

/**
 * MEB müfredat takviminde bugün kaçıncı haftaya denk geliyor.
 * Eğitim-öğretim yılının, Eylül ayının ilk Pazartesi günü başladığı varsayılır.
 * Yaz tatilinde 1. haftaya, yıl sonunda son haftaya sabitlenir.
 */
export function getCurrentCurriculumWeek(totalWeeks: number = 38): number {
  const now = new Date();
  const schoolYearStartYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;

  const sept1 = new Date(schoolYearStartYear, 8, 1);
  const daysUntilMonday = (8 - sept1.getDay()) % 7; // Pazartesi = 1
  const termStart = new Date(schoolYearStartYear, 8, 1 + daysUntilMonday);

  const diffDays = Math.floor((now.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;

  return Math.min(Math.max(week, 1), Math.max(1, totalWeeks));
}

export function normalizeSlugWithGrade(slug: string, gradeId?: number): string {
  const value = decodeURIComponent(slug || '').trim().toLowerCase();
  if (!gradeId) return value;
  const suffix = `-${gradeId}`;
  if (value.endsWith(suffix)) {
    return value.slice(0, -suffix.length);
  }
  return value;
}
