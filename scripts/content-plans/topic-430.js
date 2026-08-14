module.exports = {
  topicId: 430,
  title: 'Kelime İşlemci Programlarına Giriş',
  sections: [
    {
      heading: 'Kelime İşlemci Programının Temel Özellikleri',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A bright flat educational illustration for children showing a laptop screen with a simple word processor interface: a text page with a blinking cursor, a top toolbar with font and alignment icons, and a small red wavy underline beneath one word representing spell-check, with Turkish text labels reading 'Yazı Tipi' and 'Yazım Denetimi', simple classroom style, no photorealism.",
      body_markdown: `- **Kelime işlemci**: metin yazma, düzenleme ve biçimlendirme işlemlerini tek bir yazılımda birleştiren program türüdür.
- **Yazı tipi (font)**: harflerin şeklini, boyutunu ve rengini değiştirmeye yarayan temel biçimlendirme özelliğidir.
- **Paragraf hizalama**: metni sola, sağa, ortaya veya iki yana yaslayarak sayfadaki düzenini belirler.
- **Sayfa yapısı**: kağıt boyutu (ör. A4), kenar boşlukları ve sayfa yönünü (dikey/yatay) ayarlayan bölümdür.
- **Yazım denetimi**: hatalı yazılan kelimelerin altını kırmızı dalgalı çizgiyle otomatik olarak işaretler.
- **Nesne ekleme**: metnin içine resim, tablo, grafik ve şekil yerleştirilmesini sağlar.
- **Kelime sayacı**: belgedeki toplam kelime ve karakter sayısını anlık olarak gösterir.
- **Kayıt biçimi**: hazırlanan belge .docx, .pdf veya .odt gibi farklı dosya uzantılarıyla saklanabilir.`,
    },
    {
      heading: 'Program Seçim Ölçütleri',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing three separate computer/laptop screens side by side, each displaying a different word processor's simplified interface, with Turkish text labels reading 'Microsoft Word', 'Google Dokümanlar' and 'LibreOffice Writer' above each screen, bright colors, no photorealism.",
      body_markdown: `- **Microsoft Word**: bilgisayara kurularak kullanılan, ücretli ve dünyada en yaygın tercih edilen kelime işlemcilerden biridir.
- **Google Dokümanlar**: internet tarayıcısı üzerinden ücretsiz çalışır, belgeler otomatik olarak Google Drive'a kaydedilir.
- **LibreOffice Writer**: açık kaynak kodlu ve ücretsizdir; internet bağlantısı olmadan bilgisayara kurularak kullanılabilir.
- **İnternet bağlantısı**: çevrimiçi programlarda zorunludur, çevrimdışı programlarda belge yalnızca kurulu bilgisayarda açılabilir.
- **Ortak çalışma**: bulut tabanlı programlar birden fazla kişinin aynı belgeyi eş zamanlı düzenlemesine izin verir.
- **İşletim sistemi uyumu**: bazı programlar yalnızca Windows'ta, bazıları hem Windows hem macOS'ta tam performansla çalışır.
- **Maliyet**: ücretli programlar lisans bedeli gerektirirken, ücretsiz seçenekler okul projelerinde daha çok tercih edilir.
- **Depolama alanı**: bilgisayara kurulan programlar disk alanı kaplarken, tarayıcı tabanlı programlar ek kurulum gerektirmez.`,
    },
    {
      heading: 'Araç Çubuğu ve Biçimlendirme Komutları',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A flat educational illustration for children showing a close-up of a word processor toolbar (ribbon) with clearly drawn icons for bold, italic, underline, bullet list, numbering and line spacing, with Turkish text labels reading 'Kalın', 'İtalik' and 'Madde İşareti' next to the icons, bright and simple classroom style, no photorealism.",
      body_markdown: `- **Araç çubuğu (ribbon)**: ekranın üst kısmında yer alır, komutları Giriş, Ekle, Düzen gibi sekmeler hâlinde gruplar.
- **Kalın, italik ve altı çizili**: seçilen metnin görünümünü tek tıkla değiştiren üç temel vurgu düğmesidir.
- **Madde işareti ve numaralandırma**: liste hâlindeki bilgileri sıralı veya işaretli biçimde düzenler.
- **Satır aralığı**: paragraf içindeki satırlar arasındaki boşluğu ayarlar; genellikle 1, 1,5 veya 2 aralık seçenekleri sunulur.
- **Kes, kopyala ve yapıştır**: seçilen metnin belge içinde başka bir yere taşınmasını veya çoğaltılmasını sağlar.
- **Geri al (Ctrl+Z)**: yapılan son işlemi iptal ederek hatanın hızlıca düzeltilmesini sağlar.
- **Kaydet (Ctrl+S)**: belgedeki değişiklikleri dosyaya işleyen kısayoldur; sık kullanılmadığında veri kaybı riski artar.
- **Yakınlaştırma (zoom)**: sayfanın ekranda büyük veya küçük görüntülenmesini ayarlayan kaydırma çubuğudur.`,
    },
    {
      heading: 'Kullanım Alanları ve Verimlilik Değerlendirmesi',
      matched_outcome_codes: ['ç'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Ödev ve rapor**: kelime işlemciler okul çalışmalarında en sık kullanılan belge türlerinin hazırlanmasını sağlar.
- **Dilekçe ve özgeçmiş (CV)**: resmi belgelerin düzenli ve okunaklı biçimde hazırlanmasında tercih edilir.
- **Hazır şablon (template)**: mektup veya rapor gibi belgelerin sıfırdan tasarlanmadan hızlıca oluşturulmasına yarar.
- **Sürüm geçmişi**: bulut tabanlı programlarda belgenin önceki hâllerine dönülmesine imkân tanıyan kayıt listesidir.
- **Zaman karşılaştırması**: el yazısıyla yazmaya kıyasla, düzeltme ve yeniden düzenleme kelime işlemcide çok daha kısa sürer.
- **Dosya uyuşmazlığı**: bir programda hazırlanan belge farklı bir programda açıldığında biçim bozulması görülebilir.
- **Amaç-program uyumu**: kısa bir not için basit bir program, uzun ve ortak bir rapor için bulut tabanlı bir program daha uygundur.
- **Kelime sınırı takibi**: sınav veya ödevlerde istenen kelime sayısına, kelime sayacı aracıyla kolayca uyulur.`,
    },
  ],
  cover: {
    subtitle:
      'Metin yazıp biçimlendirmeyi, doğru programı seçmeyi ve araç çubuğundaki temel komutları kullanmayı öğreniyoruz.',
    image_prompt:
      "A bright flat educational illustration for children showing a laptop screen displaying a simple word processor interface: a toolbar at the top with bold, italic, and alignment icons, a blinking cursor on a page of text lines, with Turkish text labels reading 'Yazı Tipi' and 'Biçimlendir' on the toolbar, simple and colorful classroom style, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '📝', title: 'Yazı Tipi', description: 'Font, punto ve renk seçenekleri' },
      { position: 'top-right', icon: '📐', title: 'Sayfa Yapısı', description: 'A4 boyut ve kenar boşlukları' },
      { position: 'mid-left', icon: '🔎', title: 'Yazım Denetimi', description: 'Kırmızı dalgalı çizgiyle hata gösterir' },
      { position: 'mid-right', icon: '💻', title: 'Program Seçimi', description: 'Word, Dokümanlar, Writer karşılaştırması' },
      { position: 'bottom-left', icon: '⌨️', title: 'Klavye Kısayolları', description: 'Ctrl+B kalın, Ctrl+Z geri al' },
      { position: 'bottom-right', icon: '💾', title: 'Dosya Biçimleri', description: '.docx, .pdf, .odt uzantıları' },
    ],
  },
};
