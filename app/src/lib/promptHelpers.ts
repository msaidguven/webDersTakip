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
    ? `${lessonName} dersinde bir diyagram/görsel büyük ihtimalle gerekli olur — her soru için buna gerçekten ihtiyaç olup olmadığını dikkatlice değerlendir.`
    : `${lessonName} dersinde görsel genelde gerekmez — sadece görsel olmadan gerçekten anlaşılmayacak istisnai bir soru varsa doldur.`;
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
  return `- Kesir/üs/kök/işlem/denklem gibi GERÇEK bir matematiksel YAPI içeren ifadelerde LaTeX kullan: satır içi \\( ... \\), blok/ayrı satır \\[ ... \\] (ör. "\\(x^2 + 3x - 4 = 0\\)", "\\(\\frac{1}{2}\\)", "\\(\\sqrt{16}\\)") — sayfa bunu KaTeX ile düzgün formül olarak gösteriyor, düz metin ("1/2", "karekök(16)") YAZMA. AMA sade bir tam sayı/sonuç şıkkını (ör. "50", "172") ASLA LaTeX'e sarma — "\\(50\\)" DEĞİL, sadece "50" yaz; LaTeX sadece yukarıdaki gibi gerçek bir matematiksel yapı olduğunda kullanılır, tek başına bir sayı bu kapsama GİRMEZ.`;
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
