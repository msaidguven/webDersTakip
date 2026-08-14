module.exports = {
  topicId: 433,
  title: 'Sunum Dosyası Oluşturma',
  sections: [
    {
      heading: 'Yeni Sunum Oluşturma',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a computer screen with presentation software open, displaying a template gallery with several colorful slide theme thumbnails to choose from, and a highlighted 'New Presentation' button, bright friendly colors, with Turkish text labels reading 'Şablon Seç' and 'Yeni Sunum' on the screen, no photorealism.",
      body_markdown: `- **Sunum programı**: PowerPoint, Google Slides veya LibreOffice Impress gibi yazılımlarla sunum dosyası hazırlanır.
- **Boş sunu**: sıfırdan, hiçbir tasarım içermeyen bir sayfayla başlatılan sunum türüdür.
- **Şablon**: rengi, yazı tipi ve düzeni önceden hazırlanmış, hızlı başlangıç sağlayan tasarım dosyasıdır.
- **Başlık slaydı**: genellikle sunumun ilk sayfasıdır ve konu adıyla hazırlayan kişinin adını içerir.
- **Dosya adlandırma**: kaydetmeden önce konuyu yansıtan açık bir isim seçilmesi dosyanın sonradan bulunmasını kolaylaştırır.
- **Yeni slayt ekleme**: "Yeni Slayt" komutuyla sunuma istenen sayıda sayfa eklenir.
- **Slayt sıralama**: sol taraftaki küçük resim (thumbnail) panelinden sürükleyerek slaytların yeri değiştirilir.`,
    },
    {
      heading: 'Slayt Düzeni ve İçerik',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a single presentation slide with clearly outlined placeholder boxes: a title box at the top and a bulleted content box below it, bright friendly colors, with Turkish text labels reading 'Başlık Kutusu' and 'İçerik Kutusu' pointing to each box, no photorealism.",
      body_markdown: `- **Slayt düzeni**: başlık ve içerik için önceden ayrılmış boş kutucuklardan (yer tutuculardan) oluşur.
- **Başlık kutusu**: slaydın üst kısmında bulunur ve o sayfanın ana konusunu kısaca belirtir.
- **İçerik kutusu**: madde işaretli metin, resim veya tablo eklemek için kullanılan alandır.
- **Yazı boyutu**: başlıklarda 28-40 punto, içerik metninde 18-24 punto aralığı okunabilirlik için önerilir.
- **Madde sınırı**: bir slaytta genellikle 5-6 maddeyi geçmemesi izleyicinin takibini kolaylaştırır.
- **Serbest metin kutusu**: hazır düzende yer almayan ek bir alana istenildiğinde ayrıca eklenebilir.
- **Düzen değiştirme**: "Slayt Düzeni" menüsünden başlık, iki içerik veya yalnızca görsel gibi seçenekler seçilir.`,
    },
    {
      heading: 'Görsel ve Tablo Ekleme',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a presentation slide with an inserted photo, a small data table with rows and columns, and a bar chart placed side by side, bright friendly colors, with a Turkish text label reading 'Ekle' on a toolbar above the slide, no photorealism.",
      body_markdown: `- **Resim ekleme**: "Ekle" menüsündeki "Resim" komutuyla bilgisayardan veya çevrimiçi kaynaktan görsel yerleştirilir.
- **Tablo ekleme**: satır ve sütun sayısı belirlenerek sayısal veya yazılı veriler düzenli biçimde sunulur.
- **Grafik ekleme**: sayısal veriler sütun, pasta veya çizgi grafik türlerinden biriyle görselleştirilir.
- **Boyutlandırma**: köşe noktalarından sürüklenerek görselin oranı bozulmadan büyültülüp küçültülür.
- **Hazır şekil**: ok, dikdörtgen veya konuşma balonu gibi nesnelerle slayt üzerinde vurgu yapılır.
- **Telif kontrolü**: internetten indirilen görsellerin kullanım izninin bulunup bulunmadığı denetlenmelidir.
- **Hizalama**: "Hizala" komutu birden fazla nesneyi slayt üzerinde düzgün ve simetrik sıraya sokar.`,
    },
    {
      heading: 'Geçiş ve Animasyon Efektleri',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing two presentation slides side by side connected by a curved arrow representing a transition effect, with small sparkle and motion icons around the arrow, bright friendly colors, with a Turkish text label reading 'Geçiş Efekti' near the arrow, no photorealism.",
      body_markdown: `- **Geçiş efekti**: bir slayttan diğerine geçerken uygulanan hareketli görsel değişimdir, örneğin Soluklaştır veya Kaydır.
- **Animasyon**: slayt içindeki bir metin veya nesnenin görünme, vurgulanma ya da kaybolma hareketidir.
- **Giriş animasyonu**: bir nesnenin slayt açıldığında ekrana nasıl gireceğini belirler, örneğin Uçarak Gir.
- **Süre ayarı**: geçiş veya animasyon hızı saniye cinsinden ayarlanır, örneğin 0,5 veya 1 saniye.
- **Tetikleme türü**: bazı animasyonlar fare tıklamasıyla, bazıları belirlenen sürede otomatik başlar.
- **Aşırı efekt riski**: çok sayıda farklı animasyon kullanımı izleyicinin dikkatini konudan uzaklaştırır.
- **Ses efekti**: geçişlere isteğe bağlı olarak kısa bir uyarı veya alkış sesi eklenebilir.`,
    },
    {
      heading: 'Kaydetme ve Dışa Aktarma',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing three file format icons in a row: a presentation icon, a PDF document icon, and an image icon, each with a small download arrow, bright friendly colors, with Turkish text labels reading 'Sunum', 'Belge' and 'Resim' under each icon, no photorealism.",
      body_markdown: `- **Kaydetme**: "Dosya > Kaydet" komutuyla sunum varsayılan olarak .pptx uzantısıyla saklanır.
- **Farklı kaydet**: dosya adı veya konumu değiştirilerek aynı sunumun yeni bir kopyası oluşturulur.
- **PDF olarak aktarma**: sunum, düzenlenemeyen ama her cihazda aynı görünen sabit bir belgeye dönüştürülür.
- **Resim olarak aktarma**: her slayt ayrı ayrı .jpg veya .png uzantılı bir dosya hâline getirilebilir.
- **Otomatik kaydetme**: bazı programlar açık dosyadaki değişiklikleri belirli aralıklarla kendiliğinden kaydeder.
- **Bulut kaydı**: Google Slides gibi çevrimiçi araçlarda dosya doğrudan bulut sunucusuna kaydedilir.
- **Dosya boyutu**: yüksek çözünürlüklü çok sayıda görsel, sunum dosyasının boyutunu belirgin biçimde artırır.`,
    },
    {
      heading: 'Sunum Değerlendirme Ölçütleri',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Görsel tutarlılık**: tüm slaytlarda aynı yazı tipi, renk paleti ve düzenin kullanılıp kullanılmadığı kontrol edilir.
- **Okunabilirlik**: yazı boyutunun uzaktan rahat okunacak kadar büyük olup olmadığı, en az 18 punto ölçütüyle değerlendirilir.
- **İçerik akışı**: slaytların konuyu giriş, gelişme ve sonuç sırasına uygun anlatıp anlatmadığı incelenir.
- **Görsel-metin dengesi**: bir slaytta aşırı yazı bulunup bulunmadığı, görsellerin metni destekleyip desteklemediği gözden geçirilir.
- **Kaynak gösterme**: kullanılan görsel ve bilgilerin kaynağının slayt altında belirtilip belirtilmediği denetlenir.
- **Yazım denetimi**: slayt metinlerinde yazım veya noktalama hatası olup olmadığı satır satır taranır.
- **Süre uygunluğu**: sunumun ayrılan süreye, örneğin 5 dakikaya, sığıp sığmadığı ayrı bir ölçüt olarak puanlanır.`,
    },
  ],
  cover: {
    subtitle:
      'Slaytları düzenleyip görsel, tablo ve geçişlerle zenginleştirerek özgün bir sunum dosyası hazırlamayı öğreniyoruz.',
    image_prompt:
      "A bright, friendly flat educational illustration for children showing a computer screen displaying presentation software: a large central slide with a title placeholder and bullet points plus a small chart and picture icon, and a thumbnail panel of slide previews along the left edge, simple classroom-style illustration, with Turkish text labels reading 'Slayt 1', 'Slayt 2' and 'Başlık' on the interface, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🖥️', title: 'Yeni Sunum', description: 'Boş şablon veya hazır temayla başlar' },
      { position: 'top-right', icon: '🎨', title: 'Tema ve Düzen', description: 'Slayt rengini, yazı tipini, düzenini belirler' },
      { position: 'mid-left', icon: '🖼️', title: 'Görsel ve Tablo', description: 'Slayta resim, grafik, tablo eklenir' },
      { position: 'mid-right', icon: '🎬', title: 'Geçiş Efektleri', description: 'Slaytlar arası hareketli geçiş efekti' },
      { position: 'bottom-left', icon: '💾', title: 'Kaydetme Biçimi', description: '.pptx veya PDF olarak kaydedilir' },
      { position: 'bottom-right', icon: '✅', title: 'Değerlendirme Ölçütü', description: 'Görsel tutarlılık ve okunabilirlik kontrol edilir' },
    ],
  },
};
