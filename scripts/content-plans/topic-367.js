module.exports = {
  topicId: 367,
  title: "Dünya'mız ve Gökyüzündeki Komşularımız",
  sections: [
    {
      heading: 'Büyüklük Karşılaştırması',
      matched_outcome_codes: [],
      needs_image: true,
      image_prompt:
        "An educational flat illustration for children comparing the sizes of the Sun, Earth and Moon as three circles of very different sizes side by side, the Sun much larger, Earth medium, Moon smallest, simple space background, with Turkish labels reading 'Güneş', 'Dünya', 'Ay' under each circle, no photorealism.",
      body_markdown: `- Güneş, Dünya ve Ay büyüklük bakımından birbirinden oldukça farklıdır.
- **Güneş**, üçü arasında en büyük gök cismidir; çapı Dünya'nın çapından yaklaşık 100 kat büyüktür.
- **Dünya**, Güneş'ten çok küçük olmasına rağmen Ay'dan büyüktür.
- **Ay**, üçü arasında en küçük olanıdır; çapı Dünya'nın çapının yaklaşık dörtte biri kadardır.
- Bu büyüklük farkları, model oluştururken cisimlerin gerçek oranlarına uygun ölçek seçilmesini gerektirir.`,
    },
    {
      heading: 'Aradaki Uzaklıklar',
      matched_outcome_codes: [],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Dünya ile Güneş arasındaki uzaklık, Dünya ile Ay arasındaki uzaklıktan çok daha fazladır.
- Dünya-Güneş arası uzaklık yaklaşık 150 milyon kilometredir.
- Dünya-Ay arası uzaklık ise yaklaşık 384 bin kilometredir.
- Bu büyük uzaklık farkı, gökyüzünde Güneş ve Ay'ın benzer büyüklükte görünmesine rağmen gerçekte çok farklı boyutlarda olmasının nedenidir.
- Model çalışmalarında hem büyüklük hem uzaklık oranlarının aynı anda gösterilmesi oldukça zordur.`,
    },
    {
      heading: "Dünya'nın Hareketleri",
      matched_outcome_codes: [],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Dünya, kendi ekseni etrafında **dönme hareketi** yapar; bu hareket yaklaşık 24 saat sürer ve gece-gündüz oluşumunu sağlar.
- Dünya, aynı zamanda Güneş çevresinde **dolanma hareketi** yapar; bu hareket yaklaşık 365 gün sürer ve bir yılı oluşturur.
- Ay ise hem kendi ekseni etrafında döner hem de Dünya çevresinde dolanır.
- Üç gök cismi de birbirine göre sürekli hareket hâlindedir.
- Bu hareketlerin yönü ve süresi, gökyüzü gözlemlerinde belirli düzenlerin (gece-gündüz, ay evreleri, yıl) ortaya çıkmasını sağlar.`,
    },
    {
      heading: "Güneş-Dünya-Ay Modeli",
      matched_outcome_codes: ['a', 'b'],
      needs_image: true,
      image_prompt:
        "A classroom science model illustration for children showing a large yellow ball representing the Sun, a medium blue-green ball representing Earth, and a small gray ball representing the Moon, arranged with orbit lines showing their relative movement, flat illustration style, with Turkish labels reading 'Güneş', 'Dünya', 'Ay', no photorealism.",
      body_markdown: `- Güneş, Dünya ve Ay'ın birbirine göre hareketini ve büyüklüğünü göstermek için basit araç gereçlerle (farklı boyutta toplar, ipler vb.) bir **model** önerilebilir.
- Model kurulurken cisimlerin büyüklük oranı ve hareket yönleri (dönme, dolanma) dikkate alınır.
- İlk model genellikle tüm oranları tam olarak yansıtamaz.
- Yeni gözlem ve kanıtlar elde edildikçe model gözden geçirilir; ölçek, uzaklık ya da hareket yönü gibi eksik kalan noktalar düzeltilerek model geliştirilir.
- Geliştirilmiş model, üç gök cisminin gerçek düzenini daha doğru biçimde temsil eder.`,
    },
  ],
  cover: {
    subtitle: 'Güneş, Dünya ve Ay’ın büyüklüklerini, uzaklıklarını ve hareketlerini bir model üzerinde karşılaştırıyoruz.',
    image_prompt:
      "An educational flat illustration for children showing the Sun, Earth and Moon in a simple orbital diagram with curved arrows showing Earth orbiting the Sun and the Moon orbiting Earth, sizes drawn proportionally different, space background with stars, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '☀️', title: 'En Büyük: Güneş', description: 'Dünya\'dan 100 kat büyük' },
      { position: 'top-right', icon: '📏', title: '150 Milyon km', description: 'Dünya-Güneş uzaklığı' },
      { position: 'mid-left', icon: '🌍', title: "Dönme ve Dolanma", description: 'Gece-gündüz ve yıl oluşumu' },
      { position: 'mid-right', icon: '🌙', title: '384 Bin km', description: 'Dünya-Ay uzaklığı' },
      { position: 'bottom-left', icon: '🧩', title: 'Model Kurma', description: 'Oranlara uygun ölçek seçimi' },
    ],
  },
};
