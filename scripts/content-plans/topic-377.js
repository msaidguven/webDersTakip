module.exports = {
  topicId: 377,
  title: 'Isı ve Sıcaklık',
  sections: [
    {
      heading: 'Isı ve Sıcaklık Nedir?',
      matched_outcome_codes: ['a'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Isı**, sıcak bir maddeden soğuk bir maddeye aktarılan bir **enerji** türüdür.
- **Sıcaklık**, bir maddenin ne kadar sıcak veya soğuk olduğunu gösteren bir ölçüdür.
- Isı, **kalorimetre** benzeri araçlarla; sıcaklık ise **termometre** ile ölçülür.
- Isının birimi kalori veya joule, sıcaklığın birimi ise genellikle santigrat derece (°C) dir.
- Bir maddeye ısı verildiğinde o maddenin sıcaklığı genellikle yükselir.`,
    },
    {
      heading: 'Isı ile Sıcaklık Arasındaki Benzerlik ve Farklar',
      matched_outcome_codes: ['b', 'c'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Isı ve sıcaklık kavramları birbiriyle ilişkilidir; ikisi de maddenin ısınma-soğuma durumuyla ilgilidir.
- Her ikisi de sıcak ve soğuk maddeler arasındaki etkileşimi açıklamada kullanılır.
- **Isı bir enerji türüdür**, **sıcaklık ise bir ölçüdür**; bu ikisinin temel farkıdır.
- Isı aktarılabilir ve bir maddeden diğerine geçebilir, sıcaklık ise doğrudan aktarılmaz, sadece ölçülür.
- İki farklı miktardaki aynı sıcaklıktaki su, farklı miktarda ısı içerebilir; bu da ısı ile sıcaklığın aynı kavram olmadığını gösterir.`,
    },
    {
      heading: 'Sıvılar Arasında Isı Alışverişi',
      matched_outcome_codes: ['ç'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Farklı sıcaklıktaki iki sıvı bir araya getirildiğinde aralarında **ısı alışverişi** olur.
- Isı, her zaman sıcak olan sıvıdan soğuk olan sıvıya doğru akar.
- Bu alışveriş, iki sıvının sıcaklığı eşitlenene kadar devam eder.
- Sıcak sıvı ısı verdiği için soğur, soğuk sıvı ısı aldığı için ısınır.
- Bu süreç, ısının maddeler arasında nasıl yayıldığını gösteren temel bir örnektir.`,
    },
    {
      heading: 'Karışım Deneyinde Sıcaklık Ölçümü',
      matched_outcome_codes: ['d', 'e'],
      needs_image: true,
      image_prompt:
        "An educational science experiment illustration for children showing a thermometer measuring a beaker of hot water and another thermometer measuring a beaker of cold water, then an arrow pointing to a third beaker where the two are mixed together with a thermometer showing a middle temperature, flat illustration style, no photorealism, no text.",
      body_markdown: `- Sıcak ve soğuk sıvılar karıştırılmadan önce termometre ile ayrı ayrı sıcaklıkları ölçülüp kaydedilir.
- Sıvılar karıştırıldıktan bir süre sonra karışımın sıcaklığı tekrar ölçülüp kaydedilir.
- Karışımın sıcaklığının, sıcak sıvının ilk sıcaklığından düşük, soğuk sıvının ilk sıcaklığından yüksek çıktığı görülür.
- Bu sonuç, sıcak sıvıdan soğuk sıvıya ısı aktarıldığını değerlendirmek için kullanılır.
- Ölçüm sonuçlarının tabloya kaydedilmesi, ısı alışverişinin karşılaştırmalı olarak incelenmesini sağlar.`,
    },
  ],
  cover: {
    subtitle: 'Isı ile sıcaklık kavramlarını ayırt ediyor, sıvılar karıştığında ısının nasıl aktarıldığını inceliyoruz.',
    image_prompt:
      "A clear educational flat illustration for children showing a thermometer next to two beakers of water, one steaming hot and one with ice cubes, with a small arrow showing heat flowing from hot to cold when mixed, no photorealism, with Turkish labels reading 'Sıcak' and 'Soğuk'.",
    highlights: [
      { position: 'top-left', icon: '🔥', title: 'Isı', description: 'Aktarılan bir enerji türü' },
      { position: 'top-right', icon: '🌡️', title: 'Sıcaklık', description: 'Termometreyle ölçülen değer' },
      { position: 'mid-left', icon: '🔄', title: 'Isı Alışverişi', description: 'Sıcaktan soğuğa akar' },
      { position: 'mid-right', icon: '⚖️', title: 'Sıcaklık Dengesi', description: 'Karışımda sıcaklıklar eşitlenir' },
    ],
  },
};
