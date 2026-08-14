module.exports = {
  topicId: 436,
  title: 'İnternette Bilgi Kaynakları ve Arama Yöntemleri',
  sections: [
    {
      heading: 'İnternet Bilgi Kaynağı Türleri',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a computer screen split into six small icons arranged in a grid: a magnifying glass over a search bar, a government building icon, an open book icon, a stack of library books icon, a newspaper icon, and a speech bubble icon for social media, bright friendly colors, with Turkish text labels reading 'Arama Motoru', 'Resmi Site', 'Ansiklopedi', 'Kütüphane', 'Haber Sitesi' and 'Sosyal Medya' under each icon, no photorealism.",
      body_markdown: `- **Arama motorları**: Google ve Bing gibi araçlar, girilen anahtar kelimeye uygun milyonlarca web sayfasını sıralar.
- **Resmi kurum siteleri**: bakanlık, üniversite veya belediye gibi kurumların yayınladığı, doğruluk oranı yüksek kaynaklardır.
- **Çevrimiçi ansiklopediler**: Vikipedi gibi siteler, bir konuyu madde madde özetleyen hızlı genel bilgi kaynaklarıdır.
- **Kütüphane veritabanları**: dijitalleştirilmiş kitap, dergi ve tezlere erişim sunan, akademik ödevlerde tercih edilen kaynaklardır.
- **Haber siteleri**: güncel olayları saatlik olarak duyurur, fakat bazı haberler henüz doğrulanmamış olabilir.
- **Forum ve sosyal medya paylaşımları**: kullanıcıların kişisel deneyimlerini anlattığı, uzman denetiminden geçmeyen kaynaklardır.
- **Kaynak seçim ölçütü**: ödev için ansiklopedi veya kütüphane veritabanı, güncel bir olay için haber sitesi tercih edilir.`,
    },
    {
      heading: 'Arama Motoru ve Anahtar Kelime',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a laptop screen with a search bar containing a few keywords and a magnifying glass icon, with a small callout showing quotation marks around a phrase to represent exact search, bright friendly colors, with Turkish text labels reading 'Anahtar Kelime' above the search bar and 'Tırnak İçinde Ara' next to the quotation mark callout, no photorealism.",
      body_markdown: `- **Anahtar kelime**: aranan konuyu en iyi tanımlayan, genellikle 2-4 kelimeden oluşan arama ifadesidir.
- **Genel kelime riski**: "hayvan" gibi tek ve geniş bir kelime aramak, milyonlarca alakasız sonuç getirir.
- **Kelime sayısı artırma**: "Afrika'da yaşayan aslanların beslenmesi" gibi daha ayrıntılı ifadeler, sonuçları hedefe yaklaştırır.
- **Tırnak işareti kullanımı**: bir kelime öbeği tırnak içine alınırsa arama motoru o ifadeyi birebir arar.
- **Sonuç sıralaması**: arama motoru, sayfaları genellikle güncellik, ziyaret sayısı ve konuyla ilgisine göre sıralar.
- **Görsel ve harita araması**: arama motorlarındaki ayrı sekmeler, aynı kelimeyi sadece resim veya konum sonucu olarak da tarayabilir.
- **İlk sonuç yanılgısı**: listenin en üstündeki sonuç her zaman en doğru veya en güvenilir kaynak olmayabilir.`,
    },
    {
      heading: 'Kaynağın Güvenilirlik Ölçütleri',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a webpage on a screen with four highlighted callout boxes pointing to different parts of the page: the author name area, the last-updated date, the website address bar showing a domain extension, and the about section, bright friendly colors, with Turkish text labels reading 'Yazar', 'Güncelleme Tarihi', 'Alan Adı' and 'Hakkımızda' next to each callout box, no photorealism.",
      body_markdown: `- **Yazar/kurum bilgisi**: sayfanın altında veya "Hakkımızda" bölümünde yazarın adı ya da kurumun belirtilmesi güvenilirlik işaretidir.
- **Güncellik tarihi**: "Son güncelleme" veya yayın tarihi görünmeyen bir sayfadaki bilgi eski ve geçersiz olabilir.
- **Alan adı uzantısı**: ".gov.tr" devlet kurumunu, ".edu.tr" üniversiteyi, ".org" ise genellikle bir dernek veya vakfı gösterir.
- **Ticari amaç kontrolü**: sürekli reklam çıkan veya ürün satan siteler, tarafsız bilgi yerine satış hedefleyebilir.
- **Yazım ve imla kalitesi**: yazım hatası bol olan, özensiz hazırlanmış sayfalar güvenilir kabul edilmez.
- **Kaynak gösterme alışkanlığı**: iddialarını başka araştırma veya resmi verilerle destekleyen sayfalar, bilgiyi kanıtlarla sunar.
- **Aşırı iddialı başlıklar**: "mucize", "kesin", "yüzde yüz" gibi abartılı ifadeler taşıyan başlıklar dikkatli okunmalıdır.`,
    },
    {
      heading: 'Kaynakları Karşılaştırma ve Seçme',
      matched_outcome_codes: ['b', 'c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing two separate webpage windows side by side being compared, with a checkmark icon above the more trustworthy looking page and a magnifying glass connecting both windows, bright friendly colors, with Turkish text labels reading 'Kaynak 1' and 'Kaynak 2' above each window, no photorealism.",
      body_markdown: `- **Çapraz doğrulama**: aynı bilgiye en az iki farklı kaynaktan ulaşmak, bilginin doğru olma ihtimalini artırır.
- **Çelişkili bilgi durumu**: iki kaynak farklı sayı veya tarih veriyorsa, resmi kurum sitesi genellikle tercih edilir.
- **Uygunluk değerlendirmesi**: bir kaynağın konuya, sınıf seviyesine ve sorunun amacına uygun olup olmadığı kontrol edilir.
- **Verimlilik ölçütü**: aranan bilgiye en az tıklama ve en kısa sürede ulaştıran kaynak, verimli kaynak sayılır.
- **Kaynak listesi tutma**: kullanılan sitelerin adı ve bağlantısı not edilirse, bilgi daha sonra tekrar kontrol edilebilir.
- **Zaman kaybı riski**: çok sayıda sekme açıp dağınık gezinmek, tek kaliteli kaynaktan bulmaktan daha çok zaman alır.
- **Ödev ve proje seçimi**: bir okul ödevinde forum yorumu yerine kütüphane veritabanı veya resmi kaynak tercih edilmelidir.`,
    },
  ],
  cover: {
    subtitle:
      'İnternette güvenilir bilgiye ulaşmak için doğru arama yöntemlerini ve kaynak seçimini keşfediyoruz.',
    image_prompt:
      "A bright, friendly flat educational illustration for children showing a child sitting at a computer with a search engine screen displaying a magnifying glass icon over a search bar, surrounded by small icons representing different information sources: an open book, a library building icon, and a checkmark shield icon representing trust, simple classroom-style illustration, with Turkish text labels reading 'Ara' in the search bar and 'Güvenilir Kaynak' near the shield icon, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🔍', title: 'Anahtar Kelime', description: '2-4 kelimelik net arama ifadesi' },
      { position: 'top-right', icon: '🏛️', title: 'Resmi Siteler', description: '.gov.tr ve .edu.tr uzantılı kaynaklar' },
      { position: 'mid-left', icon: '📅', title: 'Güncellik Tarihi', description: 'Güncelleme tarihi olmayan bilgi şüphelidir' },
      { position: 'mid-right', icon: '👤', title: 'Yazar/Kurum Bilgisi', description: 'Kaynağın kim tarafından hazırlandığını gösterir' },
      { position: 'bottom-left', icon: '⚖️', title: 'Çapraz Doğrulama', description: 'En az iki kaynaktan bilgi karşılaştırılır' },
      { position: 'bottom-right', icon: '⏱️', title: 'Verimli Kaynak', description: 'En kısa sürede doğru bilgiye ulaştıran kaynak' },
    ],
  },
};
