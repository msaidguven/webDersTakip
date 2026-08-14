module.exports = {
  topicId: 421,
  title: 'Bilişim Teknolojilerinin Sınıflandırılması',
  sections: [
    {
      heading: 'Bilişim Teknolojisi Kavramı',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing two groups of icons side by side: physical hardware devices (a computer, a tablet, a keyboard, a mouse, a printer) on the left, and software/app icons (a gear icon representing an operating system, a few colorful app icons) on the right, clean bright colors, no photorealism, no text.",
      body_markdown: `- **Bilişim teknolojisi**: bilginin toplanması, işlenmesi, saklanması ve paylaşılması için kullanılan araç, cihaz ve yöntemlerin tümüdür.
- **Donanım**: bilgisayar, tablet, klavye, fare, yazıcı gibi elle tutulup gözle görülebilen fiziksel parçalardır.
- **Yazılım**: donanımı çalıştıran ve yönlendiren programlardır; işletim sistemi (örneğin Windows, Android) ve uygulamalar bu gruba girer.
- Bir bilgisayar, donanımı ve yazılımı bir arada çalışmadan hiçbir işlem yapamaz; donanım araçtır, yazılım o aracı yönetir.
- **Veri**, henüz işlenmemiş ham sayı, harf veya resimdir; **bilgi** ise verinin düzenlenip anlamlı hâle getirilmiş şeklidir.
- **İnternet**, dünyadaki milyonlarca bilgisayarı birbirine bağlayan ve bilgi paylaşımını sağlayan küresel ağdır.
- Akıllı saat, oyun konsolu ve e-kitap okuyucu gibi cihazlar da günlük hayatta sık karşılaşılan bilişim teknolojisi örnekleridir.`,
    },
    {
      heading: 'Geçmişten Günümüze Değişim',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A split-scene flat educational illustration for children: on the left side, old technology shown small and vintage-style — a mechanical typewriter, a rotary telephone, and a floppy disk; on the right side, modern technology — a laptop, a smartphone, and a cloud icon; a simple dividing line in the middle, bright educational style, with Turkish text labels reading 'Dün' on the left and 'Bugün' on the right, no photorealism.",
      body_markdown: `- Daktilo, tuşlara basılarak kâğıda yazı basan mekanik bir makineydi; bugün bu işi bilgisayardaki kelime işlemci programları yapar.
- Mektup ve telgrafla haberleşme günler sürerken, e-posta ve mesajlaşma uygulamaları iletiyi saniyeler içinde ulaştırır.
- Eski sabit hatlı telefonlar kabloyla evde sabitken, akıllı telefonlar taşınabilir olup kamera, harita ve internet gibi birçok işlevi tek cihazda toplar.
- Bilgiye ulaşmak için eskiden kütüphanede kitap taranırken, bugün arama motorları aynı bilgiyi saniyeler içinde ekrana getirir.
- Disket ve CD birkaç yüz megabayt bilgi tutarken, bulut depolama ve USB bellekler yüzlerce gigabaytlık veriyi taşınabilir şekilde saklar.
- Geçmişteki ve günümüzdeki bilişim araçlarının amacı aynıdır: bilgiyi saklamak, işlemek ve iletmek; değişen ise hız ve kolaylıktır.
- Bilişim teknolojilerindeki en hızlı değişim, mobil telefon ve internetin yaygınlaştığı son otuz yılda yaşanmıştır.`,
    },
    {
      heading: 'Kullanım Alanlarına Göre Sınıflandırma',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A flat educational illustration for children showing six labeled category icons arranged in a grid: a phone for communication, a smart board for education, a heartbeat/MR icon for health, a game controller for entertainment, a navigation arrow for transportation, and a shopping cart for commerce, bright simple colors, with small Turkish text labels under each icon reading 'İletişim', 'Eğitim', 'Sağlık', 'Eğlence', 'Ulaşım', 'Ticaret', no photorealism.",
      body_markdown: `- İletişim alanında telefon, e-posta ve sosyal medya uygulamaları kullanılır; bu araçlarla yazılı, sesli veya görüntülü haberleşme sağlanır.
- Eğitim alanında akıllı tahta, eğitim yazılımları ve e-kitaplar derslerin dijital ortamda görsellerle işlenmesini sağlar.
- Sağlık alanında MR ve tomografi cihazları vücudun iç yapısını görüntülerken, akıllı bileklikler nabız ve uyku düzenini takip edebilir.
- Eğlence alanında oyun konsolları, dijital müzik ve video platformları zaman geçirme ve dinlenme ihtiyacını karşılar.
- Ulaşım alanında navigasyon uygulamaları en kısa yolu gösterirken, akıllı trafik ışıkları araç yoğunluğuna göre kendini ayarlayabilir.
- Ticaret alanında online alışveriş siteleri ve POS cihazlarıyla ödeme, mağazaya gitmeden veya nakit kullanmadan alışverişi tamamlar.
- Akıllı telefon gibi tek bir cihaz birden fazla alana girebilir; aynı cihazdan hem mesajlaşma hem video izleme hem alışveriş yapılabilir.`,
    },
  ],
  cover: {
    subtitle:
      'Bilişim teknolojisinin temel kavramlarını, geçmişten günümüze değişimini ve kullanım alanlarına göre sınıflandırılmasını öğreniyoruz.',
    image_prompt:
      "A bright, friendly flat illustration for children showing a collage of information technology devices — a laptop, a smartphone, a tablet, a smart watch, and a game console — arranged around a simple network/globe icon in the center, clean educational style, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '💻', title: 'Donanım ve Yazılım', description: 'Fiziksel parçalar ile onları çalıştıran programlar' },
      { position: 'top-right', icon: '⌨️', title: 'Geçmiş ve Bugün', description: 'Daktilo yerini kelime işlemci programlarına bıraktı' },
      { position: 'mid-left', icon: '📡', title: 'Hızlı İletişim', description: 'Mektup yerine e-posta saniyeler içinde ulaşır' },
      { position: 'mid-right', icon: '🏥', title: 'Sağlık Teknolojisi', description: 'MR cihazı ve akıllı bileklikler örnektir' },
      { position: 'bottom-left', icon: '🎮', title: 'Eğlence Araçları', description: 'Oyun konsolları ve dijital müzik platformları' },
      { position: 'bottom-right', icon: '🛒', title: 'Kullanım Alanları', description: 'İletişim, eğitim, sağlık, ulaşım ve ticaret gibi alanlar' },
    ],
  },
};
