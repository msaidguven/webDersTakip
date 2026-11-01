// Yazılı soruları (bkz. docs/yazili-sorulari-plani.md): istemci ve sunucunun ortak kullandığı saf
// yardımcılar — yazılı etiketi, adres parçası, MEB tablosu olmayan dersler için varsayılan haftalar.

export type ExamTerm = 1 | 2;
export type ExamNo = 1 | 2;

export function examLabel(term: ExamTerm, examNo: ExamNo): string {
  return `${term}. Dönem ${examNo}. Yazılı`;
}

// Adresin son parçası: /yazili-sorulari/<sınıf>/<ders>/1-donem-1-yazili
export function examSlug(term: ExamTerm, examNo: ExamNo): string {
  return `${term}-donem-${examNo}-yazili`;
}

// Kapsamın asıl kaynağı MEB konu-soru dağılım tablosudur (exam_lo_targets; 2. yazılı 1. yazılının devamı
// DEĞİL, kendi konularını sorar). Tablo yayımlanmayan derslerde (ör. Bilişim) konu önerisi bu yıllık plan
// haftalarından (outcome_weeks) yapılır: 1. dönem ~1–18, 2. dönem ~19–36. hafta.
export const DEFAULT_EXAM_WEEKS: Record<`${ExamTerm}-${ExamNo}`, { from: number; to: number }> = {
  '1-1': { from: 1, to: 8 },
  '1-2': { from: 9, to: 17 },
  '2-1': { from: 19, to: 27 },
  '2-2': { from: 28, to: 36 },
};

// Okulların yazılı haftaları (kullanıcı 2026-11-01: "bu sene 9 Kasım 1. dönem 1. yazılı haftası"). Bir hafta
// önceden ve hafta boyunca üyeye "yazılı haftası" penceresi (MemberPromptModal) ve akşam bildirimi
// (cron/push-reminders) gösterilir; yalnız öğrencinin sınıfında yayında olan yazılılar listelenir. Tarihler her yıl
// burada güncellenir (bilinmeyen hafta eklenmez). Tarihler TR günü, start Pazartesi, end Cuma.
export const SCHOOL_EXAM_WEEKS: { term: ExamTerm; examNo: ExamNo; start: string; end: string }[] = [
  { term: 1, examNo: 1, start: '2026-11-09', end: '2026-11-13' },
];
const EXAM_WEEK_LEAD_DAYS = 7;

export type ActiveExamWeek = (typeof SCHOOL_EXAM_WEEKS)[number] & { phase: 'soon' | 'now' };

// TR günü (YYYY-AA-GG).
export const trToday = (now = Date.now()) => new Date(now + 3 * 3600 * 1000).toISOString().slice(0, 10);

// Bugün bir yazılı haftasının 7 gün öncesinden hafta sonuna kadar olan aralıktaysa o hafta.
export function activeExamWeek(today = trToday()): ActiveExamWeek | null {
  for (const w of SCHOOL_EXAM_WEEKS) {
    const lead = new Date(Date.parse(`${w.start}T00:00:00Z`) - EXAM_WEEK_LEAD_DAYS * 86400000).toISOString().slice(0, 10);
    if (today >= lead && today <= w.end) return { ...w, phase: today >= w.start ? 'now' : 'soon' };
  }
  return null;
}

// "9–13 Kasım"
export function examWeekRange(w: { start: string; end: string }): string {
  const fmt = (d: string, month: boolean) => new Date(`${d}T12:00:00Z`).toLocaleDateString('tr-TR', month ? { day: 'numeric', month: 'long', timeZone: 'UTC' } : { day: 'numeric', timeZone: 'UTC' });
  return w.start.slice(0, 7) === w.end.slice(0, 7) ? `${fmt(w.start, false)}–${fmt(w.end, true)}` : `${fmt(w.start, true)} – ${fmt(w.end, true)}`;
}

// Konu başına hedef klasik soru sayısı (tek seferde üretilecek havuz). min, otomatik yazılı worker'ının
// "konu tamam" eşiği de (claim_next_yazili_topic RPC'sinde aynı sayı yazılı).
export const TOPIC_QUESTION_TARGET = { min: 8, max: 15 } as const;

// Yazılı prompt sürümü (question_classical.prompt_version). 0 = 2026-10-31 öncesi sorular; 1 = kısa cevaplı
// ağırlıklı, net istemli yeni prompt. Sayfa, kağıt ve "Yeni yazılı aç" önce güncel sürümü kullanır.
export const YAZILI_PROMPT_VERSION = 1;

// Öğrenme çıktısı kodu: "MAT.6.1.4.  Günlük…", "SB 7.1.1.", "T.O.6.5." → MAT.6.1.4 / SB.7.1.1 / T.O.6.5.
export const LO_CODE_RE = /^\s*([A-ZÇĞİÖŞÜ]+(?:\.[A-ZÇĞİÖŞÜ])?)[\s.]+(\d+(?:\.\d+)+)/u;

export function normalizeLoCode(raw: string): string | null {
  const m = raw.toLocaleUpperCase('tr').match(LO_CODE_RE);
  return m ? `${m[1]}.${m[2]}` : null;
}

// Cevap görseli (answer_svg_prompt) yalnız öğrenciden çizim isteyen sorularda anlamlı (plan: "Cevap görseli",
// kural 2). Soru metninde çizim fiili yoksa önizleme uyarır. "Gösteriniz" kanıtla anlamında da olabilir;
// metinden ayırt edilemediği için uyarı vermez, ayrımı prompt ve admin yapar.
const DRAWING_VERB_STEMS = ['işaretle', 'çiziniz', 'çizin', 'çizer', 'yerleştir', 'tamamla', 'göster'];

export function asksForDrawing(questionText: string): boolean {
  const t = questionText.toLocaleLowerCase('tr');
  return DRAWING_VERB_STEMS.some((s) => t.includes(s));
}
