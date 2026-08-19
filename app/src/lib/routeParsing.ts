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

// Bir tatilin (special_week_events, event_type='break') gerçek takvim tarih aralığı.
// Kazanımların hafta numarası (outcome_weeks) MEB'in yıllık plan belgesinden ARDIŞIK
// geliyor — tatiller için bir öğretim haftası numarası ATLANMAZ (bkz. yillikPlan/importer.ts).
// Yani "9. hafta" takvimde 9. takvim haftası değil, 9. öğretim haftasıdır; tatiller takvimde
// ekstra gün tüketir ama bir hafta numarası tüketmez. Bu yüzden "hafta N hangi takvim
// tarihine denk geliyor" hesabı, N'den önceki tüm tatillerin gerçek gün sayısını da eklemek
// zorunda — aksi halde tatilden sonraki haftaların tarihi gerçek takvimden hep geri kalır.
export type CurriculumBreak = { startDate: string; endDate: string };

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
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

// date bir tatilin içine düşüyorsa, tatilin bitişinin ertesi gününe iter (art arda
// tatiller için while ile tekrar kontrol eder — biri diğerinin bitişinin hemen ertesi
// gününe denk gelebilir).
function skipPastBreaks(date: Date, breaks: CurriculumBreak[]): Date {
  let cursor = date;
  let moved = true;
  while (moved) {
    moved = false;
    for (const b of breaks) {
      const start = new Date(`${b.startDate}T00:00:00`);
      const end = new Date(`${b.endDate}T00:00:00`);
      if (cursor >= start && cursor <= end) {
        cursor = addDays(end, 1);
        moved = true;
      }
    }
  }
  return cursor;
}

// week. öğretim haftasının Pazartesi tarihini, termStart'tan başlayıp haftaları tek tek
// ilerleterek (her adımda aradaki tatilleri atlayarak) hesaplar.
function computeWeekStart(termStart: Date, week: number, breaks: CurriculumBreak[]): Date {
  let weekStart = termStart;
  for (let w = 2; w <= week; w++) {
    weekStart = skipPastBreaks(addDays(weekStart, 7), breaks);
  }
  return weekStart;
}

/**
 * MEB müfredat takviminde bugün kaçıncı öğretim haftasına denk geliyor. termStartDate
 * verilirse (admin /admin/takvim'de ayarlanan "1. hafta başlangıcı") o tarih baz alınır;
 * verilmezse eğitim-öğretim yılının Eylül ayının ilk Pazartesi günü başladığı varsayılır.
 * breaks verilirse (special_week_events, event_type='break') tatil günleri hafta
 * tarihlerine eklenir — tatildeyken bir önceki (son biten) öğretim haftasında kalınır.
 * Yaz tatilinde 1. haftaya, yıl sonunda son haftaya sabitlenir.
 */
export function getCurrentCurriculumWeek(totalWeeks: number = 38, termStartDate?: string | null, breaks: CurriculumBreak[] = []): number {
  const now = new Date();
  const termStart = resolveTermStart(now, termStartDate);
  const clampedTotal = Math.max(1, totalWeeks);

  let weekStart = termStart;
  for (let w = 1; w <= clampedTotal; w++) {
    if (w > 1) weekStart = skipPastBreaks(addDays(weekStart, 7), breaks);
    if (now < weekStart) return Math.max(1, w - 1);
    if (now < addDays(weekStart, 7)) return w;
  }
  return clampedTotal;
}

/**
 * Verilen müfredat haftasının (1'den başlar) takvimdeki Pazartesi–Cuma tarih aralığını
 * döndürür. getCurrentCurriculumWeek ile aynı termStartDate/breaks varsayımını kullanır.
 */
export function getWeekDateRange(week: number, totalWeeks: number = 38, termStartDate?: string | null, breaks: CurriculumBreak[] = []): { start: Date; end: Date } {
  const now = new Date();
  const termStart = resolveTermStart(now, termStartDate);

  const clampedWeek = Math.min(Math.max(week, 1), Math.max(1, totalWeeks));
  const start = computeWeekStart(termStart, clampedWeek, breaks);
  const end = addDays(start, 4);

  return { start, end };
}

/**
 * startWeek. haftanın Pazartesi'sinden endWeek. haftanın Cuma'sına kadar
 * olan tarih aralığını "13 Ekim – 24 Ekim" biçiminde okunabilir metne çevirir.
 */
export function formatWeekDateRangeLabel(startWeek: number, endWeek: number, totalWeeks: number = 38, termStartDate?: string | null, breaks: CurriculumBreak[] = []): string {
  const { start } = getWeekDateRange(startWeek, totalWeeks, termStartDate, breaks);
  const { end } = getWeekDateRange(endWeek, totalWeeks, termStartDate, breaks);
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
