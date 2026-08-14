module.exports = {
  topicId: 434,
  title: 'Bilgisayar Ağları ve Ağ Bileşenleri',
  sections: [
    {
      heading: 'Bilgisayar Ağı ve Amacı',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a home network scene: a laptop, a desktop computer and a printer connected by glowing lines to a central box, representing shared devices, bright friendly colors, simple classroom-style illustration, with a Turkish text label reading 'Bilgisayar Ağı' above the scene, no photorealism.",
      body_markdown: `- **Bilgisayar ağı**, iki veya daha fazla cihazın kablo ya da kablosuz sinyallerle birbirine bağlanarak veri alışverişi yapmasını sağlayan sistemdir.
- **Kaynak paylaşımı**, bir yazıcı veya tarayıcının, ağa bağlı birden fazla bilgisayar tarafından ortak kullanılmasını sağlar.
- **Dosya paylaşımı**, belge, fotoğraf ve program gibi veriler ağ üzerinden başka bir cihaza anında aktarılabilir.
- **Ev ağı büyüklüğü**, genellikle 5-10 cihazı bağlarken, bir okul ağı aynı anda yüzlerce bilgisayarı bağlayabilir.
- **ARPANET**, 1969 yılında ABD'de kurulan, günümüz bilgisayar ağlarının ilk örneği kabul edilen ağdır.
- **Veri trafiği**, ağa bağlı cihaz sayısı arttıkça yükselir ve bağlantı hızını düşürebilir.
- **Ağsız çalışma**, her bilgisayar tek başına çalıştığında, veri aktarımı için USB bellek gibi taşınabilir araçlara ihtiyaç duyar.`,
    },
    {
      heading: 'Sunucu ve İstemci İlişkisi',
      matched_outcome_codes: ['a', 'b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing one large computer tower labeled as a server on one side, with three smaller devices (a laptop, a tablet and a desktop computer) connected to it by lines on the other side, bright friendly colors, with Turkish text labels reading 'Sunucu' near the large computer and 'İstemci' near the smaller devices, no photorealism.",
      body_markdown: `- **Sunucu (server)**, ağdaki diğer cihazlara dosya, sayfa veya veri sağlayan, genellikle güçlü donanıma sahip bilgisayardır.
- **İstemci (client)**, sunucudan hizmet isteyen ve aldığı veriyi kullanan bilgisayar veya telefon gibi cihazdır.
- **İstek-yanıt süreci**, istemcinin bir web sayfası gibi istek göndermesi ve sunucunun bu isteği karşılayarak veriyi geri yollamasıdır.
- **Örnek**, okul kütüphanesindeki ödünç kitap kayıtları bir sunucuda tutulur, öğretmen bilgisayarları istemci olarak bu sunucuya bağlanır.
- **Hizmet kapasitesi**, tek bir sunucu aynı anda yüzlerce hatta binlerce istemciye hizmet verebilir.
- **Çalışma süresi farkı**, sunucular günün her saati açık kalacak şekilde çalışırken, istemci cihazlar belirli saatlerde kullanılır.
- **Arıza riski**, sunucu çalışmayı durdurduğunda ona bağlı tüm istemciler aynı anda hizmet alamaz duruma gelir.`,
    },
    {
      heading: 'Temel Ağ Donanımları',
      matched_outcome_codes: ['a', 'c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing four separate network hardware icons side by side: a modem box with signal waves, a router with small antennas, a switch with multiple port lights, and a small network card chip, bright friendly colors, with Turkish text labels reading 'Modem', 'Yönlendirici', 'Anahtar' and 'Ağ Kartı' under each icon, no photorealism.",
      body_markdown: `- **Modem**, internet servis sağlayıcısından gelen sinyali, ev ağının anlayabileceği dijital veriye çeviren cihazdır.
- **Yönlendirici (router)**, ağa gelen veri paketlerini hedeflendiği doğru cihaza yönlendiren donanımdır.
- **Anahtar (switch)**, birden fazla cihazı aynı yerel ağda birbirine bağlayan, üzerinde portlar bulunan kutu şeklindeki cihazdır.
- **Ağ kartı**, bir bilgisayarın ağa bağlanabilmesi için anakarta takılan veya entegre edilen donanım parçasıdır.
- **Port sayısı**, ev tipi bir anahtar genellikle 4-8 porta sahipken, okul ağlarındaki anahtarlar 24-48 porta kadar çıkabilir.
- **Görev farkı**, modem interneti eve taşırken yönlendirici bu interneti evdeki cihazlar arasında paylaştırır; ikisi çoğu zaman tek cihazda birleşir.
- **Işık göstergesi**, yönlendirici üzerindeki yanıp sönen ışıklar, o anda veri gönderilip alındığını gösterir.`,
    },
    {
      heading: 'IP Adresi ve MAC Adresi',
      matched_outcome_codes: ['a', 'b', 'ç'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing three connected devices (a laptop, a phone and a desktop computer), each with a small numbered tag floating above it representing a unique address, bright friendly colors, with a Turkish text label reading 'IP Adresi' near one of the tags, no photorealism.",
      body_markdown: `- **IP adresi**, ağa bağlı her cihaza atanan, o cihazı ağ üzerinde tanımlayan sayısal adrestir.
- **IPv4 biçimi**, yaygın kullanılan IP adresleri, 192.168.1.1 örneğinde olduğu gibi noktalarla ayrılmış dört sayı grubundan oluşur.
- **MAC adresi**, ağ kartına üretim sırasında verilen, değiştirilemeyen benzersiz bir donanım numarasıdır.
- **Sabitlik farkı**, IP adresi cihaz farklı ağlara bağlandıkça değişebilirken, MAC adresi aynı cihazda hep sabit kalır.
- **Çakışma sorunu**, aynı ağdaki iki cihaz aynı IP adresini alırsa, cihazlardan biri bağlantı sorunu yaşar.
- **Adres görüntüleme**, bir bilgisayarın IP adresi, ağ ayarları ekranından veya komut satırına "ipconfig" yazılarak öğrenilebilir.
- **Dikkat noktası**, internette görünen "IP adresim" bilgisi genellikle evin dışına açılan ortak adrestir, evdeki her cihazın kendi yerel IP'si ayrıdır.`,
    },
    {
      heading: 'Veri Paketleri ve Bant Genişliği',
      matched_outcome_codes: ['c', 'd'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a wide pipe and a narrow pipe side by side, each with small colorful envelope-shaped packet icons flowing through them at different speeds, bright friendly colors, with a Turkish text label reading 'Veri Paketi' near the envelopes, no photorealism.",
      body_markdown: `- **Veri paketi**, ağ üzerinden gönderilen her bilginin küçük parçalara bölünerek yollanan halidir.
- **Yeniden birleştirme**, gönderilen paketler farklı yollardan hedefe ulaşabilir ve alıcı cihazda tekrar doğru sırayla birleştirilir.
- **Bant genişliği**, bir ağ bağlantısının birim zamanda taşıyabileceği veri miktarıdır.
- **Ölçü birimi**, bant genişliği genellikle "Mbps" yani saniyede megabit birimiyle ölçülür, örneğin 100 Mbps'lik bir bağlantı.
- **Yoğunluk etkisi**, bant genişliği düşük bir ağda çok sayıda cihaz aynı anda video izlerse görüntü takılabilir veya bulanıklaşabilir.
- **Hız farkı çıkarımı**, pakette yazan hız ile ölçülen gerçek hız arasında büyük fark varsa, ağda yoğunluk veya sinyal sorunu olduğu anlaşılabilir.
- **Birim karışıklığı**, "Mbps" ile dosya boyutu birimi olan "MB" karıştırılmamalıdır; 8 Mbps yaklaşık 1 MB/saniyeye karşılık gelir.`,
    },
  ],
  cover: {
    subtitle:
      'Bilgisayar ağının bileşenlerini, sunucu-istemci ilişkisini ve IP adresleriyle veri paketlerinin yolculuğunu öğreniyoruz.',
    image_prompt:
      "A bright, friendly flat educational illustration for children showing a home network scene: a modem and router box glowing with connection lines reaching out to a laptop, a desktop computer and a printer, each connected device with a small number tag representing an address, simple classroom-style illustration, colorful and clean, with Turkish text labels reading 'Yönlendirici', 'Modem' and 'IP Adresi' near the relevant parts, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🖥️', title: 'Sunucu', description: 'İstemcilere hizmet veren güçlü bilgisayar' },
      { position: 'top-right', icon: '💻', title: 'İstemci', description: 'Sunucudan hizmet isteyen cihaz' },
      { position: 'mid-left', icon: '📡', title: 'Yönlendirici', description: 'Veri paketlerini doğru cihaza yönlendirir' },
      { position: 'mid-right', icon: '🔌', title: 'Modem', description: 'İnterneti eve taşıyan cihaz' },
      { position: 'bottom-left', icon: '🔢', title: 'IP Adresi', description: 'Her cihaza atanan sayısal adres, ör. 192.168.1.1' },
      { position: 'bottom-right', icon: '📦', title: 'Veri Paketi', description: 'Bilginin bölündüğü küçük parçalar' },
    ],
  },
};
