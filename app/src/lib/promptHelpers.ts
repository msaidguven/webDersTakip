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
// Görselli soru (SVG) sık gereken dersler: matematik/fen listesine ek olarak sosyal bilgiler (harita,
// grafik, tablo). Ayrı liste — LaTeX notasyon kuralı sosyal derslere gitmesin (2026-10-12).
const SVG_HEAVY_LESSON_KEYWORDS = [...VISUAL_HEAVY_LESSON_KEYWORDS, 'sosyal'];

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
  const isVisualHeavy = SVG_HEAVY_LESSON_KEYWORDS.some((k) => normalized.includes(k));
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
// gerekmiyor. Görsel-ağırlıklı olmayan derslerde LaTeX kuralı eklenmez.
// **kalın** vurgu kuralı (2026-10-22) TÜM derslerde eklenir: soru ekranı (renderPlainTextMath) artık
// **…** işliyor; vurgu yalnız iki yerde anlamlı, her yerde kullanılırsa etkisini kaybeder. Türkçe
// üretim ve iki doğrulama prompt'u bu yer tutucuyu kullanmadığı için kural onlarda elle yazılı.
export const QUESTION_EMPHASIS_RULE =
  '- Kalın yazıyı (**…**) YALNIZ soru kökündeki olumsuz ifadede (hangisi **değildir**, **yanlıştır**, **söylenemez**) ve sorusu sorulan sözcükte ("**tatlı** sözcüğü…") kullan; şıklarda ve çözümde kullanma.';

export function buildMathNotationGuidance(lessonName: string): string {
  const normalized = normalizeForMatch(lessonName);
  const isMathHeavy = VISUAL_HEAVY_LESSON_KEYWORDS.some((k) => normalized.includes(k));
  if (!isMathHeavy) return QUESTION_EMPHASIS_RULE;
  // Kısa tutuluyor: NotebookLM soru promptlarının toplam sınırı ~3900 karakter (2026-09-26).
  return `${QUESTION_EMPHASIS_RULE}\n- Gerçek matematiksel yapıda (kesir, üs, kök, denklem) LaTeX kullan: satır içi \\( \\), blok \\[ \\] (ör. \\(\\frac{1}{2}\\), \\(x^2+3x-4=0\\)); "1/2", "karekök(16)" gibi düz metin YAZMA. Tek başına sayı/sonuç şıkkını ("50") LaTeX'e SARMA.`;
}

// Matematik dersleri (yazılı dengesi ve test kalite kurallarındaki oran kuralı).
const MATH_LESSON_KEYWORDS = ['matematik', 'geometri'];

// Test sorusu (çoktan seçmeli / boşluk doldurma / eşleştirme) kalite kuralları — bütün test prompt'larına
// {test_question_quality_rules} ile girer (2026-10-24 soru denetimi). Sebepleri, mevcut sorularda bulunan hatalar:
// "Ders kitabındaki bilgilere göre…" kökleri (67 soru), konu dışı çeldiriciler, uydurma olasılıklar ("güneşli günde
// yağmur %10"), zorluk alanının hiç doldurulmaması (3.179 sorunun hepsi 1), matematikte terim ezberine kayan boşluk
// doldurmalar (225'te 70 işlemli). Matematik oranı kullanıcı kararı: boşluk doldurmanın %80'i işlem.
export function buildTestQuestionQualityRules(lessonName: string): string {
  const normalized = normalizeForMatch(lessonName);
  const isMath = MATH_LESSON_KEYWORDS.some((k) => normalized.includes(k));
  const rules = [
    'Soru kalitesi (MUTLAKA uygula):',
    '- Kaynak atfı YAPMA: kökte ve şıklarda "ders kitabına göre", "kitapta verilen/belirtilen", "bilgi kutusu", "etkinlikte", "okuma parçasında" gibi ifadeler olmasın. Soru kitaptan bağımsız, genel geçer bilgi gibi sorulsun; gereken bilgi kökte verilsin.',
    '- Çeldiriciler: dört şık aynı türden (hepsi terim, hepsi sayı ya da hepsi yargı) ve konuyla ilgili, akla yatkın olsun; konu dışı şık yazma. Doğru şık uzunluğu ya da ayrıntısıyla öbürlerinden ayrışmasın; kök cevabı ele vermesin.',
    '- blank: dört seçeneğin her biri boşluğa dil bilgisi bakımından uysun (yalnız doğru seçenek ekiyle uyuyor olmasın).',
    '- Sayı, oran ya da olasılık yalnız gerçekten hesaplanabiliyorsa yazılsın; gündelik olaylara uydurma kesin değer verme (ör. "yarın yağmur yağması %10").',
    '- matching: sol öğeler kendi aralarında, sağ öğeler kendi aralarında açıkça farklı olsun; her sol öğenin TEK doğru karşılığı olsun.',
    '- Her soru nesnesine (multiple_choice, blank, matching) "difficulty": 1-5 tam sayı ekle (1-2 hatırlama/tanıma, 3 uygulama/yorum, 4-5 çok adımlı akıl yürütme); sorular zorlukça dengeli dağılsın.',
  ];
  if (isMath) {
    rules.push('- Matematik: blank sorularının EN AZ %80\'i işlem sonucu istesin; boşluğa gelen cevap bir sayı ya da sonuç olsun (ör. "36 cm uzunluğundaki şeritten 3/4 cm\'lik _____ parça kesilir."). Terim/tanım boşluğu en fazla %20.');
  }
  return rules.join('\n');
}

// Yazılı (klasik) soru üretiminde matematik dengesi (2026-10-23). Ortak klasik soru kuralları "kendi
// cümleleriyle yorum/neden" diye sözel derslere göre yazılmış; matematiğe aynen uygulanınca 6. Mat 1. yazılı
// havuzunun %34'ü işlemsiz "açıklayınız" sorusu çıktı. Matematikte soru işlemle ölçülür, gerekçe işleme dayanır.
export function buildMathClassicalBalanceRules(lessonName: string): string {
  const normalized = normalizeForMatch(lessonName);
  if (!MATH_LESSON_KEYWORDS.some((k) => normalized.includes(k))) return '';
  return `Matematik dengesi (yukarıdaki "kendi cümleleriyle yorum" kuralının ÖNÜNDEDİR):
- Soruların EN AZ YARISI somut sayılarla işlem/hesap/bulma istesin (ör. "90'ı asal çarpanlarına ayırınız", "52A sayısı 6 ile bölünebildiğine göre A yerine yazılabilecek rakamları bulunuz").
- "Neden/açıklayınız/gerekçelendiriniz" diyen her soru somut bir sayı üzerinde işlem yaptırsın, gerekçe o işleme dayansın (ör. "51 asal mıdır? Çarpanlarını yazarak gerekçelendiriniz").
- Hiç işlem gerektirmeyen saf sözel soru (tanım, "kendi cümlelerinizle açıklayınız", "genelleme/varsayım yazınız") konu başına EN FAZLA 2 olsun.
- Örneklerden kuralı söyleten soru ("5'in katlarına bakıp genelleme yapınız") yerine kuralı uygulatan soru yaz. Kazanımda "varsayım/genelleme" geçse de bunu somut sayıyla sınatarak ölç (ör. "Bu varsayımı 1300 sayısıyla sınayınız").
- Henüz öğretilmemiş gösterim kullanma: harfli/cebirsel ifadeyi yalnız kazanım istiyorsa kullan.
- Günlük hayat bağlamı kullanıyorsan sonuç anlamlı olsun (cevabı 1 çıkan yapay paylaştırma sorusu yazma).`;
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
