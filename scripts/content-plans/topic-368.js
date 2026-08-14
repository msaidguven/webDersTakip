module.exports = {
  topicId: 368,
  title: 'Kuvvet ve Kuvvetin Ölçülmesi',
  sections: [
    {
      heading: 'Kuvvet Nedir?',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple educational flat illustration for children showing two scenes side by side: a child pushing a box and a child pulling a wagon with a rope, illustrating push and pull forces, bright colors, no photorealism, no text.",
      body_markdown: `- **Kuvvet**, bir cismi itme veya çekme etkisidir.
- Kuvvet, duran bir cismi hareket ettirebilir, hareket eden bir cismi durdurabilir veya yönünü değiştirebilir.
- Kuvvet, bir cismin şeklini de değiştirebilir (ör. hamurun sıkılması, yayın gerilmesi).
- Kuvvet uygulamak için cisme temas etmek gerekebilir (itme, çekme) ya da uzaktan etki eden kuvvetler de vardır (ör. mıknatıs kuvveti).
- Günlük hayatta kapı açmak, top tekmelemek, çekmece çekmek gibi birçok eylem kuvvet uygulamayı içerir.`,
    },
    {
      heading: 'Dinamometre ile Ölçüm',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "An educational flat illustration for children showing a spring scale (dynamometer) with a hook at the bottom holding a small weight, a numbered scale visible on the tube, simple classroom laboratory tool illustration, with a Turkish label reading 'Dinamometre', no photorealism.",
      body_markdown: `- **Dinamometre**, kuvvetin büyüklüğünü ölçmeye yarayan bir araçtır.
- İçindeki yayın, uygulanan kuvvetle orantılı olarak uzamasından yararlanılarak ölçüm yapılır.
- Ölçülecek cisim, dinamometrenin kancasına asılır ve yayın uzama miktarı üzerindeki ölçekten okunur.
- Kuvvet arttıkça yay daha fazla uzar, ölçekteki değer büyür.
- Dinamometre, hem çekme hem de itme kuvvetlerinin büyüklüğünü belirlemek için kullanılabilir.`,
    },
    {
      heading: 'Newton (N) Birimi',
      matched_outcome_codes: ['c'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Kuvvetin büyüklüğü **Newton (N)** birimiyle ifade edilir.
- Bu birim, kuvvet ve hareket yasalarını ortaya koyan bilim insanı **Isaac Newton**'ın adından gelir.
- Dinamometre üzerindeki ölçek genellikle Newton cinsinden derecelendirilmiştir.
- Bir cisme uygulanan kuvvet ne kadar büyükse, ölçülen Newton değeri de o kadar büyük olur.
- Kuvvetin birimini bilmek, farklı ölçümlerin karşılaştırılabilmesi için gereklidir.`,
    },
    {
      heading: 'Dinamometre Modeli Tasarlama',
      matched_outcome_codes: ['ç', 'd'],
      needs_image: true,
      image_prompt:
        "A children's science project illustration showing a homemade spring scale model made from a spring, a rubber band or elastic, a small hook, a ruler, and a plastic cup or tube, craft-style flat illustration, no photorealism, no text.",
      body_markdown: `- Basit araç gereçlerle (yay, lastik bant, cetvel, kanca gibi) bir **dinamometre modeli** tasarlanabilir.
- Modelde, esnek malzemenin (yay veya lastik) kuvvet uygulandığında uzaması ölçüm ilkesi olarak kullanılır.
- Modele bilinen ağırlıklar asılarak bir ölçek çizgisi oluşturulur.
- İlk model doğru ölçüm yapmayabilir; ölçüm sonuçları gerçek değerlerle karşılaştırılır.
- Karşılaştırma sonucunda elde edilen yeni kanıtlara göre modelin ölçeği veya malzemesi değiştirilerek daha doğru ölçüm yapması sağlanır.`,
    },
  ],
  cover: {
    subtitle: 'Kuvvetin ne olduğunu, dinamometreyle nasıl ölçüldüğünü ve Newton biriminin anlamını öğreniyoruz.',
    image_prompt:
      "A bright educational flat illustration for children showing a hand pulling a spring scale (dynamometer) with a weight hanging from the hook, the numbered scale clearly visible, simple science classroom style, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '👐', title: 'İtme ve Çekme', description: 'Kuvvetin iki temel etkisi' },
      { position: 'top-right', icon: '⚖️', title: 'Dinamometre', description: 'Kuvveti ölçen araç' },
      { position: 'mid-left', icon: '🔢', title: 'Newton (N)', description: 'Kuvvetin ölçü birimi' },
      { position: 'mid-right', icon: '🔧', title: 'Model Tasarımı', description: 'Yayla ölçüm düzeneği kurma' },
    ],
  },
};
