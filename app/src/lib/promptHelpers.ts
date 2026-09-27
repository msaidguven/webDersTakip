// Soru üretme promptlarında paylaşılan iki küçük yardımcı: SVG yönlendirmesini ders
// adına göre koşullu kurmak, ve soru adedini (manuel akışta aralık, otomatik üretimde
// tam sayı) talimat cümlesine çevirmek. Hem app/api/admin/topic-sections/prompt/route.ts
// (manuel kopyala-yapıştır) hem de otomatik klasik soru üretim rotası bunu kullanır.

// Prompt her zaman tek, bilinen bir ders için üretiliyor — bu yüzden SVG yönlendirmesini
// statik bir "bu derslerde daha olası" listesi yerine, o an üretilen dersin adına bakıp
// koşullu (güçlü/zayıf) bir cümle olarak kuruyoruz; model her seferinde sadece kendi
// dersiyle ilgili net bir talimat görür. Anahtar kelime eşleşmesi kullanıyoruz ("Fen
// Bilimleri" -> "fen" içerir) ki bugün ortaokul müfredatında ayrı satırı olmayan ama
// ileride eklenebilecek dersler (Geometri, Fizik, Kimya, Biyoloji, Coğrafya) de otomatik
// yakalansın.
const VISUAL_HEAVY_LESSON_KEYWORDS = ['matematik', 'geometri', 'fen', 'fizik', 'kimya', 'biyoloji', 'cografya'];

function normalizeForMatch(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function buildSvgLessonGuidance(lessonName: string): string {
  const normalized = normalizeForMatch(lessonName);
  const isVisualHeavy = VISUAL_HEAVY_LESSON_KEYWORDS.some((k) => normalized.includes(k));
  return isVisualHeavy
    ? `${lessonName} dersinde görsel sık gerekir; her soruda gerçekten gerekip gerekmediğine bak.`
    : `${lessonName} dersinde görsel genelde gerekmez; sadece istisnai durumda doldur.`;
}

// Soru üretiminde de aynı VISUAL_HEAVY_LESSON_KEYWORDS listesini kullanıyoruz — matematiksel
// ifade (denklem, kesir, üs, kök, formül) geçmesi olası dersler zaten görsel-ağırlıklı
// listeyle örtüşüyor. Soru ekranı artık ders notuyla (SectionContent.tsx) AYNI KaTeX
// motorunu kullanıyor (bkz. MathText.tsx / topicContentV11.ts'teki renderPlainTextMath) —
// bu yüzden AI'dan, ders notu promptlarında zaten doğal olarak kullandığı \( ... \) (satır
// içi) / \[ ... \] (blok) LaTeX sözdizimini burada da istiyoruz; düz metin notasyonu artık
// gerekmiyor. Görsel-ağırlıklı olmayan derslerde placeholder boş string'e döner (gereksiz
// kural eklenmez).
export function buildMathNotationGuidance(lessonName: string): string {
  const normalized = normalizeForMatch(lessonName);
  const isMathHeavy = VISUAL_HEAVY_LESSON_KEYWORDS.some((k) => normalized.includes(k));
  if (!isMathHeavy) return '';
  // Kısa tutuluyor: NotebookLM soru promptlarının toplam sınırı ~3900 karakter (2026-09-26).
  return `- Gerçek matematiksel yapıda (kesir, üs, kök, denklem) LaTeX kullan: satır içi \\( \\), blok \\[ \\] (ör. \\(\\frac{1}{2}\\), \\(x^2+3x-4=0\\)); "1/2", "karekök(16)" gibi düz metin YAZMA. Tek başına sayı/sonuç şıkkını ("50") LaTeX'e SARMA.`;
}

// Klasik soru şablonları hem manuel kopyala-yapıştır akışında (count parametresi yok,
// AI kendi karar versin diye bir aralık verilir) hem de tek-tık otomatik üretimde (admin
// "adet" seçer, AI'dan TAM O SAYIYI istenir) aynı prompt metnini kullanır — tek fark bu
// talimat cümlesi.
export function buildQuestionCountInstruction(countParam: string | number | null, defaultRange: string): string {
  const count = typeof countParam === 'number' ? countParam : countParam ? Number(countParam) : NaN;
  if (Number.isInteger(count) && count > 0) return `TOPLAM TAM OLARAK ${count}`;
  return `TOPLAM ${defaultRange}`;
}
