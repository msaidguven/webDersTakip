module.exports = {
  topicId: 431,
  title: 'Kelime İşlemci Dosyası Geliştirme',
  sections: [
    {
      heading: 'Belge Oluşturma ve Kaydetme',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a computer screen with an empty word processor page just opened, next to a save dialog box with format icons for .docx and .pdf, friendly bright colors, with Turkish text labels reading 'Farklı Kaydet' on the save dialog and 'Belgem.docx' as the file name, no photorealism.",
      body_markdown: `- **Yeni belge**: kelime işlemci programı açıldığında boş bir sayfa oluşturarak yazmaya hazır hâle gelir.
- **Dosya adı**: belge ilk kez kaydedilirken içeriğini tanımlayan, harf ve rakamlardan oluşan bir isim girilir.
- **Ctrl+S kısayolu**: yapılan değişiklikleri saniyeler içinde dosyaya işleyerek kayıp riskini azaltır.
- **.docx uzantısı**: çoğu kelime işlemci programının varsayılan kayıt biçimidir, yazı tipini ve biçimlendirmeyi korur.
- **Farklı Kaydet**: aynı belgeyi .pdf gibi başka bir dosya türünde saklamak için kullanılır.
- **PDF biçimi**: belgeyi, açan kişinin bilgisayarında düzeni bozulmadan görüntülenecek şekilde sabitler.
- **Kayıt klasörü**: belge hangi klasöre kaydedilirse orada aranır, farklı bir klasöre kaydedilen dosya kaybolmuş gibi görünür.
- **Otomatik kaydetme**: bazı programlar belgeyi belirli aralıklarla kendiliğinden kaydederek elektrik kesintisinde veri kaybını azaltır.`,
    },
    {
      heading: 'Metin Girme ve Biçimlendirme',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a word processor toolbar close-up with bold (B), italic (I), underline (U) and text alignment icons highlighted, a line of sample text below showing some words in bold and some in italic, bright friendly colors, with Turkish text labels reading 'Kalın', 'İtalik' and 'Hizalama' under the related icons, no photorealism.",
      body_markdown: `- **Metin girişi**: imleç bulunduğu noktadan başlayarak klavyeden yazılan her karakteri sayfaya ekler.
- **Yazı tipi (font)**: metnin harflerinin şeklini belirler; Calibri, Times New Roman ve Arial en sık kullanılan tiplerdendir.
- **Yazı boyutu**: punto biriyle ölçülür, gövde metni genelde 11-12 punto, başlıklar daha büyük puntoyla yazılır.
- **Kalın, italik, altı çizili**: metnin önemli kısımlarını vurgulamak için kullanılan üç temel biçimlendirme aracıdır.
- **Hizalama**: metni sayfanın soluna, sağına, ortasına veya iki yana yaslayarak düzenler.
- **Başlık stilleri**: "Başlık 1", "Başlık 2" gibi hazır biçimler, bölüm başlıklarını gövde metinden ayırt edilir kılar.
- **Stil tutarlılığı**: aynı belgedeki tüm başlıklara aynı stilin uygulanması, biçim karışıklığını önler.
- **Aşırı biçimlendirme riski**: çok sayıda farklı yazı tipi ve renk bir arada kullanılırsa belge karışık ve okunması zor görünür.`,
    },
    {
      heading: 'Sayfa Düzeni Ayarları',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing two page outlines side by side: one in portrait orientation and one in landscape orientation, with margin lines marked around the edges of the portrait page, bright friendly colors, with Turkish text labels reading 'Dikey', 'Yatay' and 'Kenar Boşluğu' pointing to the relevant parts, no photorealism.",
      body_markdown: `- **Kenar boşlukları**: sayfanın dört tarafında metinle kâğıt kenarı arasında bırakılan boşluktur, genelde 2-2,5 santimetre ayarlanır.
- **Sayfa yönü**: dikey (portre) veya yatay (manzara) olarak seçilir; uzun yazı metinleri genelde dikey yönde hazırlanır.
- **Kâğıt boyutu**: Türkiye'de en yaygın kullanılan ölçü A4'tür (21 x 29,7 santimetre).
- **Üst bilgi (header)**: her sayfanın en üstünde tekrar eden, genelde belge veya kurum adını taşıyan alandır.
- **Alt bilgi (footer)**: sayfanın en altında yer alır, sayfa numarası veya tarih eklemek için kullanılır.
- **Sayfa numaralandırma**: çok sayfalı belgelerde her sayfaya otomatik sıra numarası ekleyen bir araçtır.
- **Satır aralığı**: paragraf içindeki satırlar arasındaki boşluğu belirler; 1,5 satır aralığı okunabilirliği artırır.
- **Sayfa sonu**: yeni bir bölümün her zaman yeni bir sayfada başlamasını zorunlu kılmak için eklenen bir işarettir.`,
    },
    {
      heading: 'Liste ve Tablo Ekleme',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a split page: left side has a bulleted list with three dot-marked lines, right side has a small table with three rows and two columns with a bold header row, bright friendly colors, with Turkish text labels reading 'Madde İmi' above the list and 'Tablo' above the table, no photorealism.",
      body_markdown: `- **Madde imi**: sıralaması önemli olmayan bilgileri simge veya nokta ile alt alta listelemek için kullanılır.
- **Numaralı liste**: adım adım izlenmesi gereken bir sırayı 1, 2, 3 şeklinde numaralandırarak gösterir.
- **Girinti seviyesi**: bir listedeki alt maddeler, ana maddeden ayırmak için Tab tuşuyla içeri kaydırılır.
- **Tablo ekleme**: satır ve sütun sayısı belirlenerek sayfaya, verileri düzenli hücreler hâlinde gösteren bir ızgara yerleştirilir.
- **Hücre**: bir tablodaki satır ve sütunun kesiştiği, tek bir veri veya kelimenin yazıldığı en küçük birimdir.
- **Hücre birleştirme**: yan yana veya alt alta duran birden fazla hücreyi tek bir geniş hücreye dönüştürür.
- **Tablo başlık satırı**: genelde tablonun ilk satırına yazılır ve kalın biçimle sütunların içeriğini belirtir.
- **Liste-tablo seçimi**: sıralı adımlar için liste, karşılaştırmalı sayısal veriler için tablo tercih edilir.`,
    },
    {
      heading: 'Dosya Değerlendirme Ölçütleri',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a checklist clipboard next to a word processor document on a screen, with three checkmark icons beside items representing spelling check, consistent layout and correct format, bright friendly colors, with Turkish text labels reading 'Yazım Denetimi', 'Düzen' and 'Biçim' next to each checkmark, no photorealism.",
      body_markdown: `- **Yazım denetimi**: programın kırmızı dalgalı çizgiyle işaretlediği yazım hatalarını taramak ve düzeltmek için kullanılır.
- **Dil bilgisi kontrolü**: cümle kuruluşunun ve noktalama işaretlerinin doğru kullanılıp kullanılmadığını denetler.
- **Okunabilirlik ölçütü**: yazı boyutunun, satır aralığının ve paragraf uzunluğunun metni rahat okunur kılıp kılmadığını belirler.
- **Düzen tutarlılığı**: tüm başlıkların, madde imlerinin ve hizalamaların belge boyunca aynı kurala göre uygulanıp uygulanmadığını inceler.
- **Biçim uygunluğu**: belgenin hazırlanma amacına (rapor, mektup, afiş metni gibi) uygun bir yapıda olup olmadığını sorgular.
- **Dosya boyutu**: çok sayıda yüksek çözünürlüklü görsel eklenmesi belgeyi büyütür ve paylaşımını zorlaştırır.
- **Kayıt biçimi kontrolü**: belgenin paylaşılacağı ortama uygun (.docx düzenlemeye açık, .pdf sabit) biçimde kaydedilip kaydedilmediği kontrol edilir.
- **Geri bildirime göre düzeltme**: bir öğretmen veya arkadaşın incelediği belgede belirtilen eksiklikler, ölçütlere göre yeniden düzenlenir.`,
    },
  ],
  cover: {
    subtitle:
      'Kelime işlemci programında belge oluşturmayı, biçimlendirmeyi ve hazırlanan dosyayı ölçütlere göre değerlendirmeyi öğreniyoruz.',
    image_prompt:
      "A simple flat educational illustration for children showing a computer screen displaying a word processor document with a heading, a bulleted list and a small table visible on the page, plus a toolbar with bold, italic and alignment icons above the page, bright friendly colors, with Turkish text labels reading 'Belgem.docx' near the top of the document, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '📄', title: 'Yeni Belge', description: '.docx uzantısıyla kaydedilir' },
      { position: 'top-right', icon: '🔤', title: 'Biçimlendirme', description: 'Kalın, italik, hizalama araçları' },
      { position: 'mid-left', icon: '📐', title: 'Sayfa Düzeni', description: 'A4 boyut, 2-2,5 cm kenar boşluğu' },
      { position: 'mid-right', icon: '📊', title: 'Tablo ve Liste', description: 'Satır-sütunlu veri, madde imi' },
      { position: 'bottom-left', icon: '✅', title: 'Yazım Denetimi', description: 'Kırmızı çizgiyle hata gösterir' },
      { position: 'bottom-right', icon: '📤', title: 'Dışa Aktarma', description: '.pdf biçiminde paylaşılır' },
    ],
  },
};
