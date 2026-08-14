module.exports = {
  topicId: 428,
  title: 'Görsel Tasarıma Yönelik Kurgu Oluşturma',
  sections: [
    {
      heading: 'Gerçek Hayat Problemini Belirleme',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a school canteen area with litter scattered on the ground near a trash bin, two children looking at the mess with thoughtful expressions, bright cheerful colors, no photorealism, no text.",
      body_markdown: `- **Gerçek hayat problemi**, görsel tasarım sürecinin başlangıç noktasıdır ve tasarımdan önce belirlenir.
- Problem, "kağıt israfı" veya "geri dönüşüm" gibi somut ve sınırlı olmalı; "çevre kirliliği" gibi çok geniş bir başlık seçilmemelidir.
- Problem belirlenirken **hedef kitle** de netleştirilir: görsel kime ulaşacak, sınıf arkadaşları, okul, mahalle sakinleri.
- Gözlem, anket veya öğretmen/veli geri bildirimi, gerçek bir problemi tespit etmenin yollarındandır.
- Örnek: kantin önünde çöplerin yere atıldığı gözlemlenirse, geri dönüşüm bilincini artıracak bir afiş problemi ortaya çıkar.
- Problem net tanımlanmazsa görsel amacından uzaklaşır ve dağınık bir mesaj taşır.
- Problem genellikle kısa bir cümleyle ifade edilir: "Okul bahçesinde çöpler ayrıştırılmıyor, bu nedenle afiş tasarlanacaktır."`,
    },
    {
      heading: 'Hikâye ve Senaryo Unsurları',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A flat educational illustration for children showing four labeled icon cards arranged in a row: a character icon (a smiling child), a location icon (a small school building), a plot icon (a storybook with an arrow), and a message icon (a speech bubble with a heart), simple colorful icons with Turkish text labels reading 'Karakter', 'Mekân', 'Olay', 'Mesaj', no photorealism.",
      body_markdown: `- Hikâye/senaryo unsurları dört temel öğeden oluşur: karakter, mekân, olay örgüsü, mesaj.
- **Karakter**, hikâyeyi taşıyan kişi, hayvan veya nesnedir; örneğin bir öğrenci ya da geri dönüşüm kutusu karakter olabilir.
- **Mekân**, olayın geçtiği yerdir; hedef kitlenin tanıdığı bir ortam (okul bahçesi, sınıf, mutfak gibi) seçilir.
- **Olay örgüsü**, başlangıç-gelişme-sonuç sırasıyla ilerler: problem ortaya çıkar, fark edilir, sonunda çözülür.
- **Mesaj**, görselin izleyiciye iletmek istediği ana fikirdir ve tek bir cümleyle özetlenecek kadar net olmalıdır.
- Hikâyenin geçtiği zaman kısa tutulur, genellikle tek bir gün ya da tek bir olay anıyla sınırlandırılır.
- Unsurlar seçilirken belirlenen probleme ve hedef kitlenin yaşına uygunluk gözetilir.`,
    },
    {
      heading: 'Senaryo Oluşturma',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A flat educational illustration for children showing a simple three-panel storyboard strip, each panel a small rectangular frame with a simple drawn scene inside showing a story progressing left to right, numbered '1', '2', '3' above each panel, notebook paper background, no photorealism, no additional text.",
      body_markdown: `- **Senaryo oluşturma**, belirlenen karakter, mekân, olay ve mesajın sahne sahne bir araya getirilmesidir.
- İlk sahnede karakter ve mekân tanıtılır, örneğin "Ali, kantin önünde duruyor" gibi kısa bir cümleyle.
- İkinci sahnede problem ortaya çıkar: "Ali elindeki çöpü yere atar, arkadaşı Ayşe bunu görür."
- Üçüncü sahnede çözüm uygulanır: "Ayşe geri dönüşüm kutusunu gösterir, Ali çöpü doğru kutuya atar."
- Sahneler, kısa ve görsele dönüştürülebilecek somut cümlelerle yazılır, uzun anlatımlardan kaçınılır.
- Bir senaryo taslağında genellikle üç ile beş arasında sahne bulunur, her sahne ayrı bir satıra numaralandırılarak yazılır.
- Sahneler arasındaki geçiş mantıklı olmalı, her sahne kendinden önceki sahnenin doğal devamı olmalıdır.`,
    },
    {
      heading: 'Senaryoyu Değerlendirme',
      matched_outcome_codes: ['ç'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Oluşturulan senaryo, görsele dönüştürülmeden önce **bütünlük** ve **kullanışlılık** ölçütlerine göre kontrol edilir.
- **Bütünlük** ölçütünde sahneler arasında mantıksal bir bağ olup olmadığı, başlangıç-gelişme-sonuç sıralamasının eksiksiz olup olmadığı incelenir.
- **Kullanışlılık** ölçütünde senaryonun, ilk belirlenen gerçek hayat problemine gerçekten çözüm sunup sunmadığı değerlendirilir.
- Kontrol sırasında mesajın net olup olmadığı, karakter ve mekânın tutarlı kullanılıp kullanılmadığı incelenir.
- Konuyla ilgisi olmayan veya tekrar eden bir sahne fark edilirse senaryodan çıkarılır.
- Sonucun belirsiz kaldığı gibi eksik bir unsur fark edilirse ilgili sahneye ekleme yapılır.
- Değerlendirme genellikle sınıf arkadaşlarının veya öğretmenin geri bildirimiyle desteklenir.
- Onaylanan senaryo, bir sonraki aşamada görselin tasarımına temel oluşturan son hâlini alır.`,
    },
  ],
  cover: {
    subtitle: 'Bir görsel tasarlamadan önce gerçek bir problem bulup hikâyeleştirme sürecini keşfediyoruz.',
    image_prompt:
      "A bright flat educational illustration for children showing a student at a desk sketching a simple storyboard on paper, with small thought-bubble icons above showing a character, a location, and a lightbulb idea floating around, colorful and friendly classroom style, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '🎯', title: 'Problem Belirleme', description: 'Gerçek hayattan somut bir problem' },
      { position: 'top-right', icon: '🧩', title: 'Hikâye Unsurları', description: 'Karakter, mekân, olay, mesaj' },
      { position: 'mid-left', icon: '📝', title: 'Senaryo Oluşturma', description: '3-5 sahnelik kısa akış' },
      { position: 'mid-right', icon: '✅', title: 'Senaryo Değerlendirme', description: 'Bütünlük ve kullanışlılık kontrolü' },
    ],
  },
};
