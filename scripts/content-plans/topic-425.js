module.exports = {
  topicId: 425,
  title: 'Bilgisayar Sistemlerinin Kullanımı',
  sections: [
    {
      heading: 'Donanım ve Yazılım',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children split into two halves: left side shows physical computer hardware pieces (keyboard, mouse, monitor, computer case) glowing to represent hardware, right side shows abstract software elements like app icons and a screen with code symbols to represent software, bright friendly colors, with Turkish text labels reading 'Donanım' on the left side and 'Yazılım' on the right side, no photorealism.",
      body_markdown: `- **Donanım**, bilgisayarın elle tutulup gözle görülebilen fiziksel parçalarının tümüdür.
- **Yazılım**, donanıma hangi işlemi ne zaman yapacağını söyleyen, ekranda doğrudan görünmeyen komut dizileridir.
- Klavye, fare, ekran ve kasa donanıma; işletim sistemi, bir oyun ya da hesap makinesi uygulaması yazılıma örnektir.
- Donanım tek başına hiçbir işlem yapamaz, çalışması için mutlaka bir yazılım tarafından yönlendirilmesi gerekir.
- Aynı donanıma farklı yazılımlar kurularak bilgisayar farklı işler için kullanılabilir, örneğin aynı bilgisayarda hem resim programı hem müzik programı çalışabilir.
- Bir yazılım hata verdiğinde genellikle yeniden kurularak düzeltilebilir, ancak donanım bozulduğunda parçanın fiziksel olarak değiştirilmesi gerekir.
- Mağazada "işlemci hızı" veya "ekran boyutu" konuşuluyorsa donanımdan, "hangi programlar yüklü" konuşuluyorsa yazılımdan söz edilmektedir.`,
    },
    {
      heading: 'İşlemci ve Bellek',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a computer motherboard with two highlighted chips: a square processor chip and a memory stick, friendly cartoon style, with Turkish text labels reading 'İşlemci' and 'RAM' pointing to each chip, no photorealism.",
      body_markdown: `- **İşlemci**, bilgisayarın tüm hesaplamaları ve komutları yürüten, sıkça "beyin" olarak tanımlanan parçasıdır.
- İşlemci, saniyede milyarlarca basit işlemi art arda gerçekleştirerek programların çalışmasını sağlar.
- **RAM**, bilgisayar açıkken kullanılan programların ve verilerin geçici olarak tutulduğu bellek birimidir.
- RAM'deki bilgiler bilgisayar kapatıldığında silinir, bu yüzden kalıcı saklama için ayrı bir depolama birimine ihtiyaç duyulur.
- Aynı anda çok fazla program açıldığında RAM yetersiz kalabilir, bu durumda bilgisayar yavaşlar veya donar.
- İşlemci bir hesaplama yaparken kullanacağı verileri RAM'den hızlıca okur ve ürettiği sonucu yine RAM'e yazar.
- Günümüz bilgisayarlarında RAM kapasitesi genellikle gigabayt (GB) birimiyle ifade edilir, örneğin 4 GB veya 8 GB gibi.`,
    },
    {
      heading: 'Giriş ve Çıkış Birimleri',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a computer setup with arrows: a keyboard, mouse and microphone with arrows pointing into a computer to represent input, and a monitor, printer and speaker with arrows pointing out of the computer to represent output, bright friendly colors, with Turkish text labels reading 'Giriş' and 'Çıkış', no photorealism.",
      body_markdown: `- **Giriş birimleri**, kullanıcının bilgisayara bilgi veya komut girmesini sağlayan donanım parçalarıdır.
- Klavye, fare, mikrofon ve tarayıcı en sık kullanılan giriş birimlerine örnektir.
- **Çıkış birimleri**, bilgisayarın işlediği bilgiyi kullanıcıya sunan donanım parçalarıdır.
- Ekran, yazıcı ve hoparlör en yaygın çıkış birimleri arasında sayılır.
- Bazı donanımlar hem giriş hem çıkış görevi görebilir; dokunmatik ekran parmak dokunuşunu algılar ve aynı zamanda görüntü gösterir.
- Yazıcı, ekrandaki bir belgeyi kâğıda aktararak dijital bilgiyi fiziksel bir çıktıya dönüştürür.
- Giriş birimi olmadan bilgisayara hiçbir komut verilemez, çıkış birimi olmadan da işlenen sonuç görülemez.`,
    },
    {
      heading: 'Depolama Birimleri',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing three storage devices side by side: an internal hard disk, a small SSD chip, and a USB flash drive, each drawn in friendly cartoon style, with Turkish text labels reading 'Sabit Disk', 'SSD' and 'USB Bellek' under each device, no photorealism.",
      body_markdown: `- **Depolama birimleri**, dosya ve programların bilgisayar kapatıldıktan sonra da kalıcı olarak saklandığı donanım parçalarıdır.
- Sabit disk ve SSD, bilgisayarın içine yerleştirilen başlıca depolama birimleridir.
- **SSD**, hareketli parçası olmadığı için sabit diske göre çok daha hızlı ve sessiz çalışır.
- USB bellek ve hafıza kartı gibi taşınabilir depolama birimleri, dosyaların bir bilgisayardan diğerine kolayca aktarılmasını sağlar.
- Depolama kapasitesi gigabayt (GB) veya terabayt (TB) gibi birimlerle ölçülür; 1 TB, 1000 GB'a eşittir.
- Bir dosya kaydedildiğinde RAM'den depolama birimine aktarılır, böylece bilgisayar kapansa bile dosya kaybolmaz.
- Depolama alanı dolduğunda yeni dosya kaydedilemez, bu durumda eski dosyaların silinmesi gerekir.`,
    },
    {
      heading: 'Bilgi İşlem Döngüsü',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a circular flow diagram with four connected stages arranged in a cycle: a keyboard icon, an arrow to a processor chip icon, an arrow to a monitor icon, and an arrow to a storage disk icon, bright friendly colors, with Turkish text labels reading 'Giriş', 'İşlem', 'Çıkış' and 'Depolama' on each stage, no photorealism.",
      body_markdown: `- Bir bilgisayar sistemi çalışırken bileşenler belirli bir sırayla birbirine bağlı olarak görev yapar: **giriş, işlem, çıkış ve depolama**.
- Önce giriş birimi, örneğin klavye, kullanıcının komutunu veya verisini bilgisayara aktarır.
- İşlemci, gelen veriyi RAM'in yardımıyla işleyerek bir sonuç üretir.
- Üretilen sonuç, çıkış birimi aracılığıyla, örneğin ekran üzerinden, kullanıcıya gösterilir.
- İstenirse sonuç, depolama birimine kalıcı olarak kaydedilerek daha sonra tekrar kullanılabilir hale getirilir.
- Bileşenlerden biri eksik veya arızalı olduğunda sistemin tamamı düzgün çalışamaz; örneğin ekran bozulursa işlemci çalışsa bile sonuç görülemez.
- Bir yazı yazma uygulamasında klavyeden girilen harfler işlenir, ekranda görüntülenir ve kaydet komutuyla depolama birimine yazılır.`,
    },
  ],
  cover: {
    subtitle:
      'Bilgisayarı oluşturan donanım ve yazılım parçalarını, bunların birbiriyle nasıl çalıştığını keşfediyoruz.',
    image_prompt:
      "A bright, friendly flat educational illustration for children showing an open desktop computer case with visible labeled parts, plus a keyboard, mouse and monitor placed around it, simple classroom-style illustration, with Turkish text labels reading 'İşlemci', 'Bellek' and 'Depolama' pointing to the relevant parts, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🖥️', title: 'Donanım', description: 'Elle tutulan fiziksel parçalar' },
      { position: 'top-right', icon: '💾', title: 'Yazılım', description: 'Görünmeyen komut ve programlar' },
      { position: 'mid-left', icon: '🧠', title: 'İşlemci', description: 'Saniyede milyarlarca işlem yapar' },
      { position: 'mid-right', icon: '⚡', title: 'RAM', description: 'Kapanınca silinen geçici bellek' },
      { position: 'bottom-left', icon: '📀', title: 'Depolama', description: 'HDD, SSD ve USB bellek' },
      { position: 'bottom-right', icon: '🔄', title: 'İşlem Döngüsü', description: 'Giriş, işlem, çıkış, depolama sırası' },
    ],
  },
};
