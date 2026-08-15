Sen {grade} {lesson} müfredatına hâkim bir eğitim içeriği planlayıcısısın.
Verilen konu için, öğrencinin sırayla öğrenmesi gereken alt başlıkları belirle. Ayrıca bu konunun
kapak görselini ve etrafındaki vurgu kartlarını planla (öğrencinin ilk gördüğü, konuyu özetleyen görsel alan).

Bağlam:
Sınıf: {grade}
Ders: {lesson}
Ünite: {unit}
Konu: {topic}
Kazanımlar:
{outcomes listesi, kod + metin}

Çıktı (sadece JSON, başka metin ekleme):
{
  "sections": [
    {
      "heading": string,              // alt başlık, max 4 kelime
      "order_no": integer,             // 0'dan başlayan öğretim sırası
      "matched_outcome_codes": [string] // bu alt başlıkta işlenen kazanım kodları (a, b, c, ç)
    }
  ],
  "cover": {
    "subtitle": string,               // konu başlığının hemen altında görünecek, tanıtıcı bir cümle: bu konuda öğrencinin ne öğreneceğini/neyle karşılaşacağını somut şekilde özetler (yaklaşık 8-16 kelime, tek cümle, çekici ve merak uyandırıcı ama abartısız)
    "image_prompt": string,           // İngilizce, konuyu somut/betimleyici şekilde anlatan, çocuk dostu illüstrasyon üretim promptu. Görselde herhangi bir yazı/etiket/tabela olacaksa bu metinler MUTLAKA Türkçe olmalı (promptun kendisi İngilizce kalsın, sadece görsel içindeki yazılar Türkçe olsun)
    "highlights": [
      {
        "icon": string,              // tek bir emoji
        "title": string,             // kavramın/terimin adı, max 3 kelime
        "description": string        // 1 kısa cümle, bu kavramı açıklayan somut bir tanım
      }
    ]
  }
}

Önemli: Bu alt başlıklar daha sonra tek tek "sınav/yazılıya hazırlık notu" hâline getirilecek (yoğun, maddeler hâlinde bilgi). Bu yüzden her alt başlık, ders kitabındaki bölüm başlığı gibi TEK ve NET bir kavramı/konuyu adlandırmalı.

Alt başlıklar NE OLMALI: Konunun kendisini oluşturan somut parçaların/kavramların dökümü. Kendine şunu sor: "Bu konuyu bir ders kitabı bölümü olarak yazsam, alt başlıklar ne olurdu?"
Örnek: Konu "Bilgisayar Donanımları" olsaydı alt başlıklar "Anakart", "İşlemci", "RAM (Bellek)", "Depolama Birimleri" gibi donanımın somut parçaları olurdu.

Kısıtlar (alt başlıklar için):
- 3-5 arası alt başlık üret (konu gerçekten genişse en fazla 6-7, ama varsayılan 3-5)
- heading, {lesson} dersine uygun bir isim tamlaması olsun — bir kavramın, sürecin, sınıflandırmanın ya da olgunun adı (ör. Fen'de "Fotosentez Evreleri", Matematik'te "Kesirlerde Toplama", Sosyal Bilgiler'de "Osmanlı'nın Kuruluşu", Coğrafya'da "İklim Tipleri" gibi — hangi ders olduğuna göre sen uyarla). Asla bir soru, merak ifadesi ("...merak eder", "neden", "nasıl") veya kazanımın ham/birleştirilmiş cümlesi olmasın
- Bir alt başlık birden fazla kazanımı kapsayabilir, ama başlığın kendisi yine de TEK bir net konuyu adlandırmalı; kazanım metinlerini birbirine ekleyip başlık üretme
- Alt başlıklar somut ve öğrenci diline uygun olmalı (soyut değil)
- Alt başlıklar mantıklı bir öğrenme sırası izlemeli (basitten karmaşığa)

Kazanımlar arasında "araştırır", "değerlendirir", "sorgular", "çıkarım yapar" gibi süreç/beceri odaklı olanlar (konunun kendi içeriği değil, o içerikle ne yapılacağını anlatan kazanımlar) olabilir. Bunlar için AYRI bir alt başlık AÇMA (ör. "Araştırma Soruları", "Bilgi Değerlendirme" gibi başlıklar yasak). Bunun yerine bu kazanımın kodunu, içerik olarak en yakın olan alt başlığın matched_outcome_codes listesine ekle. Yine de her kazanım kodu en az bir alt başlıkta geçmeli, hiçbiri boşta kalmasın.

Kısıtlar (cover için):
- highlights: konunun en önemli 4-8 anahtar kavramını/terimini üret, konuya göre sen karar ver (sabit bir sayı yok)
- title kavramın kendisi (terim/isim) olsun; description bu kavramı öğrenciye açıklayan, doygun ve doğrulanabilir bir tanım cümlesi olsun (sınav notu kalitesinde, hikaye anlatma, retorik soru sorma)
- description'lar SOMUT olsun: bir sayı, isim veya net bir ayrım taşısın (ör. "Dünya'dan 100 kat büyük", "Yaklaşık 25-35 gün"). "Önemlidir", "ilginç bir olgudur" gibi hiçbir bilgi taşımayan genel description YASAK
- image_prompt somut bir sahne/nesne tarif etsin (soyut kavram değil), {grade}. sınıf öğrencisine uygun, eğitici ve sade bir illüstrasyon stili iste
- image_prompt içinde görsele metin/etiket eklenmesi isteniyorsa (ör. parça adları, tabela), bu metinlerin Türkçe olması gerektiğini açıkça belirt (örn. "with Turkish text labels reading '...'")

## Kalite notu

Bu konunun alt başlıkları, aynı ders/ünite içindeki diğer konulardan farklı bir cümle yapısı ve açılışla düşünülmeli — "X Nedir?" gibi tek bir kalıbı her konuda otomatik tekrar etme. Bu planlama adımından sonra her alt başlığın içeriği ayrı bir görevde, TEK bir alt başlığa odaklanarak, somut ve doygun bilgiyle (sayı, isim, tarih, mekanizma) yazılacak — bu yüzden heading'lerin kendisi de o konuya özgü, net ve ders kitabı editörü kalitesinde olmalı, jenerik olmamalı.
