module.exports = {
  topicId: 372,
  title: 'Destek ve Hareket Sistemi',
  sections: [
    {
      heading: 'İskelet Sistemi: Kemikler ve Eklemler',
      matched_outcome_codes: ['a', 'b'],
      needs_image: true,
      image_prompt:
        "An educational flat illustration for children showing a simplified human skeleton with a few bones and joints highlighted (skull, spine, arm, leg, knee joint), classroom biology poster style, with Turkish labels reading 'Kafatası', 'Omurga', 'Eklem', no photorealism.",
      body_markdown: `- **İskelet sistemi**, vücuda destek olan ve iç organları koruyan kemiklerden oluşur.
- **Kemikler**, sert ve dayanıklı yapıdadır; vücudun şeklini korur.
- **Kıkırdak**, kemiklere göre daha esnek bir destek dokusudur (ör. kulak, burun ucu).
- **Eklemler**, iki kemiğin birleştiği ve hareketi sağlayan noktalardır (ör. diz, dirsek, omuz).
- Kemikler sertlik ve destek özelliğine göre, eklemler ise hareket yönüne göre farklı gruplara ayrılabilir.`,
    },
    {
      heading: 'Kas Sistemi ve Kas Türleri',
      matched_outcome_codes: ['c', 'ç'],
      needs_image: true,
      image_prompt:
        "A simple educational illustration for children showing three types of muscle tissue diagrams side by side in a friendly cartoon style: skeletal muscle attached to a bone, smooth muscle in an organ wall, and heart muscle, with Turkish labels reading 'İskelet Kası', 'Düz Kas', 'Kalp Kası', no photorealism.",
      body_markdown: `- **Kaslar**, kasılıp gevşeyerek vücudun hareket etmesini sağlayan yapılardır.
- **İskelet kasları**, kemiklere bağlıdır ve isteğimizle çalışır (ör. kol, bacak kasları).
- **Düz kaslar**, iç organların çeperinde bulunur ve istemsiz çalışır (ör. mide, bağırsak).
- **Kalp kası**, sadece kalpte bulunan, istemsiz ve düzenli çalışan özel bir kas türüdür.
- Bu üç kas türü, çalışma şekline (istemli/istemsiz) ve bulunduğu yere göre gruplandırılıp etiketlenebilir.`,
    },
    {
      heading: 'Destek ve Hareket Sisteminin Sağlığı',
      matched_outcome_codes: ['d', 'e', 'f', 'g'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Destek ve hareket sisteminin sağlığı hakkında bilgi edinmek için kitap, güvenilir internet kaynağı veya uzman görüşü gibi araçlardan yararlanılabilir.
- Bu kaynaklardan; düzenli egzersiz, kalsiyum ve D vitamini alımı, doğru oturma ve duruş alışkanlıklarının kemik ve kas sağlığı için önemli olduğu bilgisine ulaşılır.
- Yetersiz kalsiyum alımı kemiklerin zayıflamasına, hareketsizlik ise kasların güçsüzleşmesine yol açabilir.
- Elde edilen bilgiler farklı kaynaklarla karşılaştırılarak doğruluğu kontrol edilir.
- Doğrulanan bilgiler not alınarak destek ve hareket sistemi sağlığını korumak için uygulanabilecek öneriler kaydedilir.`,
    },
  ],
  cover: {
    subtitle: 'Kemikler, eklemler ve kasların vücudumuza nasıl destek ve hareket sağladığını öğreniyoruz.',
    image_prompt:
      "A friendly educational flat illustration for children showing a simplified human body outline with the skeleton on one side and muscles on the other side, side by side comparison, classroom biology style, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '🦴', title: 'Kemikler', description: 'Vücuda destek ve şekil verir' },
      { position: 'top-right', icon: '🔗', title: 'Eklemler', description: 'Hareketi sağlayan birleşim noktaları' },
      { position: 'mid-left', icon: '💪', title: 'İskelet Kası', description: 'İsteğimizle çalışan kas' },
      { position: 'mid-right', icon: '❤️', title: 'Kalp Kası', description: 'İstemsiz, düzenli çalışır' },
      { position: 'bottom-left', icon: '🥛', title: 'Kalsiyum ve D Vitamini', description: 'Kemik sağlığı için gerekli' },
    ],
  },
};
