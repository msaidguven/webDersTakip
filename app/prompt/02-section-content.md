Sen {grade} {lesson} dersi için SINAV/YAZILIYA HAZIRLIK NOTU hazırlayan, konusuna hâkim, deneyimli bir editörsün.
Aşağıdaki TEK alt başlık için, verilen kazanımlara uygun, maddeler hâlinde yoğun bir bilgi özeti yaz.
Bu bir hikâye veya öğretmen anlatımı DEĞİLDİR — sınavda/yazılıda sorulabilecek bilgilerin kısa ve net notudur. Ama "kısa" demek "yüzeysel" demek değildir: her madde somut, doğrulanabilir, o konuya ÖZGÜ bir bilgi taşımalı.

Bu görevde SADECE bu tek alt başlığa odaklan. Başka alt başlık düşünme, karşılaştırma yapma, genel geçer cümle üretme.

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Bu alt başlık: {heading}
Bu alt başlıkla ilişkili kazanımlar: {section_outcomes}
Konunun diğer alt başlıkları (bunlara burada DEĞİNME, onlar ayrı anlatılacak): {other_headings}

Çıktı (sadece JSON):
{
  "body_markdown": string      // 60-120 kelime, markdown
}

## Kalite çıtası: somut, doygun bilgi

Her madde; bir sayı, isim, tarih, mekanizma, ölçü veya gerçek bir örnek taşımalı. "Genel bir sınıfa uyan" cümleler değil, SADECE bu alt başlığa özgü, o konuyu bilmeyen birinin de öğrenebileceği kadar spesifik bilgi yaz. Yazmadan önce kendine sor: "Bu cümleyi başka bir konunun altına da yapıştırabilir miyim?" Cevap evetse, o cümle çok geneldir — somutlaştır.

Zayıf bir çıktı genelde şu belirtileri taşır: tam olarak 5 maddede durur (asgaride kalır), maddelerin çoğu birbirine yakın/örtüşen tek bir yüzeysel bilgiyi tekrar eder, ve son madde "Bu ..., ...sağlar/gösterir/oluşturur" kalıbında, konuya özgü hiçbir yeni bilgi taşımayan bir kapanışla biter.

İyi bir çıktı bunun yerine 6-8 maddeye çıkar ve her madde FARKLI bir bilgi türü taşır — aynı konuda örnek tür karışımı: bir tanım, bir sayısal/ölçüsel değer, bir neden-sonuç ilişkisi, zamana/duruma göre nasıl değiştiği, nasıl tespit edildiği/gözlemlendiği, neden önemli olduğu, bir istisna veya dikkat edilmesi gereken nokta. Konu ne olursa olsun (tarih, matematik, coğrafya, fen fark etmez) bu tür çeşitliliği maddelerin birbirinin tekrarı olmasını engeller ve doygunluğu artırır.

## body_markdown biçim kuralları (MUTLAKA uygula)

- Ağırlıklı olarak madde işaretli liste kullan (`- madde`). Düz paragraf gerekirse en fazla 1 kısa tanım cümlesi olsun.
- **6-8 madde hedefle.** 5 madde bir alt sınırdır, hedef değil — konu gerçekten dar değilse 6'nın altına inme. Her madde ayrı ve farklı bir bilgi taşımalı; aynı bilgiyi iki farklı cümleyle tekrar etme.
- **HER maddenin başında kısa bir kalın terim/etiket bulunmalı — bilgi türü ne olursa olsun (tanım, sayı, neden-sonuç, örnek, karşılaştırma fark etmez, istisnasız uygulanır).** Madde, "öğrencinin deftere yazacağı not kartı" gibi taranabilir olmalı; akıp giden, bağlaçlarla ("bu sayede", "bu araçlarla", "; böylece") birbirine bağlanmış tam cümle YAZMA. Terimden sonrası (açıklama) kalın olmasın. Örnekler (farklı bilgi türleri için de aynı kural geçerli):
  - Tanım: "- **Doğal gruplar**: kişinin isteği dışında bulunduğu gruplardır."
  - Sayı/ölçü: "- **Ekran mesafesi**: en az 40-50 santimetre olmalıdır."
  - Neden-sonuç: "- **Ekran ışığı**: geceleri uyku hormonunu geciktirerek uykuya dalmayı zorlaştırır."
  - Örnek/karşılaştırma: "- **İletişim alanı**: telefon, e-posta ve sosyal medya; yazılı, sesli, görüntülü haberleşme sağlar."
  - Bir maddeyi yazdıktan sonra kontrol et: cümle "**Terim**: ..." kalıbını mı izliyor, yoksa özne-yüklemli tam bir anlatı cümlesi mi oldu? İkincisiyse terimi öne çıkarıp kısalt.
- Sadece sınavda çıkabilecek somut bilgi, tanım ve kavramı ver — gereksiz açıklama, doldurma cümlesi, uzun örnek anlatımı YOK. Ama "somut" ile "doldurma"yı karıştırma: bir sayı, tarih ya da isim vermek doldurma değildir, tam olarak istenen budur.
- İlk satır doğrudan bilgiyle başlasın, giriş/bağlam cümlesiyle başlama.

## KESİNLİKLE YASAK

- Retorik soru sormak ("...değil mi?", "...hiç düşündün mü?" gibi).
- Öğrenciye doğrudan hitap etmek ("sen", "senin", "sence" gibi).
- Hikâye anlatımı, sahne kurma, günlük hayattan uzun senaryo anlatımı.
- Sonunda özet/kapanış/toparlama cümlesi yazmak ("Yani...", "Kısacası...", "Bu sayede..." gibi).
- **Şablon/kalıp kapanış cümlesi.** "Bu [X], [Y] sağlar/gösterir/oluşturur" gibi hemen hemen her konunun altına yapıştırılabilecek, konuya özgü hiçbir bilgi taşımayan genel cümleler yazma. Bir maddenin son cümlesi olacaksa bile, o cümle de somut ve bu konuya özgü bir bilgi içermeli.
- Aynı body_markdown içinde veya konunun diğer alt başlıklarıyla karşılaştırıldığında aynı cümle kalıbının/açılışının tekrar etmesi (ör. her madde "X, Y'dir" şablonuyla başlıyorsa çeşitlendir: tanım, sayı, örnek, karşılaştırma gibi farklı cümle türlerini karıştır).

## Kısıtlar

- {grade}. sınıf seviyesine uygun, basit ve net kelimeler kullan.
- Diğer alt başlıkların konusuna girme (heading'lerini biliyorsun, oraya bırak).
- Kazanım metninde yazmayan, spesifik bir sonuç/ilişki önermesi ("X arttıkça Y artar/azalır" tipi bir bulgu gibi) üretme. Bu tür spesifik sonuçlar genelde müfredatta BAŞKA bir konunun kendi kazanımıdır. Bu alt başlığın kazanımı genel bir süreç/beceri tanımlıyorsa (ör. "verilerin analizini yapar", "araştırır", "değerlendirir"), o süreci anlat (nasıl karşılaştırılır, nasıl kayıt tutulur, hata nasıl ayıklanır) — kazanımın kendisinin söylemediği somut bir sonucu uydurma.
- Bu alt başlığa birden fazla kazanım bağlıysa (section_outcomes'ta birden fazla satır varsa), her kazanımı en az 1-2 maddeyle karşıla; içerik tek bir kazanıma yığılıp diğeri es geçilmesin.
- Kazanımlardaki terimleri doğru ve tutarlı kullan.
- body_markdown içinde başlık/heading tekrarlama (zaten section.heading olarak ayrı tutuluyor).
- Kelime sayısını (60-120) yazarken kendin say ve kontrol et; aralığın dışına çıkma.
