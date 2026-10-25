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

// Konu başına hedef klasik soru sayısı (tek seferde üretilecek havuz).
export const TOPIC_QUESTION_TARGET = { min: 8, max: 15 } as const;

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
