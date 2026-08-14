module.exports = {
  topicId: 375,
  title: 'Tam Gölgenin Oluşumu',
  sections: [
    {
      heading: 'Tam Gölge Nedir?',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "An educational flat illustration for children showing a point light source, an opaque ball, and a screen behind it, with a clearly defined dark shadow shape on the screen, straight light rays blocked by the ball, no photorealism, with a Turkish label reading 'Tam Gölge'.",
      body_markdown: `- **Tam gölge**, ışığın önüne konan saydam olmayan (opak) bir cismin, ışığı tamamen engellemesiyle perde üzerinde oluşan koyu ve net bölgedir.
- Tam gölgenin oluşabilmesi için ışık kaynağı, opak cisim ve gölgenin düştüğü bir yüzey (perde) gereklidir.
- Tam gölge, cismin şekline benzer ama ondan büyük veya küçük olabilir.
- Gölgenin kenarları, ışık kaynağı tek ve küçükse (nokta kaynak) net bir sınır çizer.
- Tam gölgenin oluşması, ışığın doğrusal yayılması özelliğinin bir sonucudur.`,
    },
    {
      heading: 'Gölge Deneyinde Veri Toplama',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Tam gölge deneyinde bir ışık kaynağı, opak bir cisim (ör. karton kesme) ve bir perde kullanılır.
- Cismin ışık kaynağına ve perdeye olan uzaklığı değiştirilerek gölgenin boyutu gözlemlenir.
- Her deneme sonucunda gölgenin uzunluğu ve şekli ölçülüp not edilir.
- Elde edilen ölçümler bir tabloya kaydedilerek karşılaştırma yapılabilir hâle getirilir.
- Bu kayıtlar, gölgenin büyüklüğünü hangi etkenlerin değiştirdiğini ortaya çıkarmak için kullanılır.`,
    },
    {
      heading: 'Gölgenin Boyutunu Etkileyen Değişkenler',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "An educational diagram illustration for children showing the same opaque ball placed at three different distances from a light source, with the resulting shadow on a screen getting larger as the ball moves closer to the light, flat illustration style, no photorealism, no text.",
      body_markdown: `- Cismin **ışık kaynağına yakınlığı** arttıkça gölgenin boyutu büyür.
- Cismin **perdeye yakınlığı** arttıkça gölgenin boyutu küçülür ve kenarları netleşir.
- Cismin **kendi büyüklüğü** de gölgenin boyutunu doğrudan etkiler; büyük cisim daha büyük gölge oluşturur.
- Işık kaynağının büyüklüğü değiştiğinde gölgenin netliği de değişebilir.
- Bu değişkenlerden yalnızca biri değiştirilip diğerleri sabit tutularak gölge üzerindeki etkisi ayrı ayrı incelenebilir.`,
    },
  ],
  cover: {
    subtitle: 'Tam gölgenin nasıl oluştuğunu ve gölgenin boyutunu hangi etkenlerin değiştirdiğini gözlemliyoruz.',
    image_prompt:
      "A clear educational flat illustration for children showing a flashlight, an opaque toy figure, and a wall, with a large dark shadow of the figure cast on the wall, straight light rays visible being blocked, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '🌑', title: 'Tam Gölge', description: 'Opak cismin ışığı engellemesiyle oluşur' },
      { position: 'top-right', icon: '📏', title: 'Kaynağa Yakınlık', description: 'Gölgeyi büyütür' },
      { position: 'mid-left', icon: '🖼️', title: 'Perdeye Yakınlık', description: 'Gölgeyi küçültür' },
      { position: 'mid-right', icon: '📐', title: 'Cismin Büyüklüğü', description: 'Gölgenin boyutunu etkiler' },
    ],
  },
};
