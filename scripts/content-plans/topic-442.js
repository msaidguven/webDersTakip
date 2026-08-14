module.exports = {
  topicId: 442,
  title: 'Algoritma Test Etme ve Geri Bildirim Alma',
  sections: [
    {
      heading: 'Algoritma Testinin Amacı',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing two output screens side by side connected by a comparison arrow: left screen displays an expected result, right screen displays an actual result, with a large green checkmark above them, bright friendly colors, with Turkish text labels reading 'Beklenen Çıktı' and 'Gerçek Çıktı' under each screen, no photorealism.",
      body_markdown: `- **Algoritma testi**: tasarlanan bir algoritmanın adımlarının doğru sonucu üretip üretmediğini kontrol etme işlemidir.
- **Beklenen çıktı**: bir girdi için algoritmanın vermesi gereken, önceden bilinen doğru sonuçtur.
- **Gerçek çıktı**: algoritmanın adımları sırayla uygulandığında ortaya çıkan sonuçtur.
- **Karşılaştırma**: test sırasında beklenen çıktı ile gerçek çıktı yan yana konularak eşleşip eşleşmediğine bakılır.
- **Test zamanı**: algoritma tamamen tasarlandıktan sonra, kullanıma sunulmadan önce test edilir.
- **Adım kontrolü**: yalnızca son sonuca değil, algoritmanın her adımının sırasıyla doğru çalıştığına da bakılır.
- **Erken tespit**: test aşamasında bulunan bir problem, kullanım sırasında karşılaşılan problemden çok daha kolay giderilir.
- **Tek deneme yetmezliği**: algoritmanın bir kez doğru sonuç vermesi, her girdide doğru çalışacağı anlamına gelmez.`,
    },
    {
      heading: 'Farklı Girdilerle Test Etme',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a checklist card with three example input value bubbles being examined by a small robot character holding a magnifying glass: an ordinary number, a zero, and a negative number, bright friendly colors, with Turkish text labels reading 'Normal Değer', 'Sıfır' and 'Negatif Değer' under each bubble, no photorealism.",
      body_markdown: `- **Test verisi**: bir algoritmayı denemek için kullanılan farklı girdi değerlerinin tümüdür.
- **Normal değer**: günlük kullanımda en sık görülen sıradan girdi türüdür, örneğin 70 puan gibi bir not.
- **Uç durum**: 0, en küçük veya en büyük olası sayı gibi, algoritmanın sınırındaki özel girdi türüdür.
- **Geçersiz girdi**: negatif bir yaş ya da harf içeren bir puan gibi, beklenmeyen hatalı girdi türüdür.
- **Çoklu deneme**: algoritma yalnızca tek bir girdiyle değil, en az birkaç farklı değerle denenmelidir.
- **Geniş kapsam**: çeşitli test verisi kullanmak, algoritmanın gözden kaçan zayıf noktalarını bulma olasılığını artırır.
- **Örnek senaryo**: yaş kontrolü yapan algoritma 10, 0 ve -5 değerleriyle denenerek sonuçlar karşılaştırılır.
- **Kayıt tutma**: her test verisi ve elde edilen sonuç, karşılaştırma yapılabilmesi için ayrı ayrı not edilir.`,
    },
    {
      heading: 'Hata Ayıklama Adımları',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a vertical list of numbered algorithm steps on a notebook page, with a magnifying glass hovering over one step highlighted in red with a small X mark while the other steps are highlighted in green with checkmarks, bright friendly colors, with Turkish text label reading 'Hata' near the red step, no photorealism.",
      body_markdown: `- **Hata ayıklama (debugging)**: bir algoritmanın hangi adımda yanlış çalıştığını bulma ve düzeltme sürecidir.
- **Adım adım izleme**: algoritmanın her adımı kağıt üzerinde sırayla takip edilerek hangi noktada sapma olduğu belirlenir.
- **Sapma noktası**: gerçek sonucun beklenen sonuçtan ayrıldığı ilk adım, hatanın kaynağının arandığı yerdir.
- **Eksik adım hatası**: algoritmada gerekli bir işlemin unutulması, sonucun yanlış veya eksik çıkmasına yol açar.
- **Yanlış sıralama hatası**: adımların doğru sırada yazılmaması, aynı işlemlerin bile farklı bir sonuç üretmesine neden olur.
- **Yanlış koşul hatası**: bir karşılaştırmanın, örneğin büyüktür yerine küçüktür yazılması, algoritmanın yanlış dala ilerlemesine sebep olur.
- **Değer takibi**: izleme sırasında her adımdaki ara sonuçların not edilmesi, hatanın hangi adımda oluştuğunu görünür kılar.`,
    },
    {
      heading: 'Düzeltme ve Yeniden Test',
      matched_outcome_codes: ['a', 'b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a circular arrow diagram with three connected stages: a wrench icon for fixing, a magnifying glass icon for testing, and a checkmark icon for success, arranged in a repeating cycle, bright friendly colors, with Turkish text labels reading 'Düzelt', 'Test Et' and 'Hazır' on each stage, no photorealism.",
      body_markdown: `- **Düzeltme**: bulunan hatalı adımın, doğru işlemi yapacak şekilde yeniden yazılmasıdır.
- **Yeniden test etme**: bir hata düzeltildikten sonra algoritma, yalnızca o adımdan değil baştan sona yeniden test edilir.
- **Yan etki kontrolü**: bir hatanın düzeltilmesi bazen başka bir adımı bozabilir; önceki test verileriyle tekrar deneme yapılır.
- **Test-düzelt döngüsü**: test etme, hata bulma ve düzeltme adımları, algoritma hatasız çalışana kadar art arda tekrarlanır.
- **Geri bildirim**: her test sonucu, algoritmanın hangi noktada geliştirilmesi gerektiğini gösteren bir bilgi kaynağıdır.
- **Durma ölçütü**: algoritma, önceden belirlenen tüm test verileriyle beklenen sonucu ürettiğinde kullanıma hazır kabul edilir.
- **Kayıt altına alma**: son test sonuçları, algoritmanın hangi girdilerle denendiği ve doğru çalıştığı bilgisiyle birlikte saklanır.`,
    },
  ],
  cover: {
    subtitle:
      'Geliştirilen bir algoritmayı farklı verilerle sınayıp hataları bularak düzeltme sürecini keşfediyoruz.',
    image_prompt:
      "A bright, friendly flat educational illustration for children showing a young student character testing a written algorithm on paper with different colored input cards, holding a magnifying glass over one step, with a small bug icon being erased and a checkmark appearing above, simple classroom-style illustration, with Turkish text labels reading 'Test Et' and 'Hatayı Bul' near the relevant parts, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🔍', title: 'Test Etme', description: 'Beklenen ile gerçek çıktıyı karşılaştırma' },
      { position: 'top-right', icon: '🧮', title: 'Test Verisi', description: 'Normal, sıfır ve uç değerlerle deneme' },
      { position: 'mid-left', icon: '🐞', title: 'Hata Ayıklama', description: 'Sapma noktasını adım adım bulma' },
      { position: 'mid-right', icon: '⚠️', title: 'Hata Türleri', description: 'Eksik adım, yanlış sıralama, yanlış koşul' },
      { position: 'bottom-left', icon: '🔧', title: 'Düzeltme', description: 'Hatalı adımı yeniden yazma' },
      { position: 'bottom-right', icon: '🔁', title: 'Yeniden Test', description: 'Hatasız sonuç alana kadar tekrar' },
    ],
  },
};
