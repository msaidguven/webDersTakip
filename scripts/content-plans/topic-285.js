module.exports = {
  topicId: 285,
  title: 'Ekonomik Faaliyetler ve Meslekler',
  sections: [
    {
      heading: 'Her Faaliyetin Kendi Meslekleri Vardır',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        'A simple, colorful flat illustration for children showing four small figures representing different professions: a farmer, a factory worker, a shopkeeper, and a nurse, each with a small icon of their sector above them. Educational illustration style, bright colors, no text.',
      body_markdown: `- Her ekonomik faaliyetin, o alanda çalışan kendine özgü meslekleri bulunur.
- **Tarım**: çiftçi, sera işçisi; **sanayi**: makine operatörü, mühendis; **ticaret**: esnaf, satış danışmanı ile ilişkilidir.
- **Hizmet sektörü**: öğretmen, hemşire, şoför gibi doğrudan insanlara hizmet sunan meslekleri kapsar.
- Bir bölgede hangi ekonomik faaliyet yaygınsa, genellikle o alana ait meslekler de orada yoğunlaşır.
- Çevremizi gözlemleyerek, tanıdığımız insanların hangi ekonomik faaliyette çalıştığını ve mesleğini kolayca ilişkilendirebiliriz.`,
    },
    {
      heading: 'Meslekler Zamanla Nasıl Değişiyor?',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Teknolojik gelişmeler, birçok mesleğin ortaya çıkmasına ya da azalmasına neden olmaktadır.
- Örneğin mektup dağıtıcılığı azalırken, internet alışverişiyle birlikte kargo kuryeliği hızla yaygınlaşmıştır.
- **Otomasyon** ve makineleşme, fabrikalardaki bazı tekrarlayan işleri insan yerine makinelerin yapmasını sağlamıştır.
- Bazı geleneksel el zanaatları zamanla azalırken, teknolojiye dayalı yeni meslekler ortaya çıkmaktadır.
- Meslek seçerken, gelecekte hangi becerilere ihtiyaç duyulacağını düşünmek önemli bir avantaj sağlar.`,
    },
    {
      heading: 'Yarının Meslekleri Nasıl Olacak?',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        'A bright, futuristic-but-friendly flat illustration for children showing a young person working with a laptop, a small delivery drone flying nearby, and holographic-style data charts, representing future technology-based jobs. Educational illustration style, no photorealism, no text.',
      body_markdown: `- Teknolojideki hızlı değişim, gelecekte tamamen yeni meslek alanları da ortaya çıkarabilir.
- **Yazılım geliştirici**, **veri analisti** ve **drone operatörü** gibi meslekler, teknolojiyle birlikte giderek önem kazanmaktadır.
- Yenilenebilir enerji, yapay zekâ ve dijital pazarlama gibi alanlarda da yeni meslekler doğabilir.
- Gelecekte başarılı olmak için problem çözme, teknoloji kullanma ve öğrenmeye açık olma becerileri belirleyici olacaktır.
- Ekonomik faaliyetlerdeki değişimi takip etmek, gelecekteki meslek fırsatlarını önceden görebilmeyi sağlar.`,
    },
  ],
  cover: {
    subtitle: 'Çiftçilikten kargo kuryeliğine, ekonomik faaliyetlerin mesleklerle bağlantısını ve geleceğin yeni mesleklerini anlatıyor.',
    image_prompt:
      'A warm, colorful flat illustration for children showing a diverse group of people in different professions (a farmer, a factory worker, a nurse, and a young tech worker with a laptop) standing together, symbolizing the connection between economic activities and jobs, including future professions. Educational illustration style, no photorealism, no text.',
    highlights: [
      { position: 'top-left', icon: '🌾', title: 'Tarım Meslekleri', description: 'Çiftçi, sera işçisi' },
      { position: 'top-right', icon: '🏭', title: 'Sanayi Meslekleri', description: 'Makine operatörü, mühendis' },
      { position: 'mid-left', icon: '📦', title: 'Değişen Meslekler', description: 'Mektupçu azaldı, kuryecilik arttı' },
      { position: 'mid-right', icon: '💻', title: 'Geleceğin Meslekleri', description: 'Yazılımcı, veri analisti' },
    ],
  },
};
