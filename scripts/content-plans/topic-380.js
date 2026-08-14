module.exports = {
  topicId: 380,
  title: 'Devre Elemanlarının Sembollerle Gösterimi ve Devre Şemaları',
  sections: [
    {
      heading: 'Devre Elemanları ve Sembolleri',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "An educational classroom chart illustration for children showing simple circuit symbols: a battery symbol, a light bulb symbol, a switch symbol, and a straight line for a wire, each drawn clearly and labeled, flat illustration style, with Turkish labels reading 'Pil', 'Ampul', 'Anahtar', 'Tel', no photorealism.",
      body_markdown: `- Elektrik devrelerindeki her eleman, devre şemalarında belirli bir **sembol** ile gösterilir.
- **Pil**, uzun ve kısa çizgilerden oluşan bir sembolle gösterilir; enerji kaynağını temsil eder.
- **Ampul**, içinde çarpı işareti bulunan bir çember sembolüyle gösterilir.
- **Anahtar (switch)**, devreyi açıp kapatan elemandır ve eğik bir çizgiyle gösterilir.
- **İletken tel**, elemanları birbirine bağlayan düz çizgilerle gösterilir.`,
    },
    {
      heading: 'Sembollerin Sınıflandırılması',
      matched_outcome_codes: ['b', 'c', 'ç'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Devre sembolleri, temsil ettikleri elemanın görevine göre gruplara ayrıştırılabilir.
- **Enerji kaynağı** sembolleri: pil ve pil grubu.
- **Tüketici** sembolleri: ampul gibi elektrik enerjisini ışığa veya harekete dönüştüren elemanlar.
- **Kontrol elemanı** sembolleri: anahtar gibi devreden geçen akımı açıp kapatan elemanlar.
- **Bağlantı elemanı** sembolleri: iletken teller ve bağlantı noktaları; bu gruplandırma her sembolün doğru şekilde etiketlenmesini kolaylaştırır.`,
    },
    {
      heading: 'Devre Şeması Çizimi',
      matched_outcome_codes: [],
      needs_image: true,
      image_prompt:
        "A simple educational circuit diagram for children showing a battery, a switch and a light bulb connected in a single loop using standard circuit symbols and straight connecting lines, flat illustration style, no photorealism, no text.",
      body_markdown: `- **Devre şeması**, gerçek bir elektrik devresinin sembollerle çizilmiş hâlidir.
- Şema çizilirken her eleman kendi sembolüyle gösterilir ve teller düz çizgilerle birleştirilir.
- Elemanlar, gerçek devrede olduğu gibi kapalı bir döngü oluşturacak şekilde bağlanır.
- Devre şemasında pilin yönü, ampulün ve anahtarın devredeki konumu doğru gösterilmelidir.
- Doğru çizilmiş bir şema, devrenin gerçekte nasıl kurulacağını göstermeye yeter; devreyi kurmadan önce plan yapmayı sağlar.`,
    },
    {
      heading: 'Devre Kurma ve Veri Analizi',
      matched_outcome_codes: ['d', 'e'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Çizilen bir devre şemasına uygun olarak pil, ampul, anahtar ve tellerden oluşan gerçek bir **deney düzeneği** kurulabilir.
- Düzenek kurulurken şemadaki bağlantı sırası ve eleman sayısı birebir uygulanır.
- Anahtar açılıp kapatıldığında ampulün yanıp sönmesi gözlemlenerek devrenin doğru çalışıp çalışmadığı kontrol edilir.
- Farklı denemelerde elde edilen gözlemler (ampulün yanma durumu, parlaklığı gibi) karşılaştırılarak analiz edilir.
- Bu analiz, devre şemasıyla gerçek devre arasındaki uyumu değerlendirmek için kullanılır.`,
    },
  ],
  cover: {
    subtitle: 'Elektrik devresindeki pil, ampul ve anahtarı sembolleriyle tanıyor, kendi devre şemamızı çiziyoruz.',
    image_prompt:
      "A clean educational flat illustration for children showing a hand drawing a simple circuit diagram with a battery, switch and light bulb symbols connected by lines on a notebook page, classroom style, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '🔋', title: 'Pil Sembolü', description: 'Enerji kaynağını gösterir' },
      { position: 'top-right', icon: '💡', title: 'Ampul Sembolü', description: 'Çarpılı çember şeklinde' },
      { position: 'mid-left', icon: '🔘', title: 'Anahtar Sembolü', description: 'Devreyi açar, kapatır' },
      { position: 'mid-right', icon: '📐', title: 'Devre Şeması', description: 'Elemanların sembollerle çizimi' },
    ],
  },
};
