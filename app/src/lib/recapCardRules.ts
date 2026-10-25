import { readFile } from 'fs/promises';
import path from 'path';

// Hap bilgi kartı kuralları (app/prompt/_recap-card-rules.md) — hem tam konu içerik promptlarında (kart içerikle aynı
// çağrıda) hem kart geri doldurma promptunda (40-section-recap-cards.md) {recap_card_rules} yerine girer.

const MATH_RULES = `
MATEMATİK KURALI:
- items kural/özellik/formül maddeleridir; matematiksel ifadeleri LaTeX ile $...$ içinde yaz (ör. $a + b = 180^\\circ$).
- Her madde kullanılabilir bir kural ya da sınav ipucu olsun (ör. sık yapılan hata, tuzak, kısa yol); aynı kuralı başka sözcüklerle tekrar etme, "dikkate alınarak bulunur" gibi bilgi taşımayan madde yazma.
- **example** ZORUNLU: alt başlığın sınavdaki tipik soru kalıbı. "Kural eşit dediği için cevap aynı sayı" türü TEK ADIMLIK örnek YAZMA — en az iki adım olsun (ör. iki kuralı birleştir ya da bilinmeyeni bul), ama {grade} seviyesini aşma. question 1-2 cümle. solution 2-4 kısa adım, her adım ayrı satırda ("\\n" ile), sonuç son adımda. Sayıları hesapla ve kontrol et.
- **example.figure_prompt**: Soru şekilsiz anlaşılabiliyorsa null ve soruyu öyle yaz (mümkünse şekilsiz örnek seç). Şekil GERÇEKTEN gerekiyorsa (geometri, grafik, sayı doğrusu) çizilecek şeklin kısa DÜZ METİN tarifi: tüm nokta/doğru adları, konumları, verilen ölçüler ve soru işaretli (x) açı/uzunluk — sorudaki ve çözümdeki her ölçü tarifte de geçsin (ör. "d1 // d2 yatay paralel doğrular, k keseni; üst kesişimde sağ üst açı 132°, alt kesişimde sol alt açı x"). SVG kodu YAZMA; şekli başkası çizecek.
- tags genelde boş dizi; yalnız kaynak bir kavram adını açıkça veriyorsa ekle.`;
const DEFAULT_RULES = '- **example** her zaman null.';

export async function buildRecapCardRules(lessonSlug: string | null, gradeName: string): Promise<string> {
  const rules = await readFile(path.join(process.cwd(), 'app', 'prompt', '_recap-card-rules.md'), 'utf8');
  // Ders kuralı önce: içinde {grade} geçiyor.
  return rules.replaceAll('{lesson_kind_rules}', lessonSlug === 'matematik' ? MATH_RULES : DEFAULT_RULES).replaceAll('{grade}', gradeName);
}
