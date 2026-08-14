module.exports = {
  topicId: 440,
  title: 'Yapay Zekâda Güvenlik',
  sections: [
    {
      heading: 'Veri Toplama ve Kullanıcı Rızası',
      matched_outcome_codes: ['a', 'c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a smartphone screen displaying a permission request pop-up with icons for camera, microphone and location, a friendly small robot character waiting beside the phone, bright clean colors, with Turkish text labels reading 'Kamera', 'Mikrofon' and 'Konum' next to each icon, no photorealism.",
      body_markdown: `- **Veri toplama**: yapay zekâ modelleri, fotoğraf, ses kaydı, konum ve yazı gibi kullanıcı verileriyle eğitilir.
- **Rıza**: bir uygulamanın kişisel veri toplaması için kullanıcıdan veya velisinden önceden açık onay alınması gerekir.
- **Gizlilik politikası**: uygulamanın hangi verileri, ne amaçla topladığını açıklayan yazılı metindir.
- **KVKK**: Türkiye'de kişisel verilerin korunmasını düzenleyen kanundur, izinsiz veri toplamayı ve paylaşmayı yasaklar.
- **Yaş sınırı**: birçok yapay zekâ uygulaması, 13 yaş altı kullanıcılardan veri toplamak için ebeveyn izni ister.
- **Veri ihlali**: toplanan kişisel veriler güvenli sunucularda saklanmazsa, izinsiz kişilerin eline geçebilir.
- **Örnek risk**: bir yüz tanıma uygulaması, kullanıcının fotoğrafını rızası dışında farklı bir amaçla kullanabilir.
- **Veri paylaşımı**: bazı uygulamalar, topladığı verileri kullanıcı fark etmeden üçüncü şirketlerle paylaşabilir.`,
    },
    {
      heading: 'Algoritmik Önyargı',
      matched_outcome_codes: ['a', 'c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a scale/balance with two different faces on each side, one side glowing green (correctly recognized) and the other side glowing red (incorrectly recognized), representing unfair AI results, bright friendly colors, with a Turkish text label reading 'Önyargı' above the scale, no photorealism.",
      body_markdown: `- **Algoritmik önyargı (bias)**: bir yapay zekâ sisteminin belirli gruplara haksız veya hatalı sonuç üretmesidir.
- **Neden**: sistem, eğitim verisinde yeterince temsil edilmeyen grupları doğru tanıyamaz veya yanlış sınıflandırır.
- **Örnek**: bazı yüz tanıma sistemleri, koyu tenli kullanıcıların yüzünü açık tenli kullanıcılara göre daha sık hatalı tanır.
- **Tespit**: önyargı, farklı gruplardan alınan sonuçlar karşılaştırılarak ve hata oranları ölçülerek fark edilir.
- **Sonuç**: önyargılı bir sistem, işe alım veya kredi başvurusu gibi kararlarda bazı kişileri haksız yere eleyebilir.
- **Düzeltme**: geliştiriciler, eğitim verisini çeşitlendirerek ve test sonuçlarını denetleyerek önyargıyı azaltabilir.
- **Farkındalık**: bir yapay zekâ sonucunun her zaman tarafsız olmadığını bilmek, kararların sorgulanmasını gerektirir.`,
    },
    {
      heading: 'Model Güvenilirliği ve Şeffaflığı',
      matched_outcome_codes: ['a', 'c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a robot head made of a transparent glass panel revealing gears and a percentage confidence meter inside, next to a solid opaque black box robot head labeled as unclear, bright educational style, with Turkish text labels reading 'Şeffaf' and 'Kara Kutu' under each head, no photorealism.",
      body_markdown: `- **Hata payı**: hiçbir yapay zekâ modeli yüzde yüz doğru sonuç üretmez, her modelin bir yanılma oranı vardır.
- **Güven skoru**: bazı yapay zekâ uygulamaları, verdiği cevabın yanında ne kadar emin olduğunu gösteren bir yüzde paylaşır.
- **Şeffaflık**: bir sistemin, sonuca hangi verilerle ve nasıl bir mantıkla ulaştığının kullanıcıya açıklanabilmesidir.
- **Kara kutu problemi**: bazı karmaşık modellerin karar sürecini geliştiriciler bile tam olarak açıklayamaz.
- **Doğrulama**: yapay zekâdan alınan bir bilginin, güvenilir başka bir kaynaktan da kontrol edilmesi hataları azaltır.
- **Halüsinasyon**: bazı yapay zekâ modelleri, gerçek olmayan bir bilgiyi kendinden emin bir dille doğruymuş gibi sunabilir.
- **Güncellik sınırı**: bir modelin eğitim verisi belirli bir tarihte durur, bu tarihten sonraki olayları bilemez.`,
    },
    {
      heading: 'Derin Sahte İçerikler',
      matched_outcome_codes: ['a', 'ç'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a split-screen comparison: left side a real photo of a person's face, right side an AI-generated fake version of the same face with a small warning triangle icon overlay, bright clean colors, with Turkish text labels reading 'Gerçek' and 'Sahte' under each side, no photorealism.",
      body_markdown: `- **Derin sahte (deepfake)**: bir kişinin yüzünü, sesini veya hareketlerini başka bir görüntü ya da ses üzerine gerçekçi biçimde yerleştiren yapay içeriktir.
- **Üretim yöntemi**: sistem, gerçek kişiye ait çok sayıda fotoğraf veya ses kaydını inceleyerek o kişiye benzer yeni içerik oluşturur.
- **Risk**: bir kişi, hiç söylemediği bir sözü söylüyormuş gibi gösteren sahte bir video ile itibar kaybına uğrayabilir.
- **Yayılma hızı**: sahte bir video veya ses kaydı, sosyal medyada gerçek içerikten çok daha hızlı paylaşılabilir.
- **Tespit ipucu**: göz kırpma sıklığının bozuk olması ve dudak hareketinin sesle tam uyuşmaması sahte içeriği ele verebilir.
- **Doğrulama aracı**: bazı web siteleri ve uygulamalar, bir görüntünün yapay zekâ ile üretilip üretilmediğini analiz edebilir.
- **Yasal boyut**: bir kişinin izni olmadan görüntüsünün deepfake ile kullanılması, birçok ülkede suç sayılır.`,
    },
    {
      heading: 'Yapay Zekâda Güvenlik Önlemleri',
      matched_outcome_codes: ['b', 'ç'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a smartphone with a shield icon on the screen and a checklist beside it with checkmarks, representing safety steps for an AI app, bright friendly colors, with Turkish text labels reading 'İzinler', 'Kaynak' and 'Güncelleme' next to each checklist item, no photorealism.",
      body_markdown: `- **İzin kontrolü**: bir yapay zekâ uygulaması kurulmadan önce, kamera, mikrofon veya konum gibi hangi verilere erişim istediği kontrol edilmelidir.
- **Veri paylaşım ayarı**: çoğu uygulamada, toplanan verilerin üçüncü kişilerle paylaşılmasını kapatan bir gizlilik ayarı bulunur.
- **Kaynak doğrulama**: bir yapay zekâ uygulamasının hangi şirket tarafından geliştirildiği ve gizlilik politikasının olup olmadığı incelenmelidir.
- **Çıktı kontrolü**: yapay zekânın ürettiği bilgi veya görsel, paylaşılmadan önce doğruluğu ve etik uygunluğu açısından değerlendirilmelidir.
- **Etik ilke**: bir yapay zekâ uygulaması; adalet, şeffaflık, hesap verebilirlik ve zarar vermeme ilkelerine uygun tasarlanmalıdır.
- **Şikâyet mekanizması**: güvenilir uygulamalarda, haksız veya hatalı bir sonucu bildirmek için bir geri bildirim veya itiraz seçeneği bulunur.
- **Güncelleme takibi**: geliştiriciler, tespit edilen güvenlik açıklarını kapatmak için uygulamayı düzenli olarak günceller.`,
    },
  ],
  cover: {
    subtitle:
      'Yapay zekânın verilerini nasıl topladığını, önyargı ve sahte içerik risklerini, alınacak güvenlik önlemlerini öğreniyoruz.',
    image_prompt:
      "A bright, friendly flat educational illustration for children showing a small cartoon robot standing next to a large shield icon, surrounded by smaller floating icons: a lock, a face with a magnifying glass, and a video screen with a warning triangle, simple classroom-style illustration, with a Turkish text label reading 'Güvenlik' on the shield, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🔒', title: 'Veri ve Rıza', description: 'Fotoğraf, ses, konum toplanmadan önce izin gerekir' },
      { position: 'top-right', icon: '⚖️', title: 'Algoritmik Önyargı', description: 'Bazı gruplara haksız veya hatalı sonuç üretebilir' },
      { position: 'mid-left', icon: '🔍', title: 'Şeffaflık', description: 'Modelin nasıl karar verdiği açıklanabilmeli' },
      { position: 'mid-right', icon: '🎭', title: 'Derin Sahte İçerik', description: 'Yüz ve sesi taklit eden sahte video/ses' },
      { position: 'bottom-left', icon: '🛡️', title: 'Güvenlik Önlemi', description: 'Uygulama izinleri ve kaynağı denetlenmeli' },
      { position: 'bottom-right', icon: '🤖', title: 'Etik İlkeler', description: 'Adalet, şeffaflık, hesap verebilirlik, zarar vermeme' },
    ],
  },
};
