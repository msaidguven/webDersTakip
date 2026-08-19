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

// Admin /admin/takvim'den bir başlangıç tarihi girilmemişse düşülen varsayım:
// eğitim-öğretim yılının, Eylül ayının ilk Pazartesi günü başladığı kabul edilir.
function defaultTermStart(referenceDate: Date): Date {
  const schoolYearStartYear = referenceDate.getMonth() >= 7 ? referenceDate.getFullYear() : referenceDate.getFullYear() - 1;
  const sept1 = new Date(schoolYearStartYear, 8, 1);
  const daysUntilMonday = (8 - sept1.getDay()) % 7; // Pazartesi = 1
  return new Date(schoolYearStartYear, 8, 1 + daysUntilMonday);
}

function resolveTermStart(referenceDate: Date, termStartDate?: string | null): Date {
  if (termStartDate) {
    const parsed = new Date(`${termStartDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return defaultTermStart(referenceDate);
}

/**
 * MEB müfredat takviminde bugün kaçıncı haftaya denk geliyor.
 * termStartDate verilirse (admin /admin/takvim'de ayarlanan "1. hafta başlangıcı",
 * "YYYY-MM-DD") o tarih baz alınır; verilmezse eğitim-öğretim yılının Eylül ayının
 * ilk Pazartesi günü başladığı varsayılır. Yaz tatilinde 1. haftaya, yıl sonunda
 * son haftaya sabitlenir.
 */
export function getCurrentCurriculumWeek(totalWeeks: number = 38, termStartDate?: string | null): number {
  const now = new Date();
  const termStart = resolveTermStart(now, termStartDate);

  const diffDays = Math.floor((now.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;

  return Math.min(Math.max(week, 1), Math.max(1, totalWeeks));
}

/**
 * Verilen müfredat haftasının (1'den başlar) takvimdeki Pazartesi–Cuma
 * tarih aralığını döndürür. getCurrentCurriculumWeek ile aynı termStartDate
 * varsayımını kullanır.
 */
export function getWeekDateRange(week: number, totalWeeks: number = 38, termStartDate?: string | null): { start: Date; end: Date } {
  const now = new Date();
  const termStart = resolveTermStart(now, termStartDate);

  const clampedWeek = Math.min(Math.max(week, 1), Math.max(1, totalWeeks));
  const start = new Date(termStart);
  start.setDate(termStart.getDate() + (clampedWeek - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);

  return { start, end };
}

/**
 * startWeek. haftanın Pazartesi'sinden endWeek. haftanın Cuma'sına kadar
 * olan tarih aralığını "13 Ekim – 24 Ekim" biçiminde okunabilir metne çevirir.
 */
export function formatWeekDateRangeLabel(startWeek: number, endWeek: number, totalWeeks: number = 38, termStartDate?: string | null): string {
  const { start } = getWeekDateRange(startWeek, totalWeeks, termStartDate);
  const { end } = getWeekDateRange(endWeek, totalWeeks, termStartDate);
  const fmtDay = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  return `${fmtDay(start)} – ${fmtDay(end)}`;
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
