module.exports = {
  topicId: 426,
  title: 'Dosya ve Klasör Yönetimi',
  sections: [
    {
      heading: 'Dosya ve Klasör Kavramı',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a computer file explorer window with a tree structure: a main folder icon branching into two subfolder icons, and the subfolders containing small file icons (document, image, music note), clean and friendly style, with Turkish text labels reading 'Belgelerim', 'Resimler' and 'Müzik' next to the icons, no photorealism.",
      body_markdown: `- **Dosya**, bilgisayarda saklanan tek bir bilgi birimidir (metin, resim, müzik, video).
- **Klasör**, birden fazla dosyayı bir arada düzenli tutan sanal bir kaptır.
- Klasör içine başka klasörler yerleştirilebilir; bu yapıya **alt klasör hiyerarşisi** denir.
- Dosya adının sonundaki **uzantı** (ör. .docx, .jpg, .mp3) dosyanın türünü ve açılacağı programı belirler.
- Dosyanın bilgisayardaki adresine **dosya yolu** denir, klasör adları arasına \\ işareti konur.
- Windows'ta dosya ve klasörler **Dosya Gezgini** programıyla görüntülenir ve yönetilir.
- Aynı klasörde iki dosyaya veya iki alt klasöre aynı ad verilemez.
- **Masaüstü** de özel bir klasördür; sık kullanılan dosya ve kısayollar burada tutulur.`,
    },
    {
      heading: 'Klasör Oluşturma ve Adlandırma',
      matched_outcome_codes: ['a', 'b'],
      needs_image: true,
      image_prompt:
        "A flat educational illustration for children showing a computer desktop with a right-click context menu open, highlighting a menu item, and a new folder icon with a blinking text cursor next to its name ready for renaming, simple friendly colors, with a Turkish text label reading 'Yeni Klasör' next to the folder icon, no photorealism.",
      body_markdown: `- Yeni klasör oluşturmak için boş bir alana **sağ tıklanır**, "Yeni > Klasör" seçilir.
- Klasör oluşturmanın klavye kısayolu Windows'ta **Ctrl+Shift+N**'dir.
- Yeni klasörün varsayılan adı "Yeni Klasör"dür; adını değiştirmek için **F2 tuşuna** basılır.
- Dosya adlarında **\\, /, :, *, ?, ", <, >, |** karakterleri kullanılamaz.
- Klasör adları kısa ve açıklayıcı seçilmelidir (ör. "5. Sınıf Ödevleri").
- Var olan bir dosya veya klasörü yeniden adlandırmak için sağ tıklayıp **"Yeniden Adlandır"** seçilir.
- Türkçe karakterler (ç, ğ, ı, ö, ş, ü) dosya adında kullanılabilir, bazı eski programlarda sorun çıkarabilir.
- Bir klasördeki alt klasör sayısı ve iç içe geçme derinliği pratikte sınırlanmaz.`,
    },
    {
      heading: 'Kopyalama, Taşıma ve Silme',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A flat educational illustration for children showing three simple icons side by side connected by arrows: a copy icon (two overlapping documents), a cut/scissors icon, and a recycle bin icon with a document falling into it, bright and clear style, with Turkish text labels reading 'Kopyala', 'Kes' and 'Geri Dönüşüm Kutusu' under each icon, no photorealism.",
      body_markdown: `- Dosya **kopyalamak** için "Kopyala" seçilir, hedef klasörde "Yapıştır" ile içerik çoğaltılır.
- Kopyalamanın kısayolu **Ctrl+C**, yapıştırmanın kısayolu **Ctrl+V**'dir.
- Dosya **taşımak** için "Kes" (Ctrl+X) kullanılır; dosya eski konumdan silinip yeni konuma aktarılır.
- Fareyle dosyayı sürükleyip bırakma işlemine **sürükle-bırak** denir, aynı sürücüde dosyayı taşır.
- Silinen dosyalar yok olmaz, önce **Geri Dönüşüm Kutusu**'na taşınır ve geri getirilebilir.
- Geri Dönüşüm Kutusu'na uğratmadan kalıcı silmek için **Shift+Delete** kullanılır.
- Birden fazla dosya seçmek için **Ctrl tuşu**, ardışık dosyalar için **Shift tuşu** kullanılır.
- Klasör silindiğinde içindeki tüm alt klasör ve dosyalar da silinir.`,
    },
    {
      heading: 'Dosya ve Klasör Sıkıştırma',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A flat educational illustration for children showing a large folder icon on the left with an arrow pointing to a smaller folder icon with a zipper drawn across it on the right, representing file compression, bright simple colors, with Turkish text labels reading 'Klasör' under the large icon and 'Sıkıştırılmış Klasör' under the small zipped icon, no photorealism.",
      body_markdown: `- **Sıkıştırma**, bir veya birden fazla dosyanın boyutunu küçültüp tek dosya hâline getirme işlemidir.
- Sıkıştırılmış dosyalar genellikle **.zip** veya **.rar** uzantısıyla oluşturulur.
- Sıkıştırmak için dosyaya sağ tıklanır, "Gönder > Sıkıştırılmış (zip'lenmiş) klasör" seçilir.
- Sıkıştırma, özellikle metin ve belge dosyalarında boyutu belirgin biçimde azaltır.
- Sıkıştırılmış dosyalar daha az **depolama alanı** kaplar, internetten daha hızlı aktarılır.
- Birden fazla dosya tek sıkıştırılmış dosyada birleşince e-posta gönderimi ve arşivleme kolaylaşır.
- Kullanmadan önce sıkıştırılmış dosyanın içeriği çift tıklanıp **çıkartılmalıdır** (extract).
- Zaten sıkıştırılmış olan **.jpg** veya **.mp4** dosyaları tekrar sıkıştırıldığında pek küçülmez.`,
    },
  ],
  cover: {
    subtitle:
      'Dosya ve klasörlerin nasıl oluşturulacağını, adlandırılacağını, taşınacağını ve sıkıştırılacağını öğreniyoruz.',
    image_prompt:
      "A bright flat educational illustration for children showing a computer screen with a file explorer window open: folder icons, a document file icon, and a zip compressed folder icon with a zipper symbol, simple friendly colors, no photorealism, with a Turkish text label reading 'Belgelerim' on one of the folder icons.",
    highlights: [
      { position: 'top-left', icon: '📁', title: 'Klasör Oluşturma', description: 'Sağ tık ile yeni klasör açma' },
      { position: 'top-right', icon: '✂️', title: 'Kes-Kopyala-Yapıştır', description: 'Ctrl+X, Ctrl+C, Ctrl+V kısayolları' },
      { position: 'mid-left', icon: '🗑️', title: 'Geri Dönüşüm Kutusu', description: 'Silinen dosyalar önce buraya taşınır' },
      { position: 'mid-right', icon: '🗜️', title: 'Sıkıştırma', description: '.zip uzantılı dosya boyutunu küçültür' },
      { position: 'bottom-left', icon: '🌳', title: 'Klasör Hiyerarşisi', description: 'Klasör içinde alt klasörler bulunabilir' },
    ],
  },
};
