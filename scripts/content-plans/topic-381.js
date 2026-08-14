module.exports = {
  topicId: 381,
  title: 'Basit Bir Elektrik Devresinde Ampul Parlaklığını Etkileyen Değişkenler',
  sections: [
    {
      heading: 'Ampul Parlaklığını Etkileyen Değişkenler',
      matched_outcome_codes: ['a'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Bir elektrik devresinde ampulün ne kadar parlak yandığını birden fazla etken belirler.
- Devredeki **pil sayısı**, ampulün parlaklığını etkileyen değişkenlerden biridir.
- Devredeki **ampul sayısı**, aynı devrede paylaşılan enerji miktarını etkileyerek parlaklığı değiştirir.
- Tellerin uzunluğu ve bağlantı şekli de parlaklığa etki edebilir.
- Bu değişkenlerin her biri ayrı ayrı incelenerek ampul parlaklığı üzerindeki etkisi belirlenir.`,
    },
    {
      heading: 'Pil ve Ampul Sayısının Parlaklığa Etkisi',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "An educational circuit comparison illustration for children showing two simple circuits side by side: one with one battery and one dim bulb, another with two batteries and the same bulb glowing brighter, flat illustration style, no photorealism, no text.",
      body_markdown: `- Devredeki **pil sayısı arttıkça**, ampule daha fazla enerji ulaşır ve ampul daha parlak yanar.
- Devredeki **ampul sayısı arttıkça**, aynı pil enerjisi ampuller arasında paylaşılır ve her bir ampul daha sönük yanar.
- Aynı sayıda pille daha çok ampul çalıştırıldığında, her ampulün parlaklığı azalır.
- Bu gözlemler, pil ve ampul sayısı ile parlaklık arasında bir **neden-sonuç ilişkisi** olduğunu ortaya koyar.
- Değişen değişken ile sonuçtaki değişim karşılaştırılarak bu ilişki netleştirilir.`,
    },
    {
      heading: 'Deneyde Bağımlı, Bağımsız ve Kontrol Değişkenleri',
      matched_outcome_codes: ['c', 'ç'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Bu deneyde **bağımsız değişken**, kasıtlı olarak değiştirilen pil sayısı veya ampul sayısıdır.
- **Bağımlı değişken**, bağımsız değişkene bağlı olarak değişen ampul parlaklığıdır.
- **Kontrol edilen değişkenler**, tel uzunluğu ve tel kalınlığı gibi deney boyunca sabit tutulan etkenlerdir.
- Doğru bir karşılaştırma için pil sayısı incelenirken ampul sayısı, ampul sayısı incelenirken pil sayısı sabit tutulur.
- Bağımsız değişken olarak seçilen pil veya ampul sayısı, deney boyunca planlı biçimde kontrol edilerek değiştirilir.`,
    },
    {
      heading: 'Deney Sonuçlarına Dayalı Önermeler',
      matched_outcome_codes: ['d'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Farklı pil ve ampul sayılarıyla kurulan devrelerden elde edilen gözlemler karşılaştırılır.
- Bu karşılaştırmalar sonucunda "pil sayısı arttıkça ampul parlaklığı artar" gibi bir önerme oluşturulabilir.
- Aynı şekilde "ampul sayısı arttıkça her bir ampulün parlaklığı azalır" önermesi de deney verileriyle desteklenir.
- Önermeler, yalnızca bir devre değil, birden fazla farklı devre denenerek genel bir sonuca ulaştırılır.
- Bu önermeler, elektrik devrelerinde pil ve ampul sayısının parlaklığı nasıl etkilediğini özetler.`,
    },
  ],
  cover: {
    subtitle: 'Pil ve ampul sayısını değiştirerek ampul parlaklığının nasıl ve neden değiştiğini deneyle keşfediyoruz.',
    image_prompt:
      "An educational flat illustration for children showing three simple circuits in a row with increasing number of batteries, each bulb glowing brighter than the last, clear comparison layout, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '🔋', title: 'Pil Sayısı', description: 'Artınca ampul parlaklaşır' },
      { position: 'top-right', icon: '💡', title: 'Ampul Sayısı', description: 'Artınca her ampul sönükleşir' },
      { position: 'mid-left', icon: '🎯', title: 'Bağımsız Değişken', description: 'Kasıtlı değiştirilen etken' },
      { position: 'mid-right', icon: '📊', title: 'Bağımlı Değişken', description: 'Sonuçta değişen parlaklık' },
    ],
  },
};
