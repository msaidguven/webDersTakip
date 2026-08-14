module.exports = {
  topicId: 444,
  title: 'Blok Tabanlı Ortamda Yazılım Geliştirme',
  sections: [
    {
      heading: 'Blok Tabanlı Yazılım Geliştirmede Planlama',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a student's notebook with a short handwritten step-by-step plan and simple sprite sketches, placed next to a computer screen showing an empty block-based programming workspace, bright friendly colors, with Turkish text labels reading 'Planım' on the notebook page, no photorealism.",
      body_markdown: `- **Hedef belirleme**: yazılımın tamamlandığında ne yapacağı tek ve net bir cümleyle tanımlanır, örneğin bir karakterin ekranda dört yöne hareket etmesi.
- **Senaryo yazma**: bloklara dokunmadan önce, programın adım adım ne yapacağı kâğıda veya not defterine sırayla yazılır.
- **Sahne listesi**: hikâyede kullanılacak sahne/arka plan görsellerinin ismi ve sayısı önceden belirlenir.
- **Karakter listesi**: kullanılacak her karakterin hangi görevi üstleneceği tek tek not edilir, örneğin bir kedi karakterinin zıplaması.
- **Olay planı**: programın hangi tetikleyiciyle başlayacağı, yeşil bayrağa tıklanınca ya da bir tuşa basılınca gibi, plan aşamasında kararlaştırılır.
- **Zaman tasarrufu**: önceden çıkarılan plan, blok tabanlı ortamda dene-yanıl ile geçen süreyi azaltır.
- **Değişebilirlik**: plan, blokları birleştirirken ortaya çıkan yeni fikirlere göre güncellenebilir, katı bir kurala bağlı değildir.`,
    },
    {
      heading: 'Sahne ve Karakter Tasarımı',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a block-based programming environment's sprite library panel with several cartoon character icons (a cat, a car, a ball) and a costume editor showing two walking poses of one character, plus a backdrop gallery thumbnail, bright friendly colors, with Turkish text labels reading 'Karakterler' and 'Kostümler' above the panels, no photorealism.",
      body_markdown: `- **Karakter (sprite)**: blok tabanlı ortamda hareket ettirilen her nesnenin adıdır, hazır kütüphaneden kedi, araba ya da top gibi seçenekler seçilebilir.
- **Kostüm**: bir karakterin farklı görünüm/duruş hâlleridir, kostümler sırayla değiştirilerek yürüme ya da zıplama izlenimi oluşturulur.
- **Sahne (arka plan)**: karakterlerin üzerinde hareket ettiği zemin görselidir, hazır kütüphaneden seçilebilir veya boyama aracıyla çizilebilir.
- **Boyut ve konum**: her karakterin ekrandaki büyüklüğü ve başlangıç yeri tasarım aşamasında ayarlanır.
- **Çoklu karakter**: bir proje birden fazla karakteri aynı sahnede barındırabilir, her biri kendi blok grubuyla çalışır.
- **Özel yükleme**: hazır kütüphane dışında bilgisayardan resim yükleyerek özgün bir karakter veya sahne oluşturulabilir.
- **Ad verme**: her karakter ve sahneye anlaşılır bir isim verilir; çok sayıda öğeyle çalışırken karışıklık önlenir.`,
    },
    {
      heading: 'Olay ve Hareket Blokları',
      matched_outcome_codes: ['b', 'c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a vertical chain of colorful puzzle-shaped code blocks connected top to bottom: a yellow event block on top, a blue motion block below it, and a purple sound block at the bottom, with a hand cursor dragging one block into place, bright friendly colors, with Turkish text labels reading 'Başlat', 'Hareket Et' and 'Ses Çal' on the blocks, no photorealism.",
      body_markdown: `- **Olay bloğu**: bir programın ne zaman çalışmaya başlayacağını belirler, "yeşil bayrağa tıklanınca" en sık kullanılan başlangıç bloğudur.
- **Tuş bloğu**: "boşluk tuşuna basılınca" gibi bloklar, klavyeden gelen bir tuşu programın başlangıç noktası yapar.
- **Hareket bloğu**: bir karakteri belirli adım sayısı kadar ileri götürür veya belirli derece döndürür, örneğin "10 adım git".
- **Sürükle-bırak birleştirme**: bloklar fare ile sürüklenip birbirinin altına yapıştırılarak sıralı bir komut zinciri oluşturulur.
- **Blok uyumu**: yalnızca aynı renk grubundaki bloklar birbirine anlamlı şekilde bağlanır; olay bloğu her zaman zincirin en üstünde yer alır.
- **Görünüm bloğu**: karakterin konuşma balonu göstermesini ya da boyutunun değişmesini sağlayan bloklardır.
- **Ses bloğu**: bir karakterin belirli bir sesi çalmasını veya bir notayı seslendirmesini sağlar.
- **Sıra önemi**: blokların dizilim sırası değiştiğinde programın çalışma sonucu da değişir.`,
    },
    {
      heading: 'Döngü ve Koşul Blokları ile Program Oluşturma',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing two distinct puzzle-shaped code blocks side by side: a C-shaped orange repeat/loop block wrapped around two smaller blocks, and a C-shaped yellow if-then block with a diamond-shaped condition slot, bright friendly colors, with Turkish text labels reading 'Tekrarla' on the loop block and 'Eğer...ise' on the condition block, no photorealism.",
      body_markdown: `- **Döngü bloğu**: içine yerleştirilen komutları belirtilen sayıda ya da sürekli olarak tekrar çalıştırır, örneğin "10 kere tekrarla".
- **Sonsuz döngü**: "sürekli tekrarla" bloğu, program durdurulana kadar içindeki komutları aralıksız çalıştırır.
- **Koşul bloğu**: "eğer... ise" yapısı, belirli bir durum doğru olduğunda içindeki komutları çalıştırır.
- **Koşul-değilse**: "eğer... ise, değilse" yapısı, durum yanlış olduğunda farklı bir komut grubunun çalışmasını sağlar.
- **İç içe blok**: bir döngü bloğunun içine koşul bloğu, ya da koşulun içine döngü yerleştirilebilir.
- **Değişken bloğu**: bir sayıyı veya bilgiyi saklamak ve program çalışırken değerini güncellemek için kullanılır.
- **Kod bloğu grubu (script)**: birbirine bağlı blokların oluşturduğu bütüne script denir, bir karakterin birden fazla scripti olabilir.`,
    },
    {
      heading: 'Programı Çalıştırma ve Değerlendirme',
      matched_outcome_codes: ['ç'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a split screen: left side shows a child's sketched plan of a character moving right, right side shows the same character on a computer screen moving in the wrong direction with a red question mark, and a hand adjusting a code block, bright friendly colors, with Turkish text labels reading 'Planlanan' and 'Gerçekleşen', no photorealism.",
      body_markdown: `- **Çalıştırma**: yeşil bayrak simgesine tıklanarak program başlatılır ve bloklardaki komutlar sırasıyla yürütülür.
- **Gözlem**: sahnedeki karakterin hareketi, planlanan senaryodaki adımlarla karşılaştırılarak izlenir.
- **Beklenmeyen sonuç**: karakter yanlış yöne gittiğinde ya da hiç hareket etmediğinde, ilgili blok grubunun sırası veya değeri kontrol edilir.
- **Durdurma**: kırmızı durdur simgesi, sonsuz döngü gibi devam eden bir programı anında sonlandırır.
- **Blok değiştirme**: hatalı sonuç veren blok çıkarılıp yerine doğru değer veya blok yerleştirilerek düzeltme yapılır.
- **Tekrar test etme**: her değişiklikten sonra program yeniden çalıştırılarak sonucun düzelip düzelmediği kontrol edilir.
- **Paylaşma**: tamamlanan proje kaydedilip başka kullanıcıların incelemesi veya denemesi için paylaşılabilir.`,
    },
  ],
  cover: {
    subtitle:
      'Bir fikri planlayıp blok tabanlı ortamda sürükle-bırak komutlarla çalışan bir programa dönüştürmeyi öğreniyoruz.',
    image_prompt:
      "A bright, friendly flat educational illustration for children showing a split screen: on the left, colorful puzzle-shaped code blocks stacking together in a vertical script (a green flag event block on top, followed by a motion block and a repeat loop block); on the right, a cartoon cat character moving across a simple stage background following the blocks' instructions, simple classroom-style illustration, with Turkish text labels reading 'Başlat', 'Hareket Et' and 'Tekrarla' on the blocks, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🧩', title: 'Blok Birleştirme', description: 'Sürükle-bırak ile komut zinciri oluşturma' },
      { position: 'top-right', icon: '🚩', title: 'Olay Bloğu', description: 'Yeşil bayrakla programı başlatma' },
      { position: 'mid-left', icon: '🔁', title: 'Döngü Bloğu', description: 'Komutları belirli sayıda tekrarlama' },
      { position: 'mid-right', icon: '❓', title: 'Koşul Bloğu', description: 'Eğer-ise yapısıyla karar verme' },
      { position: 'bottom-left', icon: '🎭', title: 'Sahne ve Karakter', description: 'Kostüm ve arka plan tasarımı' },
      { position: 'bottom-right', icon: '🐞', title: 'Hata Ayıklama', description: 'Yanlış bloğu bulup düzeltme' },
    ],
  },
};
