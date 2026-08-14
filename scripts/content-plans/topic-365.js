module.exports = {
  topicId: 365,
  title: 'Gökyüzündeki Komşumuz: Güneş',
  sections: [
    {
      heading: "Güneş'in Yapısı",
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple, educational cross-section illustration of the Sun for children, showing a glowing yellow-orange sphere made of gas with a slightly brighter core area at the center, flat illustration style, no photorealism, with a small Turkish label reading 'Güneş' near the sphere, no other text.",
      body_markdown: `- Güneş, kendi ışığını üreten sıcak bir gaz küresidir; katı bir yüzeyi yoktur.
- Büyük oranda **hidrojen** ve **helyum** gazından oluşur.
- Güneş Sistemi'ndeki en büyük ve en kütleli gök cismidir.
- Çekirdeğe yaklaştıkça sıcaklık ve basınç artar; en yüksek sıcaklık **çekirdek** bölgesindedir.
- Dünya'ya en yakın yıldız olduğu için gökyüzünde en parlak ve en büyük görünen gök cismidir.`,
    },
    {
      heading: 'Güneş Lekeleri',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Güneş lekesi**, Güneş yüzeyinde çevresine göre daha koyu görünen, sıcaklığı düşük bölgelerdir.
- Lekeler, özel filtreli teleskoplarla güvenli biçimde gözlemlenebilir; Güneş'e çıplak gözle asla bakılmaz.
- Aynı lekenin zaman içinde Güneş yüzeyinde yer değiştirdiği gözlemlenir.
- Bu yer değiştirme, Güneş'in **dönme hareketi** yaptığının bir kanıtıdır.
- Bilim insanları, lekelerin konumunu düzenli aralıklarla kaydederek Güneş'in hareketi hakkında veri toplar.`,
    },
    {
      heading: "Güneş'in Dönme Hareketi",
      matched_outcome_codes: ['c'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Güneş, gaz halinde olduğu için tüm yüzeyi aynı hızda dönmez.
- **Ekvator bölgesi** yaklaşık 25 günde, kutuplara yakın bölgeler yaklaşık 35 günde bir tam dönüş tamamlar.
- Bu farklı dönme hızına **diferansiyel dönme** denir.
- Güneş'in kendi ekseni etrafındaki dönme hareketi, katı gezegenlerin dönme hareketinden farklıdır.
- Dönme hareketi, güneş lekelerinin konumundaki değişim izlenerek doğrulanabilir.`,
    },
    {
      heading: "Güneş'in Isı ve Işık Kaynağı Olması",
      matched_outcome_codes: ['ç'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Güneş, Dünya'daki canlılar için temel **ısı** ve **ışık** kaynağıdır.
- Bitkilerin fotosentez yapabilmesi Güneş ışığına bağlıdır.
- Güneş'ten Dünya'ya ulaşan enerji, hava olaylarını ve mevsimlerin oluşmasını etkiler.
- Güneş hakkında araçlarla toplanan veriler (leke konumu, sıcaklık, katman bilgisi) düzenli olarak kaydedilerek yapısı ve hareketleri hakkındaki bilgiler doğrulanır.
- Bu kayıtlar, Güneş'in yapısı ve dönme hareketiyle ilgili bilgilerin güvenilir kaynaklara dayandırılmasını sağlar.`,
    },
  ],
  cover: {
    subtitle: 'Güneş’in gaz yapısını, katmanlarını ve kendi ekseni etrafındaki dönme hareketini keşfediyoruz.',
    image_prompt:
      "A bright, educational flat illustration for children showing a glowing yellow-orange Sun with visible darker spots on its surface and small curved arrows around it indicating rotation, simple space background with a few stars, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '☀️', title: 'Gaz Küre', description: 'Hidrojen ve helyumdan oluşur' },
      { position: 'top-right', icon: '🌡️', title: 'Çekirdek', description: 'En sıcak bölge merkezde' },
      { position: 'mid-left', icon: '🔭', title: 'Güneş Lekesi', description: 'Koyu, soğuk yüzey bölgesi' },
      { position: 'mid-right', icon: '🔄', title: 'Diferansiyel Dönme', description: 'Ekvator ve kutup farklı hızda döner' },
      { position: 'bottom-left', icon: '⏱️', title: 'Dönme Süresi', description: 'Yaklaşık 25-35 gün' },
    ],
  },
};
