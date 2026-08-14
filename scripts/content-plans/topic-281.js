module.exports = {
  topicId: 281,
  title: 'Yönetimin Karar Alma Sürecini Etkileyen Unsurlar',
  sections: [
    {
      heading: 'Bir Kararı Şekillendiren Etkenler',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        'A simple, friendly flat illustration for children showing a town mayor looking at a decision-making board with icons: a scale (law), a coin stack (budget), and a person with a clipboard (expert advice), all connected to a small park design sketch. Educational infographic illustration style, bright colors, no text.',
      body_markdown: `- Bir yönetici karar alırken tek bir etkene değil, birçok farklı unsura bakar.
- **Yasalar**, hangi kararların alınabileceğinin sınırlarını çizer.
- **Bütçe ve ekonomik koşullar**, bir kararın ne ölçüde uygulanabilir olduğunu belirler.
- **Uzman görüşleri ve bilimsel veriler**, kararın doğru ve gerçekçi olmasına katkı sağlar.
- Örneğin bir belediyenin yeni bir park yapma kararı; bütçesine, arazi durumuna ve uzman raporlarına bağlıdır.`,
    },
    {
      heading: 'Halkın Sesi: Kamuoyu ve Katılım',
      matched_outcome_codes: ['a'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Kamuoyu**, halkın bir konu hakkındaki ortak görüş ve beklentisidir.
- Vatandaşların dilekçe, anket veya toplantılarla ilettiği talepler, yöneticilerin karar sürecini doğrudan etkiler.
- **Sivil toplum kuruluşları**, belirli konularda uzman görüşü ve toplumsal talep arasında köprü kurar.
- Medya, toplumdaki ihtiyaç ve şikâyetleri kamuoyuna ve yetkililere duyurma görevi üstlenir.
- Kamuoyunun sesini duyurabilmesi, bir yönetimin demokratik olup olmadığının önemli bir göstergesidir.`,
    },
    {
      heading: 'Bu Etkenlerin Birlikte İşlemesi',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Yasalar, bütçe, uzman görüşü ve kamuoyu talepleri birbirinden bağımsız değildir; birlikte kararı şekillendirir.
- Güçlü bir kamuoyu talebi, zamanla yasal düzenlemelerin bile değişmesine yol açabilir.
- Bütçe yetersizse, toplumun istekleri her zaman aynı hızda karşılanamaz.
- Uzman önerileri ile halkın beklentileri bazen çelişebilir; iyi bir yönetim bu dengeyi gözetir.
- Bu unsurların bir arada değerlendirilmesi, daha adil ve sürdürülebilir kararlar alınmasını sağlar.`,
    },
  ],
  cover: {
    subtitle: 'Bir belediyenin park yapma kararı üzerinden, yönetimlerin karar alırken hangi etkenleri dikkate aldığını anlatıyor.',
    image_prompt:
      'A friendly, colorful flat illustration for children showing a town hall meeting scene with a leader listening to diverse citizens speaking, with small icons of law, budget, and public opinion floating around, symbolizing decision-making. Educational illustration style, no photorealism, no text.',
    highlights: [
      { position: 'top-left', icon: '⚖️', title: 'Yasalar', description: 'Kararların sınırlarını çizer' },
      { position: 'top-right', icon: '💰', title: 'Bütçe', description: 'Uygulanabilirliği belirler' },
      { position: 'mid-left', icon: '🗣️', title: 'Kamuoyu', description: 'Halkın görüş ve talepleri' },
      { position: 'mid-right', icon: '🧑‍🔬', title: 'Uzman Görüşü', description: 'Bilimsel veri ve raporlar' },
    ],
  },
};
