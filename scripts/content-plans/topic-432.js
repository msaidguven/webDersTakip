module.exports = {
  topicId: 432,
  title: 'Sunum Programlarına Giriş',
  sections: [
    {
      heading: 'Sunum Programının Özellikleri',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing the anatomy of a single presentation slide: a title text box at the top, a photo placeholder in the middle, and a small speaker-notes strip at the bottom, each part pointed to with a thin arrow, bright friendly colors, with Turkish text labels reading 'Başlık', 'Görsel' and 'Notlar' next to each part, no photorealism.",
      body_markdown: `- **Sunum programı**: bilgilerin sırayla gösterilen slaytlar hâlinde düzenlenmesini sağlayan yazılım türüdür.
- **Slayt**: bir sunumun içindeki tek bir sayfadır; metin, resim, tablo veya grafik içerebilir.
- **Metin kutusu**: slayda yazı eklemek için kullanılan, taşınıp boyutlandırılabilen bir çerçevedir.
- **Görsel ekleme**: resim veya şekil, "Ekle" menüsünden ya da sürükle-bırak yöntemiyle slayda yerleştirilir.
- **Notlar alanı**: sunumu yapan kişinin slayt altına yazdığı, izleyiciye gösterilmeyen hatırlatma metnidir.
- **Dosya uzantısı**: PowerPoint'te kaydedilen bir sunum dosyası genellikle ".pptx" uzantısıyla saklanır.
- **Slayt sıralayıcı görünüm**: tüm slaytların küçük resimler hâlinde listelendiği, sıranın sürükleyerek değiştirildiği ekrandır.`,
    },
    {
      heading: 'Sunum Programı Seçimi',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing three devices side by side: a desktop computer, a laptop and a tablet, each displaying a different colorful presentation slide on its screen, bright friendly colors, with Turkish text labels reading 'PowerPoint', 'Google Slaytlar' and 'Keynote' under each device, no photorealism.",
      body_markdown: `- **PowerPoint**: Microsoft firmasının, bilgisayara kurularak internet olmadan da çalışabilen sunum programıdır.
- **Google Slaytlar**: internet tarayıcısı üzerinden çalışan, bir Google hesabıyla ücretsiz kullanılan sunum programıdır.
- **Keynote**: yalnızca Apple marka bilgisayar ve tabletlerde çalışan sunum programıdır.
- **İnternet bağlantısı**: Google Slaytlar gibi tarayıcı tabanlı programlar için gereklidir, PowerPoint'in masaüstü sürümü için gerekmez.
- **Ortak çalışma**: bir sunum üzerinde birden fazla kişi aynı anda çalışacaksa Google Slaytlar gibi bulut tabanlı bir program tercih edilir.
- **Cihaz uyumu**: kullanılan bilgisayar veya tabletin işletim sistemine (Windows, Mac, Android) göre uygun program belirlenir.
- **Kayıt yeri**: PowerPoint dosyaları bilgisayarın diskine, Google Slaytlar dosyaları ise Google Drive bulutuna kaydedilir.`,
    },
    {
      heading: 'Sunum Programı Arayüzü',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a computer screen with a presentation program open: a horizontal toolbar with tabs at the top, a vertical strip of small slide thumbnails on the left, and a large editable slide in the center, bright friendly colors, with Turkish text labels reading 'Giriş', 'Ekle', 'Tasarım' on the toolbar tabs and 'Slaytlar' next to the left panel, no photorealism.",
      body_markdown: `- **Şerit (Ribbon)**: ekranın üst kısmında yer alan, "Giriş", "Ekle" ve "Tasarım" gibi sekmelerden oluşan araç çubuğudur.
- **Slayt paneli**: ekranın sol tarafında sunumdaki tüm slaytların küçük resimler hâlinde sıralı listelendiği bölümdür.
- **Düzenleme alanı**: ekranın ortasında, seçili slaytın büyük hâlde görüntülenip metin ve görsel eklenerek düzenlendiği bölümdür.
- **"Ekle" sekmesi**: resim, şekil, tablo ve ses dosyası gibi öğelerin slayda eklenmesini sağlayan menüdür.
- **"Tasarım" sekmesi**: slaytların renk ve yazı tipi düzenini değiştiren hazır şablonların bulunduğu menüdür.
- **"Slayt Gösterisi" sekmesi**: sunumun ilk slayttan veya bulunulan slayttan itibaren tam ekran başlatılmasını sağlayan menüdür.
- **F5 tuşu**: klavyeden basıldığında PowerPoint'te sunumu ilk slayttan başlatan kısayoldur.`,
    },
    {
      heading: 'Slayt Tasarımı ve Efektler',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing two slides connected by a curved arrow representing a transition effect, the first slide in blue-and-white theme colors and the second slide in orange-and-white theme colors, with small sparkle icons over a text element to represent animation, bright friendly colors, with Turkish text labels reading 'Geçiş' near the arrow and 'Animasyon' near the sparkle icons, no photorealism.",
      body_markdown: `- **Şablon (tema)**: slaytların renk, yazı tipi ve arka plan düzenini tek tıkla değiştiren hazır tasarım setidir.
- **Slayt düzeni**: bir slaytta başlık, içerik veya resim kutularının nerede yer alacağını belirleyen çerçevedir.
- **Geçiş efekti**: bir slayttan diğerine geçerken uygulanan görsel harekettir; "Soluklaştır" ve "Kaydırma" bunlara örnektir.
- **Animasyon**: bir slayt içindeki metin veya resmin ekranda hareketli biçimde belirmesini sağlayan efekttir.
- **Animasyon sırası**: bir slaytta birden fazla animasyon varsa hangisinin önce oynatılacağı numaralandırılarak belirlenir.
- **Yazı tipi boyutu**: başlıklarda genellikle 36-44 punto, içerik metninde 24-28 punto kullanılması okunabilirliği artırır.
- **Aşırı efekt kullanımı**: her slayda farklı geçiş ve animasyon eklemek izleyicinin dikkatini dağıtabilir.`,
    },
    {
      heading: 'Kullanım Alanları ve Verimlilik',
      matched_outcome_codes: ['ç'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing two side-by-side scenes: on the left a student presenting a colorful slide to classmates in a classroom, on the right an adult presenting a slide with a chart to colleagues around an office table, bright friendly colors, no text labels needed, no photorealism.",
      body_markdown: `- **Okul sunumları**: öğrenciler proje ve ödev sonuçlarını sınıfta anlatırken sunum programlarını sıkça kullanır.
- **İş toplantıları**: şirketlerde satış ve rapor verileri, grafik ve tablolarla desteklenerek sunum programlarıyla paylaşılır.
- **Zaman tasarrufu**: hazır şablonlar sayesinde bir sunum, sıfırdan sayfa düzenlemekten daha kısa sürede hazırlanır.
- **Görsel hafıza**: resim ve grafik içeren slaytlar, yalnızca sözle anlatılan bilgiye göre daha kolay hatırlanır.
- **Taşınabilirlik**: bulut tabanlı bir sunum dosyası internete kaydedildiği için farklı bir bilgisayardan da açılabilir.
- **Aşırı yazı riski**: bir slayda çok fazla yazı sığdırmak, izleyicinin slaytı okumakla uğraşıp konuşmacıyı dinlemeyi bırakmasına yol açar.
- **Yazdırılabilir çıktı**: sunum dosyaları, slayt başına bir veya birkaç sayfa olacak şekilde kâğıda da yazdırılabilir.`,
    },
  ],
  cover: {
    subtitle:
      'Sunum programlarını tanıyor, slaytları düzenleyip görsel ve efektlerle etkili sunumlar hazırlamayı öğreniyoruz.',
    image_prompt:
      "A bright, friendly flat educational illustration for children showing a laptop screen displaying a presentation program interface: a toolbar at the top, a vertical panel on the left with small slide thumbnails, and a large slide in the center with a title text box and a photo being inserted, simple classroom-style illustration, with Turkish text labels reading 'Slaytlar' on the left panel and 'Ekle' on one toolbar button, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🖥️', title: 'Sunum Programı', description: 'PowerPoint, Google Slaytlar gibi araçlar' },
      { position: 'top-right', icon: '🎨', title: 'Şablon ve Tema', description: 'Hazır renk ve yazı tipi seti' },
      { position: 'mid-left', icon: '🖱️', title: 'Sunum Arayüzü', description: 'Şerit, slayt paneli, düzenleme alanı' },
      { position: 'mid-right', icon: '✨', title: 'Geçiş ve Animasyon', description: 'Slaytlar arası hareketli efektler' },
      { position: 'bottom-left', icon: '📊', title: 'Kullanım Alanları', description: 'Okul ödevi ve iş toplantısı sunumları' },
      { position: 'bottom-right', icon: '⌨️', title: 'Slayt Gösterisi', description: 'F5 tuşuyla tam ekran başlar' },
    ],
  },
};
