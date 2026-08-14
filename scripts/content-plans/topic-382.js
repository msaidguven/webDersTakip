module.exports = {
  topicId: 382,
  title: 'Evsel Atıklar ve Geri Dönüşüm',
  sections: [
    {
      heading: 'Evsel Atıklar Nedir?',
      matched_outcome_codes: ['a'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Evsel atıklar**, evlerde günlük yaşam sırasında ortaya çıkan ve artık kullanılmayan maddelerdir.
- Yemek artıkları, kâğıt, karton, cam şişe, plastik ambalaj ve metal kutu evsel atıklara örnektir.
- Bazı atıklar doğada kısa sürede çürüyerek yok olur, bazıları ise yüzyıllarca doğada kalabilir.
- Plastik atıkların doğada çözünmesi çok uzun yıllar alır.
- Evsel atıkların türüne göre tanınması, doğru şekilde ayrıştırılmasının ilk adımıdır.`,
    },
    {
      heading: 'Geri Dönüştürülebilen ve Dönüştürülemeyen Atıklar',
      matched_outcome_codes: ['b', 'c', 'ç'],
      needs_image: true,
      image_prompt:
        "An educational flat illustration for children showing four colored recycling bins labeled for paper, plastic, glass and metal, with example items floating above each bin, bright colors, with Turkish labels reading 'Kâğıt', 'Plastik', 'Cam', 'Metal', no photorealism.",
      body_markdown: `- Evsel atıklar, **geri dönüştürülebilen** ve **geri dönüştürülemeyen** olarak ikiye ayrıştırılır.
- Kâğıt, karton, cam, plastik ve metal atıklar geri dönüştürülebilen gruba girer.
- Yemek artığı gibi organik atıklar ve kirli/yağlı ambalajlar genellikle geri dönüştürülemeyen gruba girer.
- Geri dönüştürülebilen atıklar kendi içinde de türüne göre (kâğıt, cam, plastik, metal) gruplandırılır.
- Bu gruplandırma, atıkların renkli kutulara doğru şekilde etiketlenerek atılmasını sağlar.`,
    },
    {
      heading: 'Kaynakların Etkili Kullanımı ve Geri Dönüşümün Önemi',
      matched_outcome_codes: ['d', 'e', 'f'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Kaynakların etkili kullanımı**, doğal kaynakların gereksiz yere tüketilmemesi ve israf edilmemesidir.
- Geri dönüşüm, kullanılmış maddelerin yeniden işlenerek yeni ürünlere dönüştürülmesidir.
- Geri dönüşüm sayesinde ağaç, su ve enerji gibi doğal kaynaklar daha az tüketilir.
- Bir bölgede toplanan geri dönüştürülebilir atık miktarı düzenli olarak kaydedilerek zaman içindeki değişim izlenebilir.
- Kaydedilen veriler değerlendirildiğinde, geri dönüşüm oranı arttıkça doğal kaynak tüketiminin azaldığı görülür.`,
    },
    {
      heading: 'Çevremizde Atık Yönetimi',
      matched_outcome_codes: ['g', 'ğ', 'h'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Yakın çevredeki atık yönetimi uygulamaları (çöp toplama, geri dönüşüm kutuları, kompost alanları) gözden geçirilebilir.
- Evde veya okulda atıkların ayrıştırılıp ayrıştırılmadığı, geri dönüşüm kutularının yeterli olup olmadığı incelenebilir.
- Bu gözlemlerden yola çıkarak "geri dönüşüm kutusu bulunan yerlerde atıklar daha düzenli ayrıştırılır" gibi bir çıkarım yapılabilir.
- Yapılan çıkarımlar, farklı ortamlardaki gözlemlerle karşılaştırılarak değerlendirilir.
- Bu değerlendirme, yakın çevredeki atık yönetiminin geliştirilmesi için neler yapılabileceğine dair fikir verir.`,
    },
  ],
  cover: {
    subtitle: 'Evsel atıkları geri dönüştürülebilenlere ayırıyor, geri dönüşümün doğal kaynakları nasıl koruduğunu inceliyoruz.',
    image_prompt:
      "A colorful educational flat illustration for children showing a family sorting household waste into four labeled recycling bins for paper, plastic, glass and metal in a home kitchen setting, no photorealism, with Turkish labels reading 'Kâğıt', 'Plastik', 'Cam', 'Metal'.",
    highlights: [
      { position: 'top-left', icon: '🗑️', title: 'Evsel Atık', description: 'Günlük yaşamdan çıkan artıklar' },
      { position: 'top-right', icon: '♻️', title: 'Geri Dönüşüm', description: 'Atığı yeniden işleme süreci' },
      { position: 'mid-left', icon: '📦', title: 'Ayrıştırma', description: 'Kâğıt, cam, plastik, metal' },
      { position: 'mid-right', icon: '🌳', title: 'Kaynak Tasarrufu', description: 'Ağaç, su ve enerji korunur' },
      { position: 'bottom-left', icon: '🏘️', title: 'Yakın Çevre', description: 'Atık yönetimini gözlemleme' },
    ],
  },
};
