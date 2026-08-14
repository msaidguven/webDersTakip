module.exports = {
  topicId: 273,
  title: 'Toplumsal Sorunlar ve Çözümler Önerileri',
  sections: [
    {
      heading: 'Çevremizdeki Toplumsal Sorunlar',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        'A simple, colorful flat illustration for children showing a busy city street corner with light traffic, a small pile of litter near a bench, and a stray cat, gently illustrating everyday urban issues in a non-alarming way. Educational illustration style, soft colors, no text.',
      body_markdown: `- Bir sorunun "toplumsal" sayılması için, tek bir kişiyi değil geniş bir kesimi etkilemesi gerekir.
- Şehirlerde sık görülen sorunlar arasında **trafik sıkışıklığı**, **çevre kirliliği**, **gürültü** ve **israf** sayılabilir.
- Okul bahçesindeki çöp birikimi ya da sokaktaki sahipsiz hayvanlara ilgisizlik de küçük ölçekli birer toplumsal sorundur.
- Bu sorunları fark etmek için çevremizi dikkatle gözlemlemek ve insanların şikâyetlerine kulak vermek gerekir.
- Bir sorun ne kadar erken fark edilirse, çözümü de o kadar kolay bulunur.`,
    },
    {
      heading: 'Aynı Soruna Farklı Bakışlar',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- İnsanlar aynı sorunun nedenini, kendi yaşadıkları deneyime göre farklı şekilde açıklayabilir.
- Trafik sıkışıklığını bir sürücü "yetersiz yol" olarak görürken, bir yaya "dar kaldırımlar" olarak görebilir.
- **Bakış açısı**, kişinin bilgi birikimine, mesleğine ve yaşadığı yere göre şekillenir.
- Bir sorunu tek bir açıdan değerlendirmek, çözümün eksik veya yanlış olmasına yol açabilir.
- Farklı görüşleri bir araya getirmek, sorunun bütün yönlerini görmemizi sağlar.`,
    },
    {
      heading: 'Çözüm Önerisi Geliştirme',
      matched_outcome_codes: ['c', 'ç'],
      needs_image: true,
      image_prompt:
        'A friendly, simple flat illustration for children showing several lightbulb-shaped idea icons of different colors above a group of diverse children pointing at a shared drawing on a table, symbolizing generating multiple solution options. Educational illustration style, bright colors, no photorealism, no text.',
      body_markdown: `- Bir çözüm önerisi geliştirilirken önce sorunun asıl nedeni net biçimde belirlenmelidir.
- İyi bir öneri; uygulanabilir olmalı, maliyeti makul olmalı ve etkilenen herkesi gözetmelidir.
- Tek bir çözüm yerine birkaç farklı seçenek üretmek, en uygununu seçmeyi kolaylaştırır.
- Çözüm önerileri hazırlanırken, sorundan etkilenen farklı kişilerin görüş ve önerileri de dikkate alınmalıdır.
- Bu görüşler doğrultusunda öneri yeniden düzenlenip daha kapsayıcı hâle getirilebilir.`,
    },
    {
      heading: 'Çözüm Önerisini Savunma',
      matched_outcome_codes: ['d'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Bir öneriyi savunmak, onu somut gerekçe ve örneklerle açık biçimde anlatabilmektir.
- Karşı görüşleri sabırla dinlemek ve saygılı yanıtlar vermek, savunmayı daha güçlü kılar.
- Eleştiri geldiğinde öneriyi hemen terk etmek yerine, gerekirse geliştirip yeniden sunmak daha doğrudur.
- Amaç, tartışmayı kazanmak değil; toplum için gerçekten işe yarayacak çözümü birlikte bulmaktır.
- İyi savunulan bir öneri, daha çok kişinin desteğini kazanır ve uygulanma ihtimali artar.`,
    },
  ],
  cover: {
    subtitle: 'Çevremizdeki sorunları fark etmeyi, farklı bakış açılarını anlamayı ve etkili çözüm önerileri geliştirmeyi anlatıyor.',
    image_prompt:
      'A warm, colorful flat illustration for children showing a small group of students standing around a community bulletin board covered with sticky notes and drawings, symbolizing brainstorming solutions together. Educational, friendly illustration style, no photorealism, no text.',
    highlights: [
      { position: 'top-left', icon: '🚦', title: 'Trafik Sıkışıklığı', description: 'Şehirlerde sık görülen sorun' },
      { position: 'top-right', icon: '👀', title: 'Farklı Bakış Açıları', description: 'Herkes sorunu farklı görür' },
      { position: 'mid-left', icon: '💡', title: 'Çoklu Çözüm Üret', description: 'Birden fazla seçenek düşün' },
      { position: 'mid-right', icon: '🗳️', title: 'Görüşleri Birleştir', description: 'Herkesi gözeten öneri' },
      { position: 'bottom-left', icon: '🎤', title: 'Fikrini Savun', description: 'Gerekçelerle açıkla' },
    ],
  },
};
