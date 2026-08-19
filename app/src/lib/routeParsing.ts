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

// weekStart (Pazartesi) ile başlayan Pazartesi–Cuma öğretim haftası, verilen tatillerden
// herhangi biriyle çakışıyor mu (tek bir gün bile çakışsa yeterli — o hafta "tatil haftası"
// sayılır ve bir öğretim haftası numarası tüketmez, bkz. dosya başındaki açıklama).
function isWeekInBreak(weekStart: Date, breaks: CurriculumBreak[]): boolean {
  const weekEnd = addDays(weekStart, 4);
  return breaks.some((b) => {
    const start = new Date(`${b.startDate}T00:00:00`);
    const end = new Date(`${b.endDate}T00:00:00`);
    return weekStart <= end && weekEnd >= start;
  });
}

// termStart'tan başlayarak, tatile denk gelen Pazartesileri ATLAYIP sırayla öğretim
// haftalarının (1, 2, 3...) gerçek Pazartesi tarihlerini üretir — her hafta her zaman bir
// önceki haftanın +7 günü olduğu için Pazartesi hizası hep korunur ("Pazartesi'den
// Pazartesi'ye"); bir tatil bir haftanın ortasında bitse bile bir sonraki öğretim haftası
// yine bir sonraki Pazartesi'den başlar, ortada kalan gün(ler) heba edilir.
function* teachingWeekStarts(termStart: Date, breaks: CurriculumBreak[]): Generator<Date> {
  let cursor = termStart;
  while (isWeekInBreak(cursor, breaks)) cursor = addDays(cursor, 7);
  while (true) {
    yield cursor;
    do {
      cursor = addDays(cursor, 7);
    } while (isWeekInBreak(cursor, breaks));
  }
}

// week. öğretim haftasının Pazartesi tarihini bulur.
function computeWeekStart(termStart: Date, week: number, breaks: CurriculumBreak[]): Date {
  const gen = teachingWeekStarts(termStart, breaks);
  let start = gen.next().value as Date;
  for (let w = 2; w <= week; w++) start = gen.next().value as Date;
  return start;
}

/**
 * MEB müfredat takviminde bugün kaçıncı öğretim haftasına denk geliyor. termStartDate
 * verilirse (admin /admin/takvim'de ayarlanan "1. hafta başlangıcı") o tarih baz alınır;
 * verilmezse eğitim-öğretim yılının Eylül ayının ilk Pazartesi günü başladığı varsayılır.
 * breaks verilirse (special_week_events, event_type='break') tatile denk gelen haftalar
 * atlanır — tatildeyken bir önceki (son biten) öğretim haftasında kalınır. Yaz tatilinde
 * 1. haftaya, yıl sonunda son haftaya sabitlenir.
 */
export function getCurrentCurriculumWeek(totalWeeks: number = 38, termStartDate?: string | null, breaks: CurriculumBreak[] = []): number {
  const now = new Date();
  const termStart = resolveTermStart(now, termStartDate);
  const clampedTotal = Math.max(1, totalWeeks);

  let weekNum = 0;
  for (const start of teachingWeekStarts(termStart, breaks)) {
    weekNum++;
    if (weekNum > clampedTotal) break;
    if (now < start) return Math.max(1, weekNum - 1);
    if (now < addDays(start, 7)) return weekNum;
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
 * Verilen bir takvim tarihinin (YYYY-MM-DD) kaçıncı öğretim haftasına denk geldiğini bulur —
 * getCurrentCurriculumWeek'in tersi. Admin panelinde özel hafta (tatil dışı) girerken hafta
 * numarasını ezbere hesaplamak yerine doğrudan tarih girilebilsin diye kullanılır. Tarih bir
 * tatile denk geliyorsa veya dönem başlamadan önceyse null döner (o tarihin bir öğretim
 * haftası yoktur).
 */
export function getCurriculumWeekFromDate(dateStr: string, totalWeeks: number = 52, termStartDate?: string | null, breaks: CurriculumBreak[] = []): number | null {
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;

  const termStart = resolveTermStart(target, termStartDate);
  const clampedTotal = Math.max(1, totalWeeks);

  let weekNum = 0;
  for (const start of teachingWeekStarts(termStart, breaks)) {
    weekNum++;
    if (weekNum > clampedTotal) return null;
    if (target < start) return null;
    if (target < addDays(start, 7)) return weekNum;
  }
  return null;
}

/**
 * Kazanımlar modalinde gezinilen "takvim haftası" (okulun açılışından itibaren gerçek,
 * atlamasız hafta sayısı — 1, 2, 3... tatil haftaları da dahil sayılır) hangi öğretim
 * haftasına (outcome_weeks'teki hafta numarasına) denk geliyor bulur. Takvim haftası bir
 * tatile denk geliyorsa null döner — modal o zaman kazanım yerine tatil bilgisini gösterir.
 * Örnek: termStart'tan 9 takvim haftası sonrası tatilse, resolveTeachingWeek(9,...) → null,
 * resolveTeachingWeek(10,...) → 9 (tatilden önceki son öğretim haftası hâlâ 9'du, tatil bir
 * öğretim haftası numarası tüketmediği için 10. takvim haftası 9. öğretim haftasını gösterir).
 */
export function resolveTeachingWeek(calendarWeek: number, termStartDate?: string | null, breaks: CurriculumBreak[] = []): number | null {
  const termStart = resolveTermStart(new Date(), termStartDate);
  let cursor = termStart;
  let teachingWeek = 0;
  for (let cw = 1; cw <= calendarWeek; cw++) {
    const inBreak = isWeekInBreak(cursor, breaks);
    if (!inBreak) teachingWeek++;
    if (cw === calendarWeek) return inBreak ? null : teachingWeek;
    cursor = addDays(cursor, 7);
  }
  return null;
}

/**
 * resolveTeachingWeek'in tersi: verilen bir öğretim haftasının (ör. outcome_weeks'teki 9)
 * kaçıncı takvim haftasına denk geldiğini bulur. Kazanımlar modalinin "toplam hafta" sınırını
 * (öğretim haftası sayısını takvim haftası sayısına çevirmek için) ve modal ilk açıldığında
 * bugünün öğretim haftasını takvim haftasına çevirmek için kullanılır.
 */
export function teachingWeekToCalendarWeek(teachingWeek: number, termStartDate?: string | null, breaks: CurriculumBreak[] = []): number {
  const termStart = resolveTermStart(new Date(), termStartDate);
  let cursor = termStart;
  let tw = 0;
  let cw = 0;
  while (tw < teachingWeek) {
    cw++;
    if (!isWeekInBreak(cursor, breaks)) tw++;
    cursor = addDays(cursor, 7);
  }
  return cw;
}

/**
 * termStartDate ile termEndDate (admin /admin/takvim'de ayarlanan "okul bitiş tarihi")
 * arasında kaç takvim haftası olduğunu bulur. Kazanımlar modalinin gezinme sınırı bundan
 * hesaplanır — ünitelerin/özel haftaların nereye kadar uzandığını dolaylı tahmin etmek
 * yerine tek, doğrudan bir kaynak. Biri eksikse null döner; çağıran taraf o zaman eski
 * (ünite bazlı) tahmine düşer.
 */
export function calendarWeeksBetween(termStartDate?: string | null, termEndDate?: string | null): number | null {
  if (!termStartDate || !termEndDate) return null;
  const start = new Date(`${termStartDate}T00:00:00`);
  const end = new Date(`${termEndDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
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
