module.exports = {
  topicId: 275,
  title: 'Doğal ve Beşerî Çevre Özellikleri Arasındaki İlişki',
  sections: [
    {
      heading: 'Doğanın Bize Sunduğu Özellikler',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple, colorful flat illustration for children showing a diverse Turkish landscape cross-section: a green rainy coastal hill, a dry plain, a river, and a lake, each labeled in Turkish with small text ('Yayla', 'Ova', 'Akarsu', 'Göl'). Educational, non-photorealistic illustration style, bright natural colors.",
      body_markdown: `- **Doğal çevre**, insan müdahalesi olmadan var olan dağ, ova, akarsu, göl ve iklim gibi unsurlardır.
- Çukurova ve Konya Ovası gibi düz ve verimli araziler, tarıma elverişli doğal alanlardır.
- Karadeniz kıyılarında bol yağış ve yeşillik görülürken, İç Anadolu'da kurak bir iklim hâkimdir.
- Akarsular, göller ve denizler; hem su kaynağı hem de ulaşım ve balıkçılık imkânı sunar.
- Her bölgenin doğal özellikleri, o bölgede yaşayan insanların hayatını doğrudan şekillendirir.`,
    },
    {
      heading: 'İnsanın Çevreye Kattıkları',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        'A simple, colorful flat illustration for children showing a coastal city scene inspired by a strait, with houses, a bridge, boats, and a small road, representing human settlement shaped by geography. Educational illustration style, bright colors, no text.',
      body_markdown: `- **Beşerî çevre**, insanların yerleşim, üretim ve ulaşım amacıyla oluşturduğu yapılardır.
- Şehirler, köyler, fabrikalar, yollar ve tarım arazileri beşerî çevrenin somut örnekleridir.
- İstanbul Boğazı çevresindeki yoğun yerleşim, hem doğal güzellik hem de ulaşım kolaylığından kaynaklanır.
- Nüfus yoğunluğu, sanayi tesisleri ve tarım alanları, bir bölgenin beşerî çevresini tanımlayan göstergelerdir.
- Beşerî çevre sabit değildir; insan ihtiyaçlarına göre zamanla değişip gelişir.`,
    },
    {
      heading: 'Doğa ile İnsan Faaliyetlerinin Birbirini Etkilemesi',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Doğal çevre özellikleri, insanların nerede yerleşeceğini ve hangi işle uğraşacağını doğrudan etkiler.
- Verimli ovalarda tarım, akarsu kıyılarında yerleşim, düz ve geniş arazilerde ise sanayi daha çok gelişir.
- Dağlık ve engebeli bölgelerde yerleşim seyrek, ulaşım ise genellikle daha zordur.
- İklim; giyim tarzını, konut yapısını ve yetiştirilen tarım ürünlerini büyük ölçüde belirler.
- Zamanla insan faaliyetleri de doğayı etkiler; örneğin ormanların azalması iklimi ve toprak yapısını değiştirebilir.`,
    },
  ],
  cover: {
    subtitle: "Çukurova'nın verimli ovalarından İstanbul Boğazı'na, doğal çevrenin insan yerleşimini nasıl şekillendirdiğini anlatıyor.",
    image_prompt:
      'A warm, colorful flat illustration for children showing a split landscape: one half with mountains, a river, and farmland representing nature, the other half with a small town and roads representing human settlement, connected by a winding path. Educational illustration style, no photorealism, no text.',
    highlights: [
      { position: 'top-left', icon: '⛰️', title: 'Doğal Çevre', description: 'Dağ, ova, iklim, sular' },
      { position: 'top-right', icon: '🏙️', title: 'Beşerî Çevre', description: 'Yerleşim, sanayi, tarım' },
      { position: 'mid-left', icon: '🌾', title: 'Verimli Ovalar', description: 'Çukurova, Konya Ovası' },
      { position: 'mid-right', icon: '🔗', title: 'Karşılıklı Etki', description: 'Doğa insanı, insan doğayı şekillendirir' },
    ],
  },
};
