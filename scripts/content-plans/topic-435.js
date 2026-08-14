module.exports = {
  topicId: 435,
  title: 'Bilgisayar Ağ Türleri ve Bağlanma Yöntemleri',
  sections: [
    {
      heading: 'Kablolu Bağlantı Yöntemleri',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing an Ethernet cable with an RJ45 connector plugging into the back of a desktop computer and a router, close-up view of the cable and connector, bright friendly colors, with a Turkish text label reading 'Ethernet Kablosu' near the cable, no photorealism.",
      body_markdown: `- **Ethernet kablosu**: bilgisayarı doğrudan modem veya router'a bağlayan, ucunda RJ45 konektörü bulunan bakır kablodur.
- **Bakır çift burma kablo (twisted pair)**: ev ve okullardaki ağ bağlantılarında en sık kullanılan, Cat5e ve Cat6 gibi kategorilere ayrılan kablo türüdür.
- **Fiber optik kablo**: veriyi ışık sinyalleriyle taşıdığı için bakır kabloya göre çok daha uzun mesafede hız kaybı yaşamadan bağlantı sağlar.
- **Bağlantı mesafesi**: standart bir Ethernet kablosu yaklaşık 100 metreden sonra sinyal kaybı yaşamaya başlar.
- **Kararlılık**: kablolu bağlantı, radyo dalgalarından etkilenmediği için kesintiye daha az uğrar ve genellikle kablosuza göre daha hızlıdır.
- **Kullanım alanı**: masaüstü bilgisayarlar, oyun konsolları ve ağ yazıcıları gibi sabit duran cihazlar sıklıkla kablolu bağlantı kullanır.
- **Sınırlılık**: kablo uzunluğu kadar hareket alanı sunduğu için taşınabilir cihazlarda kullanışlı değildir.`,
    },
    {
      heading: 'Kablosuz Bağlantı Yöntemleri',
      matched_outcome_codes: ['a', 'b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a house cross-section with a router at the center sending wavy Wi-Fi signal lines to a laptop, a smartphone connected via Bluetooth to wireless earbuds with short wavy lines, and a phone outside the house connected to a cell tower with mobile data signal lines, bright friendly colors, with Turkish text labels reading 'Wi-Fi', 'Bluetooth' and 'Mobil Veri' next to each connection type, no photorealism.",
      body_markdown: `- **Wi-Fi**: modem veya router'dan yayılan radyo dalgalarıyla, kablo olmadan internete bağlanmayı sağlayan kablosuz ağ teknolojisidir.
- **Frekans bantları**: Wi-Fi genellikle 2,4 GHz ve 5 GHz frekanslarında yayın yapar; 5 GHz daha hızlı ama duvarlardan daha az geçer.
- **Kapsama alanı**: bir Wi-Fi erişim noktası, ev içinde ortalama 30-50 metre yarıçapında sinyal sağlar.
- **Bluetooth**: yaklaşık 10 metre menzilde çalışan, kulaklık, fare veya klavye gibi yakın cihazları eşleştirmek için kullanılan düşük güçlü bir teknolojidir.
- **Mobil veri**: telefon ve tabletlerin, baz istasyonları üzerinden 4G veya 5G gibi hücresel ağ teknolojileriyle internete bağlanmasını sağlar.
- **Sinyal gücü**: kaynaktan uzaklaştıkça ve engellerle karşılaştıkça zayıflayarak bağlantı hızını düşürür.
- **Güvenlik**: kablosuz ağlara yetkisiz erişimi önlemek için şifre ve WPA2 gibi şifreleme yöntemleri kullanılır.`,
    },
    {
      heading: 'Bağlantı Donanım Bileşenleri',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing the path of an internet connection: a wall socket connects to a modem, the modem connects to a router with an antenna, and the router connects with cable icons and wireless wave icons to a computer, a laptop and a phone, bright friendly colors, with Turkish text labels reading 'Modem', 'Router' and 'Ağ Kartı' under the relevant devices, no photorealism.",
      body_markdown: `- **Modem**: internet servis sağlayıcısından gelen sinyali, bilgisayarların anlayabileceği dijital veriye çeviren cihazdır.
- **Router (yönlendirici)**: modemden gelen interneti evdeki veya sınıftaki birden fazla cihaza dağıtan ağ bileşenidir.
- **Kablosuz erişim noktası**: router içindeki bu birim, kabloyla gelen sinyali Wi-Fi dalgalarına dönüştürüp kablosuz cihazlara ulaştırır.
- **Ağ kartı (NIC)**: her bilgisayar, telefon veya yazıcıda bulunan, cihazı ağa bağlayan donanım birimidir; kablolu veya kablosuz olabilir.
- **Switch (anahtar)**: birden fazla kablolu cihazı aynı yerel ağda birbirine bağlayan, gelen veriyi doğru porta yönlendiren cihazdır.
- **MAC adresi**: her ağ kartının fabrikada verilen, dünyada eşi olmayan benzersiz bir tanımlama numarasıdır.
- **Anten**: kablosuz erişim noktalarında ve mobil cihazlarda bulunan, sinyalleri gönderip alan parçadır.
- **Ethernet portu**: router'ların arkasında genellikle 4 adet RJ45 girişi bulunur ve her girişe bir kablolu cihaz bağlanabilir.`,
    },
    {
      heading: 'Ağ Kapsama Alanı Türleri',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing three concentric circles of increasing size around a child at the center: the smallest circle labeled for personal devices like a smartwatch and earbuds, a medium circle around a house representing a home network, and a large circle around a city skyline representing a wide connection between cities, bright friendly colors, with Turkish text labels reading 'PAN', 'LAN' and 'WAN' on each circle, no photorealism.",
      body_markdown: `- **LAN (Yerel Alan Ağı)**: bir ev, sınıf veya okul gibi sınırlı bir alanı kapsayan ağ türüdür.
- **WAN (Geniş Alan Ağı)**: şehirler ve ülkeler arasındaki birçok LAN'ı birbirine bağlar; internet en büyük WAN örneğidir.
- **PAN (Kişisel Alan Ağı)**: bir kişinin etrafındaki birkaç metrelik alanı kapsayan, genellikle Bluetooth ile kurulan en küçük ağ türüdür.
- **Kapsama alanı sıralaması**: PAN en küçük, WAN en büyük alanı kapsar; WAN binlerce kilometreye uzanabilir.
- **LAN örneği**: bir okuldaki tüm bilgisayarların aynı router'a bağlanarak dosya ve yazıcı paylaşması LAN'a örnektir.
- **PAN örneği**: bir telefonun Bluetooth ile kablosuz kulaklığa veya akıllı saate bağlanması PAN'a örnektir.
- **Bağlantı yöntemiyle ilişkisi**: LAN Ethernet veya Wi-Fi ile, WAN fiber optik hatlarla, PAN ise Bluetooth ile kurulur.`,
    },
    {
      heading: 'Bağlantı Yöntemi Karşılaştırması',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a side-by-side comparison chart with three columns: a column with an Ethernet cable icon and a ruler showing a long distance, a column with a Wi-Fi signal icon and a medium distance ruler, and a column with a cell tower icon and a short distance ruler for Bluetooth, bright friendly colors, with Turkish text labels reading 'Kablolu', 'Kablosuz' and 'Mobil Veri' above each column, no photorealism.",
      body_markdown: `- **Hız karşılaştırması**: fiber optik kablo saniyede gigabit hıza ulaşabilirken, Wi-Fi genellikle bu hızın bir kısmını sunar.
- **Mesafe karşılaştırması**: kablolu bağlantı yaklaşık 100 metrede sınırlıyken, Wi-Fi 30-50 metre, Bluetooth ise yalnızca 10 metre civarında etkilidir.
- **Kararlılık farkı**: kablolu bağlantı sinyal kesintisine daha az uğrar, kablosuz bağlantı ise duvar ve parazitten etkilenebilir.
- **Hareket serbestliği**: kablosuz yöntemler cihazın taşınmasına izin verirken, kablolu bağlantı kablonun uzunluğuyla sınırlı bir alana hapseder.
- **Kurulum farkı**: kablolu bağlantı duvar içinden kablo çekmeyi gerektirirken, kablosuz bağlantı yalnızca bir erişim noktası kurmayı gerektirir.
- **Mobil veri farkı**: Wi-Fi'den farklı olarak mobil veri, ev veya işyeri dışında baz istasyonu kapsama alanı olan her yerde çalışır.`,
    },
  ],
  cover: {
    subtitle:
      'Bilgisayarların birbirine kablolu, kablosuz ve mobil yöntemlerle nasıl bağlandığını ve bu bağlantıyı sağlayan cihazları öğreniyoruz.',
    image_prompt:
      "A bright, friendly flat educational illustration for children showing a classroom scene with a router on a desk, a desktop computer connected to it by a visible Ethernet cable, and a laptop and a smartphone nearby connected through wavy Wi-Fi signal lines, simple classroom-style illustration, with Turkish text labels reading 'Kablolu' and 'Kablosuz' near the respective connections, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🔌', title: 'Kablolu Bağlantı', description: 'Ethernet kablosu, 100 metreye kadar' },
      { position: 'top-right', icon: '📶', title: 'Kablosuz Bağlantı', description: 'Wi-Fi, 30-50 metre menzil' },
      { position: 'mid-left', icon: '📱', title: 'Mobil Veri', description: '4G/5G ile baz istasyonundan bağlanır' },
      { position: 'mid-right', icon: '🎧', title: 'Bluetooth', description: '10 metre menzilli kişisel bağlantı' },
      { position: 'bottom-left', icon: '📡', title: 'Router', description: 'İnterneti birden fazla cihaza dağıtır' },
      { position: 'bottom-right', icon: '🌐', title: 'Ağ Türleri', description: 'PAN, LAN ve WAN kapsam alanları' },
    ],
  },
};
