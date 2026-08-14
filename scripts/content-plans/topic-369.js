module.exports = {
  topicId: 369,
  title: 'Kütle ve Ağırlık İlişkisi',
  sections: [
    {
      heading: 'Kütle Kavramı',
      matched_outcome_codes: ['a'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Kütle**, bir cisimde bulunan madde miktarıdır.
- Kütle, **terazi** ile ölçülür ve birimi **kilogram (kg)** veya **gram (g)** dır.
- Bir cismin kütlesi, bulunduğu yere göre değişmez; Dünya'da da Ay'da da aynı kalır.
- Kütlesi büyük olan bir cisim, aynı hacimdeki kütlesi küçük cisme göre daha fazla madde içerir.
- Cisimlerin kütlesi karşılaştırılırken eşit kollu terazi gibi araçlardan yararlanılır.`,
    },
    {
      heading: 'Ağırlık ve Yer Çekimi Kuvveti',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A simple educational flat illustration for children comparing an apple on Earth and the same apple on the Moon, with a downward arrow labeled force pulling it toward the ground in each case, the Earth arrow larger than the Moon arrow, no photorealism, with a Turkish label reading 'Yer Çekimi Kuvveti'.",
      body_markdown: `- **Ağırlık**, bir cisme etki eden yer çekimi kuvvetidir.
- Ağırlık, kütleden farklı olarak bir **kuvvet** türüdür ve birimi Newton (N) dır.
- Bir cismin ağırlığı, bulunduğu gök cisminin yer çekimine göre değişir.
- Aynı cisim, Ay'da Dünya'dakinden daha az ağırlığa sahip olur çünkü Ay'ın yer çekimi Dünya'dan küçüktür.
- Yer çekimi kuvveti, cisimleri gök cisminin merkezine doğru çeker.`,
    },
    {
      heading: 'Kütle ile Ağırlığın Karşılaştırılması',
      matched_outcome_codes: [],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Kütle**, madde miktarını; **ağırlık** ise cisme etki eden yer çekimi kuvvetini ifade eder.
- Kütle değişmezken ağırlık, bulunulan yere göre değişebilir.
- Kütle terazi ile, ağırlık ise dinamometre ile ölçülür.
- Kütlenin birimi kilogram, ağırlığın birimi Newton'dur.
- Günlük dilde "ağırlık" kelimesi kütle yerine kullanılsa da bilimsel olarak bu iki kavram birbirinden farklıdır.`,
    },
    {
      heading: 'Dinamometre ile Ağırlık Ölçümü',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Bir cismin ağırlığı **dinamometre** kullanılarak ölçülür.
- Ölçüm yapılırken cisim dinamometrenin kancasına asılır.
- Cismin ağırlığı nedeniyle yay uzar ve ölçekteki değer Newton cinsinden okunur.
- Aynı cismin farklı dinamometrelerle ölçülen ağırlığı, ölçüm hatası olmadığı sürece aynı çıkar.
- Ölçüm sonuçları kaydedilerek cisimlerin ağırlıkları birbiriyle karşılaştırılabilir.`,
    },
  ],
  cover: {
    subtitle: 'Kütle ile ağırlık arasındaki farkı ve ağırlığın dinamometreyle nasıl ölçüldüğünü öğreniyoruz.',
    image_prompt:
      "An educational flat illustration for children showing a balance scale measuring mass on one side and a spring scale (dynamometer) measuring weight on the other side, simple classroom science style, with Turkish labels reading 'Kütle' and 'Ağırlık', no photorealism.",
    highlights: [
      { position: 'top-left', icon: '⚖️', title: 'Kütle', description: 'Madde miktarı, terazi ile ölçülür' },
      { position: 'top-right', icon: '🌍', title: 'Ağırlık', description: 'Yer çekimi kuvveti, dinamometreyle ölçülür' },
      { position: 'mid-left', icon: '🔁', title: 'Değişmezlik', description: 'Kütle her yerde aynıdır' },
      { position: 'mid-right', icon: '🌙', title: 'Ay’da Farklı', description: 'Ay’da ağırlık Dünya’dan azdır' },
    ],
  },
};
