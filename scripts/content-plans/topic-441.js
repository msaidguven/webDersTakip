module.exports = {
  topicId: 441,
  title: 'Problem Belirleme ve Algoritma Oluşturma',
  sections: [
    {
      heading: 'Problem Belirleme Süreci',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children split into two panels: left panel shows a wilted, drooping potted plant with a sad small icon, right panel shows the same plant healthy and blooming with a happy small icon, bright friendly colors, with Turkish text labels reading 'Mevcut Durum' under the left panel and 'İstenen Durum' under the right panel, no photorealism.",
      body_markdown: `- **Problem tanımı**: mevcut durum ile ulaşılmak istenen durum arasındaki farktır.
- **Sınır çizme**: bir problemin nereden başlayıp nerede bittiği net biçimde belirlenmelidir.
- **Somut örnek**: "Sınıftaki saksı çiçekleri her sabah solmuş bulunuyor" cümlesi açık bir problem tanımıdır.
- **Yakınma farkı**: "Hava çok sıcak" cümlesi, üzerinde bir çözüm eylemi kurulamadığı için problem sayılmaz.
- **Problem cümlesi**: kim, ne, nerede sorularına yanıt verecek biçimde tek cümleyle yazılır.
- **Gözlemlenebilirlik**: iyi tanımlanmış bir problem, başka bir kişinin de aynı durumu görüp doğrulayabileceği somut bir gözleme dayanır.
- **Çözülebilirlik ölçütü**: seçilen problem, eldeki bilgi ve araçlarla gerçekten çözülebilir nitelikte olmalıdır.
- **Kayıt altına alma**: belirlenen problem cümlesi, unutulmaması için deftere yazılı olarak not edilir.`,
    },
    {
      heading: 'Girdi ve Çıktı Belirleme',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing an input-output diagram: on the left two number cards showing 5 and 3 with an arrow pointing into a small box, on the right a result card showing 8 coming out with an arrow, bright friendly colors, with Turkish text labels reading 'Girdi' above the left cards and 'Çıktı' above the result card, no photorealism.",
      body_markdown: `- **Girdi tanımı**: problemi çözmek için dışarıdan sağlanan bilgi veya veridir.
- **Çıktı tanımı**: çözüm sürecinin sonunda elde edilen sonuç veya bilgidir.
- **Örnek 1**: "iki sayının toplamını bulma" probleminde girdi iki sayı, çıktı ise toplam sonucudur.
- **Örnek 2**: bir tarifte malzeme miktarları girdi, hazırlanan yemek ise çıktıdır.
- **Çoklu girdi**: bir problemde birden fazla girdi bulunabilir, örneğin bir alışveriş listesinde ürün adı ve fiyat birlikte girdi olarak kullanılır.
- **Eksik girdi sonucu**: girdilerden biri eksik verilirse çıktı hiç üretilemez veya yanlış hesaplanır.
- **Belirleme sırası**: bir problem çözülmeye başlamadan önce hangi bilginin girdi, hangi sonucun çıktı olacağı yazılı olarak listelenir.
- **Görünmez çıktı**: bazı problemlerde çıktı bir sayı değil bir durum değişikliğidir, örneğin açık kapının kapatılması probleminde çıktı "kapı kapalı" durumudur.`,
    },
    {
      heading: 'Algoritma ile İşlem Adımları',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a numbered recipe-style card with three sequential steps for making tea: step 1 a kettle boiling water, step 2 a tea bag placed in a cup, step 3 water poured into the cup, each step in its own small numbered panel connected top to bottom, bright friendly colors, with Turkish text labels reading '1. Suyu Kaynat', '2. Poşeti Koy' and '3. Suyu Dök' under each panel, no photorealism.",
      body_markdown: `- **Algoritma tanımı**: bir problemi çözmek için izlenmesi gereken sıralı işlem adımlarının tümüdür.
- **Başlangıç ve bitiş**: her algoritmanın açık bir başlama noktası ve açık bir bitiş noktası bulunur.
- **Sıra kuralı**: adımlar belirlenen sırayla uygulanır; sıra değiştirilirse sonuç yanlış çıkabilir.
- **Numaralandırma**: her adım 1'den başlayarak ayrı satırda yazılır, örneğin "1. Suyu kaynat, 2. Poşeti bardağa koy."
- **Örnek problem**: "çay demleme" algoritmasında adımlar su ısıtma, poşeti bardağa koyma ve suyu bardağa dökme sırasıyla listelenir.
- **Netlik kuralı**: her adım tek bir işlemi anlatmalı, belirsiz veya birden çok anlama gelen ifade içermemelidir.
- **Doğal dil kullanımı**: adımlar önce günlük konuşma diliyle, kısa ve anlaşılır cümlelerle yazılır.
- **Eksik adım riski**: bir adım atlanırsa problem çözülmeden kalabilir veya beklenmeyen bir sonuç ortaya çıkabilir.`,
    },
    {
      heading: 'Akış Şeması ile Gösterim',
      matched_outcome_codes: ['ç'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a basic flowchart with four connected shapes in a vertical line: an oval at the top, a rectangle below it, a diamond below that, and an oval at the bottom, connected with downward arrows, bright friendly colors, with Turkish text labels reading 'Başla' in the top oval, 'İşlem' in the rectangle, 'Karar' in the diamond, and 'Bitir' in the bottom oval, no photorealism.",
      body_markdown: `- **Akış şeması tanımı**: bir algoritmanın adımlarını, geometrik şekiller ve oklarla gösteren görsel bir çizimdir.
- **Başlama/bitiş sembolü**: oval şekil, akış şemasının en başında ve en sonunda kullanılır.
- **İşlem sembolü**: dikdörtgen şekil, yapılacak bir eylemi veya hesaplamayı belirtir, örneğin "suyu ısıt".
- **Girdi/çıktı sembolü**: paralelkenar şekil, bir bilginin alınacağını veya bir sonucun gösterileceğini belirtir.
- **Karar sembolü**: eşkenar dörtgen (baklava) şekil, akışın iki farklı yöne ayrılabileceği noktayı gösterir.
- **Ok kullanımı**: her şekil, akışın hangi sırayla ilerlediğini göstermek için ok işaretleriyle birbirine bağlanır.
- **Yön kuralı**: bir akış şeması genellikle yukarıdan aşağıya doğru çizilir, adımlar bu sırayla takip edilir.
- **Hata tespiti**: adım eksikliği veya sıra karışıklığı, oklardaki kopukluk ya da yanlış yönlenme şeklinde akış şeması üzerinde görülebilir.`,
    },
  ],
  cover: {
    subtitle:
      'Günlük bir problemi seçip girdi çıktısını belirleyerek çözüm adımlarını akış şemasıyla anlatmayı öğreniyoruz.',
    image_prompt:
      "A bright, friendly flat educational illustration for 5th grade students showing a simple flowchart drawn on a notebook page: an oval start shape, a rectangle process shape, a diamond decision shape, and an oval end shape, connected with arrows, plus a small thought bubble showing a child noticing a wilted plant as the problem, simple classroom-style illustration, with Turkish text labels reading 'Başla', 'İşlem', 'Karar' and 'Bitir' inside the flowchart shapes, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🔍', title: 'Problem Belirleme', description: 'Kim, ne, nerede sorularıyla tanımlanır' },
      { position: 'top-right', icon: '📥', title: 'Girdi ve Çıktı', description: 'Girdi: gerekli bilgi, Çıktı: sonuç' },
      { position: 'mid-left', icon: '📋', title: 'Algoritma Adımları', description: "1'den başlayarak numaralı sırayla" },
      { position: 'mid-right', icon: '🔷', title: 'Akış Şeması', description: 'Oval, dikdörtgen, paralelkenar sembolleri' },
      { position: 'bottom-left', icon: '➡️', title: 'Ok Bağlantıları', description: 'Adımları sırayla birbirine bağlar' },
      { position: 'bottom-right', icon: '✅', title: 'Doğru Sıra', description: 'Sıra değişirse sonuç yanlış çıkar' },
    ],
  },
};
