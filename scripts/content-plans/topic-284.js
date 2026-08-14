module.exports = {
  topicId: 284,
  title: 'Ülkemizin Kaynakları ve Ekonomik Faaliyetler',
  sections: [
    {
      heading: 'Yerin Altından ve Üstünden Gelen Zenginlikler',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        'A simple, colorful flat illustration for children showing a map of Turkey with small icons marking natural resources: a mine symbol, wheat fields, hazelnut bushes near the coast, and olive trees. Educational map illustration style, bright colors, no text.',
      body_markdown: `- **Doğal kaynak**, bir ülkenin doğada bulunan ve ekonomik değer taşıyan varlıklarıdır.
- Türkiye, dünya bor rezervlerinin büyük bölümüne (özellikle Kütahya ve Eskişehir çevresinde) sahiptir.
- Zonguldak taş kömürü havzası ve çeşitli krom-linyit yatakları, ülkemizin önemli maden kaynaklarındandır.
- Ege'de zeytin ve pamuk, Karadeniz'de fındık, İç Anadolu'da tahıl yetiştiriciliğine elverişli topraklar bulunur.
- Akarsular, göller ve denizler; sulama, enerji üretimi ve balıkçılık için önemli birer kaynaktır.`,
    },
    {
      heading: 'Kaynaklardan Doğan Ekonomik Faaliyetler',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        'A simple, colorful flat illustration for children showing a split scene of economic activities: a farmer in a wheat field, a mining and factory site, and a coastal hotel representing tourism. Educational illustration style, bright colors, no photorealism, no text.',
      body_markdown: `- **Ekonomik faaliyet**, insanların ihtiyaçlarını karşılamak için yaptığı üretim ve hizmet işleridir.
- Verimli ovalarda tarım, maden bölgelerinde madencilik ve sanayi, kıyılarda ise turizm ön plana çıkar.
- Bor madeninin işlendiği tesisler, hem iç piyasaya hem ihracata önemli katkı sağlar.
- Antalya ve Muğla gibi kıyı şehirlerinde turizm, bölge ekonomisinin en önemli gelir kaynağıdır.
- Kaynakların bilinçli ve sürdürülebilir kullanılması, ekonomik faaliyetlerin uzun vadede sürmesini sağlar.`,
    },
    {
      heading: 'Kaynak ile Faaliyet Arasındaki Bağ',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Bir bölgedeki doğal kaynaklar, orada yapılan ekonomik faaliyetin türünü doğrudan belirler.
- Maden yatağı bulunan bölgede madencilik ve sanayi; verimli ovalarda ise tarım öne çıkar.
- Ormanlık alanlarda kereste ve orman ürünleri işleyen tesisler kurulur.
- Doğal güzelliklere sahip kıyı bölgelerinde ise turizm önemli bir gelir kaynağı hâline gelir.
- Kaynağın türü değiştiğinde, o bölgedeki başlıca ekonomik faaliyet de zamanla değişebilir.`,
    },
  ],
  cover: {
    subtitle: "Kütahya'nın borundan Antalya'nın turizmine, ülkemizin kaynaklarının ekonomik faaliyetleri nasıl şekillendirdiğini anlatıyor.",
    image_prompt:
      'A warm, colorful flat illustration for children showing a simplified map of Turkey with farms, a mine, and a coastal tourist area connected by arrows, symbolizing how resources shape economic activities. Educational illustration style, no photorealism, no text.',
    highlights: [
      { position: 'top-left', icon: '⛏️', title: 'Bor Madeni', description: 'Kütahya ve Eskişehir çevresinde' },
      { position: 'top-right', icon: '🌾', title: 'Verimli Topraklar', description: 'Tarımın temel kaynağı' },
      { position: 'mid-left', icon: '🌰', title: 'Karadeniz Fındığı', description: 'Bölgeye özgü ürün' },
      { position: 'mid-right', icon: '🏖️', title: 'Kıyı Turizmi', description: 'Antalya, Muğla gibi şehirlerde' },
    ],
  },
};
