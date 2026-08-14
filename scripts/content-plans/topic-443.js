module.exports = {
  topicId: 443,
  title: 'Yazılımda Kullanılan Bileşenler',
  sections: [
    {
      heading: 'Olay Blokları',
      matched_outcome_codes: ['a', 'b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a yellow hat-shaped block with a rounded top sitting at the very top of a stack of colorful puzzle-shaped command blocks in a block-based coding interface, a small green flag icon and a keyboard key icon nearby to represent two different triggers, bright friendly colors, with a Turkish text label reading 'Olay Bloğu' near the yellow block, no photorealism.",
      body_markdown: `- **Olay bloğu**: bir programın hangi tetikleyiciyle çalışmaya başlayacağını belirleyen, kanca şekilli bir komut bloğudur.
- **Renk kodu**: blok tabanlı ortamda olay blokları sarı renkle gösterilir, bu da onları hareket veya ses bloklarından ayırt etmeyi kolaylaştırır.
- **Şekil farkı**: olay bloklarının üst kenarı yuvarlak çıkıntılıdır, bu şekil onların bir komut zincirinin başlangıcı olduğunu gösterir.
- **Çoklu tetikleyici**: aynı karaktere bağlı, farklı tuşlara veya farklı dokunma anlarına tepki veren birden fazla olay bloğu eklenebilir.
- **Bağımsız çalışma**: her olay bloğu kendi altındaki komutları, diğer olay bloklarından bağımsız ve aynı anda çalıştırabilir.
- **Eksik olay hatası**: bir komut zincirinin en üstünde olay bloğu yoksa, program çalıştırıldığında o bloklar hiç tetiklenmez.
- **Test ile kontrol**: eklenen bir olay bloğunun doğru tetikleyiciyi taşıyıp taşımadığı, ilgili tuşa basılarak veya tıklanarak sınanır.`,
    },
    {
      heading: 'Komut Blokları',
      matched_outcome_codes: ['a', 'b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a color-coded block palette on one side (blue motion blocks, purple looks blocks, pink sound blocks) and several matching puzzle-shaped blocks snapping together vertically on the other side to form a command chain, bright friendly colors, with a Turkish text label reading 'Komut Blokları' above the connected chain, no photorealism.",
      body_markdown: `- **Komut bloğu**: bir nesneye tek bir eylemi yaptıran, programın en küçük çalışan parçasıdır.
- **Kategori örnekleri**: hareket, görünüm ve ses komutları en sık kullanılan komut bloğu türleridir.
- **Blok paleti**: komut blokları, ait oldukları kategoriye göre renklendirilerek ekranın kenarındaki blok listesinde gruplanır.
- **Bağlantı şekli**: komut blokları yap-boz parçaları gibi birbirinin altına geçirilerek zincir oluşturur.
- **Parametre girişi**: "10 adım hareket et" bloğundaki 10 sayısı değiştirilerek hareketin miktarı ayarlanabilir.
- **Tek görev kuralı**: her komut bloğu yalnızca bir işi yapar, birden fazla işlem için birden fazla blok art arda eklenir.
- **Hata kaynağı**: yanlış sırayla dizilen komut bloğu, beklenen sonucun tam tersini üretebilir; örneğin dönme komutu hareket komutundan önce gelirse karakter yanlış yöne ilerler.`,
    },
    {
      heading: 'Döngü Blokları',
      matched_outcome_codes: ['a', 'b', 'c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a large C-shaped orange loop block wrapping around two smaller command blocks inside it, with a curved circular arrow and the number 10 next to it to show the repeat count, bright friendly colors, with a Turkish text label reading '10 Kere Tekrarla' on the loop block, no photorealism.",
      body_markdown: `- **Döngü bloğu**: C şeklinde bir gövdeye sahip olan ve içine yerleştirilen komutları tekrar tekrar çalıştıran kontrol bloğudur.
- **Sabit tekrar**: "10 kere tekrarla" gibi bir döngü, içindeki komutları tam olarak belirtilen sayı kadar çalıştırıp sonra durur.
- **Sürekli tekrar**: "sürekli tekrarla" bloğu, kırmızı durdur düğmesine basılana kadar içindeki komutları aralıksız yineler.
- **İç içe yerleştirme**: bir döngünün içine birden fazla komut bloğu konabilir, bu komutlar her turda tekrar çalışır.
- **Kod kısaltma**: aynı komut 5 kez tek tek yazmak yerine, döngü içine bir kez yazılıp tekrar sayısı 5 olarak ayarlanır.
- **Sonsuz döngü hatası**: tekrar sayısı yanlışlıkla "sürekli" bırakıldığında program hiç durmaz, bu durum çalıştırılıp fark edilmelidir.
- **Tekrar sayısı kontrolü**: bir döngü kullanıldıktan sonra, istenen hareketin tam istenen sayıda gerçekleşip gerçekleşmediği program çalıştırılarak denetlenir.`,
    },
    {
      heading: 'Koşul Yapıları',
      matched_outcome_codes: ['a', 'b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a C-shaped yellow condition block with a diamond/hexagon-shaped slot containing a greater-than comparison symbol, splitting into two paths marked with a green checkmark and a red X, bright friendly colors, with Turkish text labels reading 'Eğer' and 'Değilse' on the two branches, no photorealism.",
      body_markdown: `- **Koşul bloğu**: içine bir karşılaştırma ifadesi yerleştirilen, baklava dilimi şeklindeki boşluğuyla tanınan karar bloğudur.
- **Eğer-ise yapısı**: koşul doğru (true) çıktığında blok içindeki komutlar çalışır, yanlış (false) çıktığında hiçbir şey yapılmaz.
- **Eğer-ise-değilse yapısı**: koşul yanlış çıktığında devreye giren ikinci bir komut grubunun da eklenmesine izin verir.
- **Karşılaştırma işaretleri**: büyüktür, küçüktür ve eşittir işaretleri koşulun baklava dilimi boşluğuna yerleştirilerek sayılar karşılaştırılır.
- **Örnek koşul**: "eğer puan 10'dan büyükse mesaj göster" bloğu, puan değişkeni 10'u geçtiği anda devreye girer.
- **İç içe koşul**: bir koşul bloğunun içine başka bir koşul bloğu yerleştirilerek birden fazla durum aynı anda denetlenebilir.
- **Yaygın hata**: karşılaştırma işareti yanlış seçildiğinde (örneğin küçüktür yerine büyüktür), program beklenenin tam tersi bir sonuç üretir.`,
    },
    {
      heading: 'Değişkenler',
      matched_outcome_codes: ['a', 'b', 'c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a labeled storage box with a number card being placed inside it to represent a variable holding a value, next to a small on-screen monitor readout displaying the same number, bright friendly colors, with a Turkish text label reading 'Değişken: Puan' on the box and the number on the monitor, no photorealism.",
      body_markdown: `- **Değişken**: bir programın çalışması sırasında değişebilen bir bilgiyi (sayı, metin) saklayan adlandırılmış bir bellek kutusudur.
- **İsimlendirme**: her değişkene "puan" veya "can" gibi ne sakladığını belirten anlaşılır bir ad verilir.
- **Başlangıç değeri**: bir değişken oluşturulduğunda genellikle 0 gibi bir başlangıç değeriyle ayarlanır, program ilerledikçe bu değer değişir.
- **Değer değiştirme**: "değişkeni 1 artır" bloğu ile bir değişkenin sayısı her çalıştırıldığında bir artırılabilir, örneğin puan sayacında kullanılır.
- **Görüntüleme**: bir değişkenin yanındaki kutu işaretlenirse, o değişkenin o anki değeri ekranda küçük bir kutu içinde canlı olarak izlenebilir.
- **Veri tipi**: bir değişken sayı (5, 10) veya metin ("merhaba" gibi) değeri tutabilir, tipine göre üzerinde yapılabilecek işlemler değişir.
- **Değer kontrolü**: bir değişkenin beklenen anda beklenen değeri tutup tutmadığı, ekrandaki gösterge izlenerek değerlendirilir.`,
    },
  ],
  cover: {
    subtitle:
      'Blok tabanlı programlamada bir yazılımı oluşturan olay, komut, döngü, koşul ve değişken gibi temel bileşenleri tanıyoruz.',
    image_prompt:
      "A bright, friendly flat educational illustration for children showing a colorful block-based coding workspace with five distinct puzzle-piece blocks arranged together: a yellow event block, a blue command block, an orange loop block, a purple condition block, and a red variable block, connected in a simple stack, simple classroom-style illustration, with Turkish text labels reading 'Olay', 'Komut', 'Döngü', 'Koşul' and 'Değişken' on each block, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🟡', title: 'Olay Bloğu', description: 'Programı başlatan tetikleyici (yeşil bayrak)' },
      { position: 'top-right', icon: '🧩', title: 'Komut Bloğu', description: 'Karaktere tek bir eylem yaptırır' },
      { position: 'mid-left', icon: '🔁', title: 'Döngü Bloğu', description: 'Komutları belirtilen sayıda tekrar eder' },
      { position: 'mid-right', icon: '❓', title: 'Koşul Bloğu', description: 'Eğer-ise ile karar verdirir' },
      { position: 'bottom-left', icon: '📦', title: 'Değişken', description: 'Değeri saklayan adlandırılmış bellek kutusu' },
      { position: 'bottom-right', icon: '🔍', title: 'Bileşen Değerlendirme', description: 'Çalıştırıp doğru çalıştığını kontrol etme' },
    ],
  },
};
