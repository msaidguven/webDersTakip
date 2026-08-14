module.exports = {
  topicId: 274,
  title: 'Ülkemizin, Kıtaların ve Okyanusların Konum Özellikleri',
  sections: [
    {
      heading: 'Mutlak Konumu Nasıl Buluruz?',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A clear, simple educational illustration for children showing a globe grid with highlighted latitude and longitude lines and a small marker pin on Turkey's location, flat map-illustration style, colorful, with Turkish text labels reading 'Enlem' and 'Boylam'.",
      body_markdown: `- Dünya üzerindeki her nokta, **enlem** ve **boylam** adı verilen hayali çizgilerle kesin olarak tarif edilebilir.
- **Enlem çizgileri**, Ekvator'a paralel uzanır ve bir yerin kuzey-güney konumunu gösterir.
- **Boylam çizgileri**, başlangıç meridyenine göre bir yerin doğu-batı konumunu gösterir.
- Türkiye, kabaca 36. ve 42. kuzey enlemleri ile 26. ve 45. doğu boylamları arasında yer alır.
- Bu koordinatlara **mutlak konum** denir ve zamanla değişmez; her ülke için tektir.`,
    },
    {
      heading: 'Komşularımıza ve Denizlere Göre Konumumuz',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple, colorful flat-style map illustration for children showing Turkey surrounded by its neighboring countries and three seas, each sea labeled in Turkish ('Karadeniz', 'Akdeniz', 'Ege Denizi'), educational map illustration style, no other text.",
      body_markdown: `- **Göreceli konum**, bir yerin başka yerlere göre nasıl tarif edildiğini anlatır.
- Türkiye'yi kuzeyden **Karadeniz**, güneyden **Akdeniz**, batıdan **Ege Denizi** çevreler.
- Yunanistan, Bulgaristan, Gürcistan, Ermenistan, İran, Irak ve Suriye, Türkiye'nin kara komşularıdır.
- Türkiye, Asya ile Avrupa kıtaları arasında doğal bir geçiş noktasında bulunur.
- Bu konum, ülkemizin tarih boyunca ticaret ve ulaşım açısından önemli bir merkez olmasını sağlamıştır.`,
    },
    {
      heading: 'Dünyadaki Kıtalar ve Okyanuslar',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A colorful, simple flat-style world map illustration for children showing the seven continents in distinct pastel colors and the five oceans labeled, with a small star marking Turkey's location at the meeting point of Asia and Europe. Educational cartoon map style, Turkish text labels for continents and oceans.",
      body_markdown: `- Dünya kara parçaları 7 kıtaya ayrılır: **Asya**, **Avrupa**, **Afrika**, **Kuzey Amerika**, **Güney Amerika**, **Avustralya** ve **Antarktika**.
- En büyük kıta Asya, en küçük kıta ise Avustralya'dır.
- Dünya sularının büyük bölümünü 5 okyanus oluşturur: **Büyük Okyanus**, **Atlas Okyanusu**, **Hint Okyanusu**, **Güney Okyanusu** ve **Kuzey Buz Okyanusu**.
- Türkiye topraklarının büyük bölümü Asya'da, küçük bir kısmı (Trakya) ise Avrupa'dadır.
- Kıta ve okyanusların birbirine göre konumu, dünya haritasının temel iskeletini oluşturur.`,
    },
  ],
  cover: {
    subtitle: "Enlem-boylamdan komşu ülkelere, Türkiye'nin dünya üzerindeki konumunu ve kıtalarla okyanusları haritalarla tanıtıyor.",
    image_prompt:
      "A bright, colorful flat-style illustration for children showing a simplified world map with Turkey marked by a small star at the junction of Asia and Europe, surrounded by small icons of a compass and ocean waves. Educational illustration style, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '📍', title: 'Mutlak Konum', description: '36-42 enlem, 26-45 boylam' },
      { position: 'top-right', icon: '🧭', title: 'Göreceli Konum', description: 'Komşulara ve denizlere göre' },
      { position: 'mid-left', icon: '🌍', title: '7 Kıta', description: 'Asya en büyük, Avustralya en küçük' },
      { position: 'mid-right', icon: '🌊', title: '5 Okyanus', description: 'Dünyanın büyük su kütleleri' },
      { position: 'bottom-left', icon: '🌉', title: 'Asya-Avrupa Köprüsü', description: 'Türkiye iki kıta arasında' },
    ],
  },
};
