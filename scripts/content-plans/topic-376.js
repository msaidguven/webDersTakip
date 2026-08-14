module.exports = {
  topicId: 376,
  title: 'Maddenin Tanecikli Yapısı',
  sections: [
    {
      heading: 'Maddenin Tanecikli Yapısı',
      matched_outcome_codes: ['a'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Bütün maddeler, gözle görülemeyecek kadar küçük **tanecik**lerden oluşur.
- Tanecikler arasında, madde türüne göre değişen miktarda **boşluk** bulunur.
- Tanecikler sürekli **hareket** hâlindedir; bu hareket madde türüne göre farklı hızda gerçekleşir.
- Tanecikli, boşluklu ve hareketli yapı, tüm katı, sıvı ve gaz maddeler için geçerlidir.
- Bu üç özellik (tanecik, boşluk, hareket) birlikte değerlendirilerek maddenin hangi hâlde olduğu belirlenir.`,
    },
    {
      heading: 'Katı Maddelerde Tanecik Düzeni',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple educational diagram for children showing particles arranged in a tight, orderly grid pattern representing a solid, small dots close together with almost no gaps, flat illustration style, with a Turkish label reading 'Katı', no photorealism.",
      body_markdown: `- Katı maddelerde tanecikler birbirine çok yakın ve **düzenli** biçimde dizilidir.
- Tanecikler arasındaki boşluk oldukça azdır.
- Katı maddelerdeki tanecikler yer değiştirmez; sadece bulundukları noktada titreşim hareketi yapar.
- Bu sıkı ve düzenli yapı, katı maddelerin belirli bir şekle ve hacme sahip olmasını sağlar.
- Katı maddeler bu özellikleri sayesinde diğer hâllerden ayrıştırılabilir.`,
    },
    {
      heading: 'Sıvı ve Gaz Maddelerde Tanecik Düzeni',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A simple educational diagram for children showing two panels side by side: liquid particles loosely grouped and sliding past each other, and gas particles spread far apart moving freely in all directions, flat illustration style, with Turkish labels reading 'Sıvı' and 'Gaz', no photorealism.",
      body_markdown: `- Sıvı maddelerde tanecikler arasındaki boşluk katıya göre daha fazladır; tanecikler birbirinin üzerinden kayarak hareket eder.
- Bu nedenle sıvılar, bulundukları kabın şeklini alır ama hacimleri değişmez.
- Gaz maddelerde tanecikler arasındaki boşluk çok fazladır; tanecikler her yöne serbestçe ve hızlı hareket eder.
- Gazlar bu serbest hareket sayesinde bulundukları kabın her yerini doldurur.
- Tanecik hareketi katıdan sıvıya, sıvıdan gaza doğru gidildikçe artar.`,
    },
    {
      heading: 'Katı, Sıvı, Gaz Sınıflandırması',
      matched_outcome_codes: ['ç'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Maddeler, tanecikleri arasındaki boşluk ve hareket miktarına göre üç grupta etiketlenir: **katı**, **sıvı**, **gaz**.
- Taş, buz ve tahta gibi maddeler katı grubuna girer.
- Su, süt ve zeytinyağı gibi maddeler sıvı grubuna girer.
- Hava, su buharı ve doğal gaz gibi maddeler gaz grubuna girer.
- Aynı madde, sıcaklığa bağlı olarak farklı hâller arasında geçiş yapabilir (ör. su hem katı hem sıvı hem gaz hâlinde bulunabilir).`,
    },
  ],
  cover: {
    subtitle: 'Maddelerin gözle görünmeyen tanecikli yapısını ve katı, sıvı, gaz hâllerini karşılaştırıyoruz.',
    image_prompt:
      "An educational flat illustration for children showing three glass containers side by side: one with tightly packed particles (solid ice cube), one with loosely flowing particles (liquid water), and one with widely spread particles (gas/steam), simple science diagram style, with Turkish labels reading 'Katı', 'Sıvı', 'Gaz', no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🔵', title: 'Tanecik', description: 'Maddeyi oluşturan küçük yapı' },
      { position: 'top-right', icon: '🧊', title: 'Katı', description: 'Sıkı, düzenli, az boşluklu' },
      { position: 'mid-left', icon: '💧', title: 'Sıvı', description: 'Kayarak hareket eden tanecikler' },
      { position: 'mid-right', icon: '💨', title: 'Gaz', description: 'Serbest, hızlı, çok boşluklu' },
    ],
  },
};
