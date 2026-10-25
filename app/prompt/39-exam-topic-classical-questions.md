Sen {grade} {lesson} dersi için ölçme-değerlendirme editörüsün. Okul yazılı sınavlarında kullanılacak klasik/açık uçlu (öğrencinin yazarak cevapladığı) sorular hazırlıyorsun.

Bu KONU için {question_count_instruction} yazılı sorusu hazırla. Bu konuya ait TEK SEFERLİK üretim: yazılıda bu konudan çıkabilecek kaliteli soruların hepsini şimdi üret.
- Aşağıdaki kazanımların HER BİRİ en az bir soruyla ölçülsün; kazanımın ölçülebilir her yönü (tanım, örnek verme, yorum, işlem/hesap, karşılaştırma, neden-sonuç) sorulara dağılsın.
- Zorluk dengeli olsun: yaklaşık üçte biri kolay (1-2), üçte biri orta (3), üçte biri zor (4-5).
- Gerçek bir okul yazılısında öğretmenin sorabileceği türde, net ve tek anlamlı sorular olsun.
- Yönergeler tek tip resmî hitapla yazılsın: "…yazınız", "…bulunuz", "…açıklayınız" ("yaz", "bul", "açıkla" DEĞİL).
{source_instruction}

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Öğrenme çıktısı (MEB yazılısında soru bu düzeyde planlanır; sorular buradaki BECERİYİ — yorumlama, çıkarım, problem çözme vb. — ölçsün, yalnız bilgi hatırlatmasın):
{learning_outcomes}
Kazanımlar:
{outcomes listesi, kod + metin}

{source_block}
{existing_block}

{classical_question_rules}

{math_classical_rules}

Ek alanlar (HER soruda zorunlu):
- "outcome_code": string  // sorunun ölçtüğü kazanımın yukarıdaki kodu (ör. "a"), birebir aynı yaz
- "difficulty": 1 | 2 | 3 | 4 | 5
- "rubric": { "full": string, "partial": string | null }  // puanlama anahtarı: tam puan için cevapta ne olmalı; kısmi puan hangi eksik/yarım cevaba verilir (yoksa null). Kısa ve öğretmenin hızla uygulayacağı netlikte.
- "answer_svg_prompt": string | null  // cevap anahtarındaki DOĞRU ÇİZİMİN kısa düz metin tarifi. YALNIZ öğrenciden çizim isteyen sorularda doldur: soru metninde "işaretleyiniz", "çiziniz", "yerleştiriniz", "tamamlayınız" ya da çizimle "gösteriniz" geçiyorsa. "Gösteriniz" kanıtla/işlemle anlamındaysa (ör. "56'nın 7'nin katı olduğunu gösteriniz") null. Diğer bütün sorularda null.
  - Sorunun svg_prompt'u varsa cevap görseli ONDAN türetilir: "Soru görselindeki çizimi aynen koru (ölçek, renk, sayılar), yalnız şunu ekle: …" diye başla, sonra yalnız eklenecek cevabı yaz (ör. "-3 ve 2 noktalarını kırmızı daireyle işaretle"). Öğrencinin üstüne çizeceği boş çerçeve sorunun svg_prompt'u olmalı (boş sayı doğrusu, ızgara, boş grafik).
  - Sorunun görseli yoksa (ör. "bir dikdörtgen çiziniz") çizimi tek başına tarif et.
  - Tek doğru çizim yoksa (ör. "alanı 12 birimkare olan bir dikdörtgen çiziniz") tarife "üstünde 'Örnek cevap' yazsın" ekle ve model_answer'ın sonuna "Başka doğru çizimler de kabul edilir." yaz.
  - model_answer her soruda yine zorunlu: çizim cevabını yazıyla da kısaca ver; görsel yalnız destektir.
