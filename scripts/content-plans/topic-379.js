module.exports = {
  topicId: 379,
  title: 'Madde ve Isı',
  sections: [
    {
      heading: 'Isı İletkenleri',
      matched_outcome_codes: ['a'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Isı iletkeni** maddeler, ısıyı hızlı biçimde bir uçtan diğer uca aktarır.
- Demir, bakır, alüminyum gibi **metaller** iyi ısı iletkenidir.
- Tencere ve tava gibi mutfak eşyalarının gövdesi, ısıyı hızlı iletmesi için metalden yapılır.
- Bir metal çubuğun bir ucu ısıtıldığında kısa sürede diğer ucunun da ısındığı hissedilir.
- Bu hızlı ısı aktarımı, ısı iletkeni maddeleri tanımanın temel yoludur.`,
    },
    {
      heading: 'Isı Yalıtkanları',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Isı yalıtkanı** maddeler, ısıyı çok yavaş iletir ya da neredeyse hiç iletmez.
- Tahta, plastik, kumaş, cam yünü ve strafor gibi maddeler ısı yalıtkanıdır.
- Tencere sapının plastik veya tahta olması, elin sıcaktan korunmasını sağlar.
- Kışlık kıyafetlerin kalın kumaştan yapılması, vücut ısısının dışarı kaçmasını yavaşlatır.
- Bina duvarlarına yalıtım malzemesi konması, iç ortamın ısısını korumaya yardımcı olur.`,
    },
    {
      heading: 'İletken ve Yalıtkanların Sınıflandırılması',
      matched_outcome_codes: ['c', 'ç'],
      needs_image: true,
      image_prompt:
        "An educational classroom chart illustration for children with two columns of everyday objects: metal spoon, metal pot and copper wire under 'heat conductor', and wooden spoon, plastic handle and wool sweater under 'heat insulator', flat illustration style, with Turkish column headers reading 'Isı İletkeni' and 'Isı Yalıtkanı', no photorealism.",
      body_markdown: `- Maddeler, ısıyı iletme hızına göre iki grupta etiketlenir: **ısı iletkenleri** ve **ısı yalıtkanları**.
- Metal kaşık, bakır tel ve alüminyum folyo ısı iletkeni grubuna girer.
- Tahta kaşık, plastik kap ve yün kumaş ısı yalıtkanı grubuna girer.
- Bu sınıflandırma yapılırken maddenin bir ucuna verilen ısının diğer uca ne kadar hızlı ulaştığı gözlenir.
- Günlük eşyaların tasarımında hangi maddenin iletken hangi maddenin yalıtkan olacağı bu sınıflandırmaya göre seçilir.`,
    },
    {
      heading: 'Isı Yalıtımı Modeli',
      matched_outcome_codes: ['d', 'e'],
      needs_image: true,
      image_prompt:
        "A children's science project illustration showing two small cups of hot water, one wrapped in cotton or wool as insulation and one left bare, with a thermometer in each, comparing which stays warm longer, flat illustration style, no photorealism, no text.",
      body_markdown: `- Isı yalıtımını incelemek için basit malzemelerle (pamuk, kumaş, köpük gibi) bir **model** önerilebilir.
- Örneğin aynı sıcaklıktaki iki bardak sıcak suyun biri yalıtım malzemesiyle sarılır, diğeri açık bırakılır.
- Belirli aralıklarla ölçülen sıcaklıklar karşılaştırılarak yalıtılmış bardağın suyunun daha yavaş soğuduğu görülür.
- Beklenenden farklı bir sonuç çıkarsa (ör. yalıtım malzemesi yeterince kalın değilse) modelin malzemesi veya kalınlığı değiştirilir.
- Yeni ölçüm sonuçlarına (kanıtlara) göre model yenilenerek daha etkili bir yalıtım düzeneği elde edilir.`,
    },
  ],
  cover: {
    subtitle: 'Isıyı hızlı ileten ve yavaş ileten maddeleri ayırt ediyor, basit bir yalıtım modeli kuruyoruz.',
    image_prompt:
      "An educational flat illustration for children showing a metal spoon and a wooden spoon both placed in a cup of hot water, with a small heat wave icon quickly traveling up the metal spoon and barely moving on the wooden spoon, no photorealism, with Turkish labels reading 'İletken' and 'Yalıtkan'.",
    highlights: [
      { position: 'top-left', icon: '🥄', title: 'Isı İletkeni', description: 'Metaller ısıyı hızlı iletir' },
      { position: 'top-right', icon: '🧣', title: 'Isı Yalıtkanı', description: 'Tahta, plastik yavaş iletir' },
      { position: 'mid-left', icon: '🍳', title: 'Tencere Sapı', description: 'Yalıtkan malzemeden yapılır' },
      { position: 'mid-right', icon: '🧪', title: 'Yalıtım Modeli', description: 'Sıcaklığı koruma deneyi' },
    ],
  },
};
