module.exports = {
  topicId: 424,
  title: 'Yapay Zekâda Temel Kavram ve Özellikler',
  sections: [
    {
      heading: 'Yapay Zekâ Kavramı',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a friendly cartoon robot character with a gear and lightbulb icon above its head representing an idea, next to a small screen showing simple code symbols, bright friendly colors, with a Turkish text label reading 'Yapay Zekâ' near the robot, no photorealism.",
      body_markdown: `- **Yapay zekâ**, bilgisayarların insan gibi öğrenme, karar verme ve problem çözme becerilerini taklit etmesini sağlayan bilgisayar bilimi dalıdır.
- **Algoritma**, bir bilgisayarın bir işi adım adım nasıl yapacağını belirten kurallar dizisidir ve yapay zekânın temelini oluşturur.
- **Akıllı sistem**, çevresinden aldığı veriyi değerlendirip bu veriye uygun bir tepki üreten yazılım veya cihazdır.
- **John McCarthy**, "yapay zekâ" terimini 1956 yılında bir bilim konferansında ilk kez kullanan bilgisayar bilimcisidir.
- **Sesli asistan**, Siri ve Google Asistan gibi uygulamalar, sesli komutları anlayıp yanıt üreten yapay zekâ örnekleridir.
- **Kapsam farkı**, bazı yapay zekâ sistemleri satranç oynamak gibi tek bir görevi yaparken bazıları birden fazla alanda karar verebilir.
- **Yaygın yanılgı**, yapay zekâ insan gibi düşünen bir varlık değildir; verilen veriler üzerinden istatistiksel tahmin yapan bir yazılımdır.`,
    },
    {
      heading: 'Makine Öğrenmesi',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a three-step diagram: a folder full of small photo icons representing a data set, an arrow pointing to a robot character studying them, then an arrow pointing to a checkmark card, bright friendly colors, with Turkish text labels reading 'Veri Kümesi', 'Eğitim' and 'Test' under each stage, no photorealism.",
      body_markdown: `- **Makine öğrenmesi**, bir bilgisayar sisteminin kurala bağlı programlanmak yerine örneklerden öğrenerek gelişmesini sağlayan yapay zekâ yöntemidir.
- **Veri kümesi**, bir yapay zekâ sistemini eğitmek için kullanılan, binlerce hatta milyonlarca örnekten oluşan bilgi topluluğudur.
- **Eğitim süreci**, sisteme çok sayıda örnek gösterilerek doğru ile yanlışın ayırt edilmesinin öğretildiği aşamadır; örneğin binlerce kedi fotoğrafıyla "kedi nedir" öğretilir.
- **Etiketleme**, bir veri kümesindeki her örneğe doğru cevabın (örneğin "kedi" veya "köpek") eklenmesi işlemidir ve eğitimin doğruluğunu belirler.
- **Veri kalitesi**, eğitimde kullanılan verideki hata veya eksiklik, sistemin öğrendiği bilginin de hatalı olmasına yol açar.
- **Test aşaması**, eğitilen sistemin daha önce görmediği yeni örnekler üzerinde denenerek doğruluk oranının ölçüldüğü adımdır.
- **Sürekli gelişim**, bir yapay zekâ sistemine yeni veriler eklendikçe tahminlerinin doğruluk oranı zamanla değişebilir.`,
    },
    {
      heading: 'Yapay Zekâ Uygulamaları',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing three separate icons side by side: a chat bubble with a smiley robot face for a chatbot, a phone screen with thumbs-up recommended video thumbnails for a recommendation system, and a magnifying glass over a photo of a cat for image recognition, bright friendly colors, with Turkish text labels reading 'Sohbet Robotu', 'Öneri Sistemi' and 'Görüntü Tanıma' under each icon, no photorealism.",
      body_markdown: `- **Sohbet robotu (chatbot)**, kullanıcının yazdığı veya söylediği soruları anlayıp bunlara yazılı ya da sesli yanıt üreten yapay zekâ uygulamasıdır.
- **Doğru soru sorma**, bir sohbet robotundan yararlı bir yanıt almak için isteğin açık ve net biçimde ifade edilmesini gerektirir.
- **Öneri sistemi**, YouTube ve Netflix gibi platformlarda kullanıcının önceki izleme veya beğenilerine bakarak yeni içerik öneren yapay zekâ yöntemidir.
- **Görüntü tanıma**, bir fotoğraf veya kamera görüntüsündeki nesneleri, yüzleri ya da yazıları tanıyıp sınıflandıran yapay zekâ becerisidir; telefon yüz kilidi buna örnektir.
- **Ses tanıma**, konuşulan sözcükleri metne çeviren veya bir sözlü komutu anlayan yapay zekâ yöntemidir; sesli arama bu teknolojiyi kullanır.
- **Örnek uygulama**, market uygulamalarındaki "bunu da beğenebilirsiniz" önerileri, kullanıcının geçmiş alışverişlerini analiz eden bir öneri sisteminin ürünüdür.`,
    },
    {
      heading: 'Yapay Zekânın Sınırlılıkları',
      matched_outcome_codes: ['ç'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a cartoon robot with a speech bubble containing a mislabeled photo of a cat and a warning triangle icon above it, next to a child character comparing it with a book showing a correct checkmark, bright friendly colors, with a Turkish text label reading 'Yanlış Bilgi' near the warning icon, no photorealism.",
      body_markdown: `- **Halüsinasyon**, bir yapay zekâ sisteminin var olmayan bir bilgiyi gerçekmiş gibi, kendinden emin bir dille üretmesi durumudur.
- **Kaynak kontrolü**, bir yapay zekâ yanıtının doğru olup olmadığını anlamak için bilginin güvenilir bir kaynakla karşılaştırılması gerekir.
- **Veri yanlılığı (bias)**, eğitim verisi belirli bir grubu eksik içeriyorsa sistem taraflı ya da hatalı sonuçlar üretebilir.
- **Güncellik sorunu**, bazı yapay zekâ sistemleri belirli bir tarihe kadarki verilerle eğitildiği için yakın olayları bilemeyebilir.
- **Aşırı güven riski**, bir yapay zekâ yanıtının kendinden emin bir üslupla verilmiş olması, o yanıtın doğru olduğu anlamına gelmez.
- **Çapraz doğrulama**, bir bilginin doğruluğunu değerlendirmek için aynı konunun birden fazla güvenilir kaynakta aranması önerilir.
- **Sorumluluk**, yapay zekâ araçlarının ürettiği bir içerik kullanılmadan önce bir yetişkin tarafından kontrol edilmelidir.`,
    },
    {
      heading: 'Yapay Zekânın Günlük Etkileri',
      matched_outcome_codes: ['d'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a collage of three everyday scenes: a car dashboard with a glowing navigation map, a doctor looking at a chest scan image on a screen, and a tablet showing a friendly learning app icon, bright friendly colors, simple classroom-style illustration, no photorealism.",
      body_markdown: `- **Zaman tasarrufu**, navigasyon uygulamalarındaki yapay zekâ, trafik verisini anlık analiz ederek en kısa güzergâhı önerir ve yolculuk süresini kısaltır.
- **Sağlık alanı**, yapay zekâ destekli sistemler röntgen ve tomografi görüntülerini inceleyerek hekimlerin hastalık belirtilerini daha hızlı fark etmesine yardımcı olur.
- **Eğitim alanı**, bazı öğrenme uygulamaları öğrencinin yaptığı hatalara göre kendisine özel alıştırmalar oluşturarak kişiselleştirilmiş öğrenme sunar.
- **İş gücü etkisi**, fabrikada ürün sayma gibi tekrarlayan işler yapay zekâ destekli makinelerle otomatikleştirilebilir.
- **Gizlilik riski**, bir yapay zekâ sistemi konum ve arama geçmişi gibi kişisel verileri işlediği için bu verilerin kimlerle paylaşıldığı önemlidir.
- **Enerji tüketimi**, büyük yapay zekâ sistemlerinin eğitilmesi yoğun bilgisayar gücü gerektirir ve çok miktarda elektrik harcatır.
- **Olası gelecek**, uzmanlar yapay zekânın önümüzdeki yıllarda daha fazla mesleği ve günlük alışkanlığı etkileyebileceğini öngörmektedir.`,
    },
  ],
  cover: {
    subtitle:
      'Yapay zekânın ne olduğunu, nasıl öğrendiğini ve günlük hayatımızı nasıl etkilediğini keşfediyoruz.',
    image_prompt:
      "A bright, friendly flat educational illustration for children showing a large friendly cartoon robot character on one side reading a big open book, with a magnifying glass hovering over floating icons of a chat bubble, a camera, and a speaker representing a chatbot, image recognition and voice recognition, simple classroom-style illustration, with a Turkish text label reading 'Yapay Zekâ' near the robot, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🤖', title: 'Yapay Zekâ', description: "Terim ilk kez 1956'da kullanıldı" },
      { position: 'top-right', icon: '📊', title: 'Veri Kümesi', description: 'Milyonlarca örnekle sistem eğitilir' },
      { position: 'mid-left', icon: '💬', title: 'Sohbet Robotu', description: 'Yazılı soruları anlayıp yanıtlar' },
      { position: 'mid-right', icon: '🎯', title: 'Öneri Sistemi', description: 'Netflix, YouTube gibi platformlarda kullanılır' },
      { position: 'bottom-left', icon: '⚠️', title: 'Halüsinasyon', description: 'Yanlış bilgiyi gerçek gibi sunar' },
      { position: 'bottom-right', icon: '🌍', title: 'Günlük Etki', description: 'Sağlık, ulaşım, eğitimde kullanılır' },
    ],
  },
};
