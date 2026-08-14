module.exports = {
  topicId: 424,
  title: 'Yapay Zekâda Temel Kavram ve Özellikler',
  sections: [
    {
      heading: 'Yapay Zekâ Nedir?',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A bright educational flat illustration for children showing a friendly small robot with a glowing light-bulb head next to a smartphone displaying a simple voice-wave icon, a robot vacuum cleaner in the corner, colorful and simple classroom style, no photorealism, no text.",
      body_markdown: `- **Yapay zekâ (YZ)**, bilgisayarların öğrenme, karar verme ve problem çözme gibi insana özgü sayılan işleri belirli ölçüde yapabilmesini sağlayan bilgisayar bilimi alanıdır.
- Terim ilk kez 1956 yılında ABD'de düzenlenen Dartmouth Konferansı'nda kullanılmıştır.
- Sıradan bir program yalnızca kendisine önceden yazılan komutları uygular; YZ ise incelediği örneklerden ders çıkararak yeni durumlara uyum sağlayabilir.
- Bir görevi çok iyi yapan ama o görevin dışına çıkamayan YZ türüne **dar yapay zekâ** denir; günümüzdeki uygulamaların büyük bölümü bu gruptadır.
- **Robot süpürgeler**, bulunduğu odanın haritasını çıkarıp engelleri algılayarak hareket yönünü kendi kendine belirler.
- Telefonlardaki konuşma tanıma uygulamaları, söylenen cümleyi anlayıp yazıya dönüştürebilir.`,
    },
    {
      heading: 'Yapay Zekâ Nasıl Öğrenir?',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple educational flat illustration for children showing a computer screen displaying a grid of many small cat photos on one side and a single output cat icon with a checkmark on the other side, arrows connecting them to show a learning process, colorful, no photorealism, no text.",
      body_markdown: `- YZ sistemleri, kendisine verilen çok sayıda **örnek veri** ile eğitilir; örneğin binlerce fotoğraf gösterilerek bir nesnenin nasıl tanınacağı öğretilir.
- Sistem, örnekler arasındaki ortak özellikleri (şekil, renk, ses gibi) karşılaştırarak bir **kalıp** yakalamaya çalışır.
- Öğrenme süreci deneme yanılmaya dayanır: sistem bir tahmin yapar, doğru cevapla karşılaştırılır ve hata payı azaltılmaya çalışılır.
- Ne kadar çok ve çeşitli örnek kullanılırsa, tahminlerin doğruluğu genellikle o kadar artar.
- Yetersiz ya da tek taraflı örneklerle eğitilen bir sistem, yanlış ya da taraflı sonuçlar üretebilir.
- Basit bir görevin öğrenilmesi az örnekle mümkünken, karmaşık bir görev çok daha fazla örnek gerektirir.`,
    },
    {
      heading: 'Günlük Hayatta Yapay Zekâ',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A colorful flat illustration for children showing a grid of everyday AI examples: a smartphone with a face-unlock icon, a map app with a route line, a shopping app with a recommended-items list, and an email icon with a spam filter symbol, simple educational style, no photorealism, no text.",
      body_markdown: `- Telefon ve bilgisayarlardaki **yüz tanıma** kilit açma sistemleri, kişinin yüz özelliklerini önceden kaydedilen görüntüyle karşılaştırır.
- Harita uygulamaları, trafik yoğunluğu verilerini işleyerek en kısa veya en hızlı rotayı önerir.
- Alışveriş ve video sitelerindeki **öneri sistemleri**, önceki arama ve tıklamalara bakarak yeni içerik önerir.
- Bazı bilgisayar oyunlarında yapay zekâ destekli rakip, oyuncunun hamlelerine göre stratejisini değiştirerek oynar.
- E-posta uygulamaları, istenmeyen (spam) mesajları içeriklerindeki ortak özelliklere bakarak otomatik olarak ayıklar.
- Sesli asistanlar, konuşulan cümleyi metne çevirip anlamlandırarak uygun yanıtı veya işlemi gerçekleştirir.
- Akıllı ev sistemlerinde oda sıcaklığı ya da ışık düzeyi, kullanıcının önceki tercihlerine göre otomatik ayarlanabilir.`,
    },
    {
      heading: 'Yapay Zekânın Sınırları ve Güvenilirliği',
      matched_outcome_codes: ['ç', 'd'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Bir YZ sisteminin öğrendiği veriler hatalı ya da eksikse, ürettiği sonuçlar da hatalı olabilir.
- YZ uygulamasından gelen bir bilginin doğruluğu, güvenilir başka bir kaynakla karşılaştırılarak kontrol edilmelidir.
- YZ, insan gibi bir konuyu tam anlamıyla kavramaz; öğrendiği örnekler doğrultusunda olasılığa dayalı tahminler üretir.
- Yanlış ya da yanıltıcı bilgi üretmesi mümkündür; bu yüzden verdiği cevaplar tek kaynak olarak kabul edilmemelidir.
- YZ destekli uygulamalar, zaman kazandırma ve tekrarlayan işleri kolaylaştırma gibi olumlu etkiler sağlayabilir.
- Ses, görüntü veya konum gibi kişisel bilgilerin YZ sistemlerine aktarılması, gizlilik açısından dikkat gerektiren bir durumdur.
- Bir YZ uygulaması kullanılırken, bilgiyi kimin sağladığı ve hangi amaçla toplandığı sorgulanmalıdır.`,
    },
  ],
  cover: {
    subtitle:
      'Yapay zekânın ne olduğunu, nasıl öğrendiğini, günlük hayattaki örneklerini ve güvenilirliğini keşfediyoruz.',
    image_prompt:
      "A bright, friendly flat illustration for children showing a small robot with a glowing light-bulb head standing next to a smartphone with a simple voice-wave icon, surrounded by small icons representing a map route, a recommendation list, and a magnifying glass, colorful educational style, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '📅', title: 'Dartmouth Konferansı', description: "1956'da ilk kez adlandırıldı" },
      { position: 'top-right', icon: '📊', title: 'Örnekten Öğrenme', description: 'Binlerce veriyle eğitilir' },
      { position: 'mid-left', icon: '🎙️', title: 'Sesli Asistanlar', description: 'Konuşmayı yazıya çevirir' },
      { position: 'mid-right', icon: '🎬', title: 'Öneri Sistemleri', description: 'Geçmiş tercihe göre önerir' },
      { position: 'bottom-left', icon: '🔍', title: 'Güvenilirlik Kontrolü', description: 'Bilgi kaynakla karşılaştırılmalı' },
    ],
  },
};
