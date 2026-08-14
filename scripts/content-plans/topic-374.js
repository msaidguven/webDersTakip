module.exports = {
  topicId: 374,
  title: 'Madde ve Işık',
  sections: [
    {
      heading: 'Saydam Maddeler',
      matched_outcome_codes: ['a'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Saydam (şeffaf) maddeler**, üzerlerine gelen ışığın büyük bölümünü geçirir.
- Bu maddelerin arkasındaki cisimler net biçimde görülebilir.
- Cam, temiz su ve bazı plastik türleri saydam maddelere örnektir.
- Pencere camlarının saydam olması, ışığın içeri girmesini ve dışarının görülmesini sağlar.
- Saydam maddelerin ışığı geçirme özelliği, gözlük camı gibi araçların yapımında kullanılır.`,
    },
    {
      heading: 'Yarı Saydam Maddeler',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Yarı saydam maddeler**, üzerlerine gelen ışığın bir kısmını geçirir, bir kısmını geçirmez.
- Bu maddelerin arkasındaki cisimler net değil, bulanık biçimde görülür.
- Buzlu cam, yağlı kâğıt ve ince perde kumaşı yarı saydam maddelere örnektir.
- Banyo pencerelerinde kullanılan buzlu cam, ışığın içeri girmesini sağlarken mahremiyeti korur.
- Yarı saydam maddeler, saydam ile opak maddeler arasında bir geçirgenlik seviyesine sahiptir.`,
    },
    {
      heading: 'Saydam Olmayan (Opak) Maddeler',
      matched_outcome_codes: ['c'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Opak (saydam olmayan) maddeler**, üzerlerine gelen ışığı hiç geçirmez.
- Bu maddelerin arkasındaki cisimler görülemez.
- Tahta, metal, karton ve duvar opak maddelere örnektir.
- Opak bir madde ışığın önüne konduğunda arkasında **gölge** oluşur.
- Perde, kapı gibi eşyaların opak olması, ışığı tamamen engelleyerek arkasını gizler.`,
    },
    {
      heading: 'Maddelerin Işık Geçirgenliğine Göre Sınıflandırılması',
      matched_outcome_codes: ['ç'],
      needs_image: true,
      image_prompt:
        "An educational classroom chart illustration for children with three columns showing everyday objects sorted by light transmission: clear glass and water under one column, frosted glass and thin curtain under another, and wood and metal under the last, with Turkish column headers reading 'Saydam', 'Yarı Saydam', 'Saydam Olmayan', flat illustration style, no photorealism.",
      body_markdown: `- Maddeler, ışığı geçirme durumlarına göre üç grupta etiketlenir: **saydam**, **yarı saydam** ve **saydam olmayan (opak)**.
- Bu sınıflandırma yapılırken maddenin arkasına konan bir cismin ne kadar net görülebildiğine bakılır.
- Cam ve su saydam grubuna, buzlu cam ve ince kumaş yarı saydam grubuna, tahta ve metal ise opak gruba etiketlenir.
- Aynı madde farklı kalınlıkta olduğunda ışık geçirgenliği değişebilir (ör. ince kâğıt yarı saydam iken kalın kâğıt opak olabilir).
- Bu sınıflandırma, günlük hayatta pencere, gözlük veya perde gibi malzemelerin seçiminde kullanılır.`,
    },
  ],
  cover: {
    subtitle: 'Cam, buzlu cam ve tahta gibi maddeleri ışığı geçirme durumlarına göre sınıflandırıyoruz.',
    image_prompt:
      "An educational flat illustration for children showing a flashlight shining onto three different materials in a row: clear glass letting light pass fully, frosted glass letting light pass partially with a blurry shadow, and a wooden board blocking light completely with a sharp shadow, no photorealism, with Turkish labels reading 'Saydam', 'Yarı Saydam', 'Saydam Değil'.",
    highlights: [
      { position: 'top-left', icon: '🪟', title: 'Saydam', description: 'Işığı tamamen geçirir (cam, su)' },
      { position: 'top-right', icon: '🌫️', title: 'Yarı Saydam', description: 'Işığın bir kısmını geçirir' },
      { position: 'mid-left', icon: '🪵', title: 'Saydam Değil', description: 'Işığı hiç geçirmez (tahta, metal)' },
      { position: 'mid-right', icon: '🌑', title: 'Gölge Oluşumu', description: 'Opak maddelerin arkasında oluşur' },
    ],
  },
};
