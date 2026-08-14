module.exports = {
  topicId: 366,
  title: 'Gökyüzündeki Komşumuz: Ay',
  sections: [
    {
      heading: "Ay'ın Özellikleri",
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple, educational flat illustration for children showing the Moon up close with visible craters, mountains and flat plain areas on its gray surface, no atmosphere, space background with stars, no photorealism, no text.",
      body_markdown: `- Ay, Dünya'nın tek doğal **uydusu**dur.
- Kendi ışığı yoktur; gökyüzünde parlak görünmesinin sebebi Güneş ışığını yansıtmasıdır.
- Yüzeyinde **kraterler** (çukurlar), dağlar ve düz ovalar bulunur.
- Kraterler, genellikle gök taşı çarpmaları sonucu oluşmuştur.
- Atmosferi yoktur; bu yüzden yüzeyinde rüzgâr, yağmur gibi hava olayları yaşanmaz ve krater izleri milyonlarca yıl silinmeden kalır.`,
    },
    {
      heading: "Ay'ın Dönme ve Dolanma Hareketi",
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Ay, kendi ekseni etrafında **dönme hareketi** yapar.
- Aynı zamanda Dünya'nın çevresinde **dolanma hareketi** yapar.
- Her iki hareketini de yaklaşık 27,3 günde tamamlar; bu nedenle bu iki süre birbirine eşittir.
- Dönme ve dolanma sürelerinin eşit olması nedeniyle Ay, Dünya'dan her zaman aynı yüzüyle görülür.
- Gözlemlerle elde edilen bu hareket verileri düzenli olarak kaydedilerek Ay'ın davranışı hakkında bilgi oluşturulur.`,
    },
    {
      heading: 'Ay Evrelerinin Oluşumu',
      matched_outcome_codes: ['c'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Ay evreleri**, Ay'ın Dünya çevresindeki dolanması sırasında Güneş'e göre konumunun değişmesiyle oluşur.
- Ay'ın Güneş ışığıyla aydınlanan kısmının Dünya'dan görünen oranı sürekli değişir.
- Sırasıyla **yeni ay**, **hilal**, **ilk dördün**, **dolunay** ve **son dördün** evreleri gözlenir.
- Bir evreden aynı evreye dönüş yaklaşık 29,5 gün sürer.
- Toplanan gözlem verileri karşılaştırılıp değerlendirilerek evre sıralamasının düzenli bir döngü izlediği sonucuna varılır.`,
    },
    {
      heading: 'Ay Evreleri Modeli',
      matched_outcome_codes: ['ç', 'd'],
      needs_image: true,
      image_prompt:
        "An educational classroom diagram for children showing a simple model of Moon phases: Earth in the center with a small ball representing the Moon at eight positions around it in a circle, each position showing the corresponding illuminated shape, flat illustration style, with Turkish labels reading 'Yeni Ay', 'İlk Dördün', 'Dolunay', 'Son Dördün' at the relevant positions, no photorealism.",
      body_markdown: `- Ay evrelerini göstermek için basit araç gereçlerle **model** oluşturulabilir (ör. bir top ve bir ışık kaynağı kullanılarak).
- Modelde ışık kaynağı Güneş'i, top Ay'ı, gözlemci ise Dünya'yı temsil eder.
- Topun ışığa göre farklı konumlara getirilmesiyle her evredeki aydınlanma şekli gözlenir.
- Yeni gözlem ve kanıtlar elde edildikçe model gözden geçirilir ve daha doğru sonuç verecek şekilde geliştirilir.
- Geliştirilen model, gerçek Ay evrelerinin sırasını ve oluşum nedenini doğru biçimde yansıtmalıdır.`,
    },
  ],
  cover: {
    subtitle: 'Ay’ın yüzey özelliklerini, dönme-dolanma hareketini ve evrelerinin nasıl oluştuğunu inceliyoruz.',
    image_prompt:
      "A clear educational flat illustration for children showing the Moon in eight phases arranged in a circle around a small Earth in the center, each Moon phase showing a different illuminated shape from new moon to full moon, space background with stars, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '🌕', title: 'Doğal Uydu', description: 'Dünya’nın tek uydusu' },
      { position: 'top-right', icon: '🕳️', title: 'Kraterler', description: 'Gök taşı çarpma izleri' },
      { position: 'mid-left', icon: '🔄', title: 'Eşit Süre', description: 'Dönme ve dolanma 27,3 gün' },
      { position: 'mid-right', icon: '🌓', title: 'Ay Evreleri', description: 'Yeni ay, dolunay ve arası' },
      { position: 'bottom-right', icon: '🧪', title: 'Model Kurma', description: 'Top ve ışıkla evre modeli' },
    ],
  },
};
