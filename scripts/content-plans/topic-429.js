module.exports = {
  topicId: 429,
  title: 'Görsel Ürün Geliştirme',
  sections: [
    {
      heading: 'Temel Görsel Öğeleri Ekleme',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a computer screen with a digital art program open: an empty canvas on the left being filled with basic shapes (a house, a sun, a simple character outline) and a small toolbar with shape and import icons on the side, bright and friendly colors, no photorealism, with a Turkish text label reading 'Tuval' near the canvas area.",
      body_markdown: `- **Tuval (canvas)**, görselin oluşturulacağı çalışma alanıdır; boyutu genellikle piksel cinsinden (ör. 1080x1080) belirlenir.
- Kurgudaki hikâyeye uygun bir **arka plan** seçilir; hazır bir şablon kullanılabilir ya da tek renk zemin oluşturulabilir.
- **Şekil araçları** (dikdörtgen, daire, çizgi) ile sahnenin temel bileşenleri, örneğin bina veya karakter taslağı çizilir.
- Hazır fotoğraflar ya da çizimler **içe aktar (import)** komutuyla tuvale eklenir ve fare ile boyutlandırılır.
- Eklenen her öğe, hikâyedeki olay sırasına göre konumlandırılır; ön planda olması gereken öğe genellikle daha büyük tutulur.
- **Hizalama** araçları, öğelerin tuval üzerinde dengeli ve düzenli yerleşmesini sağlar.
- Çalışma sık aralıklarla **kaydedilmelidir**; program kapanırsa kaydedilmeyen değişiklikler kaybolur.`,
    },
    {
      heading: 'Katman ve Efekt Kullanımı',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A flat educational illustration for children showing a layers panel of a design program: several stacked transparent sheets each holding a different element (background, character, text), with small eye icons next to each layer and an opacity slider, plus a before/after example of a filter effect (colorful vs grayscale) applied to a small picture, no photorealism, with a Turkish text label reading 'Katmanlar'.",
      body_markdown: `- **Katman (layer)**, görselin farklı öğelerinin birbirinden bağımsız ayrı düzlemlerde tutulmasını sağlar.
- Arka plan, karakter ve metin genellikle ayrı katmanlara yerleştirilir; böylece bir öğe diğerini bozmadan taşınabilir veya silinebilir.
- Katman panelindeki **göz simgesi**, o katmanın görünür olup olmadığını kapatıp açmaya yarar.
- **Saydamlık (opaklık/opacity)** ayarı, bir katmanın arkasındaki katmanın ne kadar göründüğünü yüzde olarak belirler.
- **Filtreler** (bulanıklaştırma, gri tonlama, parlaklık-kontrast gibi) görselin tamamına veya seçili bir katmana uygulanabilir.
- Katmanların sırası değiştirilerek hangi öğenin önde, hangisinin arkada görüneceği belirlenir.
- Efekt uygulandıktan sonra **geri al (undo)** komutu, istenmeyen sonucu düzeltmek için kullanılabilir.`,
    },
    {
      heading: 'Metin ve Etiket Ekleme',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A flat educational illustration for children showing a poster-style visual with a text box tool actively adding a title and a small speech-bubble label onto a scene, a small side panel showing font, size and color options, no photorealism, with a Turkish text example reading 'Orman Macerası' inside the text box on the canvas.",
      body_markdown: `- **Metin aracı**, tuval üzerine yazı kutusu açarak başlık, konuşma balonu veya etiket eklemeyi sağlar.
- Yazı tipi (**font**), punto (boyut) ve renk, metnin okunabilirliğine göre ayrı ayrı ayarlanır.
- Hikâyedeki karakter adı, tarih veya açıklama gibi bilgiler kısa etiketler hâlinde görsele eklenir.
- Metin, arka planla zıt renkte seçilirse okunabilirliği artar; benzer renkler metni görselin içinde kaybettirebilir.
- **Konumlandırma**, metnin ilgili öğenin (karakter, nesne) yakınına, görseli kapatmayacak şekilde yerleştirilmesini kapsar.
- Uzun cümleler yerine kısa ve net ifadeler kullanılması, 5. sınıf düzeyinde önerilen bir uygulamadır.
- Metin katmanı da diğer katmanlar gibi ayrı tutulursa, sonradan içerik değiştirilmek istendiğinde yeniden yazmaya gerek kalmaz.`,
    },
    {
      heading: 'Görseli Dışa Aktarma',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A flat educational illustration for children showing an export dialog window of a design program with file format icons (PNG and JPG) and a resolution number field, a small preview thumbnail of the finished picture next to it, no photorealism, with Turkish text labels reading 'Dışa Aktar' and 'Çözünürlük'.",
      body_markdown: `- Tasarım tamamlandığında **dışa aktar (export)** komutuyla çalışma, program dosyasından bağımsız bir görsel dosyasına dönüştürülür.
- En yaygın kullanılan dosya biçimleri **PNG** ve **JPG (JPEG)**'dir.
- **PNG**, saydam (transparan) arka planı destekler; katmanlar arasında boşluk bırakılan alanlar şeffaf kalır.
- **JPG**, saydamlığı desteklemez ancak dosya boyutu genellikle daha küçüktür, bu yüzden paylaşım için sık tercih edilir.
- Dışa aktarma penceresinde **çözünürlük (resolution)** seçeneği, görselin ekranda mı yoksa baskıda mı kullanılacağına göre ayarlanır.
- Dosya adı verilirken Türkçe karakter ve boşluk kullanmaktan kaçınılması, dosyanın farklı programlarda sorunsuz açılmasını kolaylaştırır.
- Kaydedilen dosya, açılıp kontrol edilerek renklerin ve öğelerin doğru göründüğünden emin olunur.`,
    },
    {
      heading: 'Değerlendirme Ölçütleri',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A flat educational illustration for children showing a checklist card with checkmark boxes next to a small finished picture, each checklist row paired with a simple icon (a storybook for story-match, an eye for readability, a grid for layout, a paint palette for color), no photorealism, with Turkish text labels reading 'Kurguya Uygunluk', 'Okunabilirlik' and 'Düzen' next to the checklist rows.",
      body_markdown: `- Oluşturulan görsel, önceden belirlenen **ölçütler (kriterler)** listesiyle karşılaştırılarak değerlendirilir.
- İlk ölçüt görselin **kurguya uygunluğudur**: hikâyedeki karakter, mekân ve olay öğelerinin tümünün görselde yer alıp almadığı kontrol edilir.
- İkinci ölçüt **okunabilirliktir**: eklenen metinlerin ve şekillerin net görünüp görünmediği incelenir.
- Üçüncü ölçüt **düzendir (kompozisyon)**: öğelerin tuval üzerinde dengeli dağılıp dağılmadığı, boş veya aşırı kalabalık alan olup olmadığı gözden geçirilir.
- Renk uyumu da bir ölçüt olarak değerlendirilir; birbirine çok yakın veya göz yorucu renk kullanımı eksiklik sayılır.
- Değerlendirme sonucunda eksik bulunan bir öğe varsa, ilgili katmana geri dönülerek düzeltme yapılır.
- **Akran değerlendirmesi**, yani sınıf arkadaşının görüşünü alma, ölçütlerin dışarıdan bir gözle kontrol edilmesine yardımcı olur.`,
    },
  ],
  cover: {
    subtitle: 'Kurguya uygun bir görseli katman, filtre ve metin araçlarıyla oluşturup ölçütlere göre değerlendiriyoruz.',
    image_prompt:
      "A bright flat educational illustration for children showing a computer or tablet screen with a design program open: a half-finished colorful scene on the canvas, a layers panel and a text tool visible on the side, a small hand cursor placing a shape, cheerful and simple classroom style, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '🖌️', title: 'Temel Öğeler', description: 'Şekil ve görsel ekleme' },
      { position: 'top-right', icon: '🗂️', title: 'Katmanlar', description: 'Öğeleri ayrı düzlemde tutma' },
      { position: 'mid-left', icon: '🔤', title: 'Metin Ekleme', description: 'Başlık ve etiket yazma' },
      { position: 'mid-right', icon: '📤', title: 'Dışa Aktarma', description: 'PNG veya JPG formatı' },
      { position: 'bottom-left', icon: '✅', title: 'Değerlendirme', description: 'Ölçütlerle karşılaştırma' },
    ],
  },
};
