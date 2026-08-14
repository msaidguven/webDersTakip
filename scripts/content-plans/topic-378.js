module.exports = {
  topicId: 378,
  title: 'Maddenin Hâl Değişimi',
  sections: [
    {
      heading: 'Erime ve Donma',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "An educational flat illustration for children showing an ice cube melting into water with a small flame icon nearby indicating heat, and next to it water freezing into ice with a snowflake icon indicating cold, arrows showing the two-way process, no photorealism, with Turkish labels reading 'Erime' and 'Donma'.",
      body_markdown: `- **Erime**, bir katı maddenin ısı alarak sıvı hâle geçmesidir.
- **Donma**, bir sıvı maddenin ısı vererek katı hâle geçmesidir.
- Buzun ısıtıldığında suya dönüşmesi erimeye, suyun dondurucuda katılaşması donmaya örnektir.
- Her madde belirli bir sıcaklıkta erir veya donar; bu sıcaklığa **erime/donma noktası** denir.
- Günlük deneyimlerden yola çıkarak "ısı verilen katı madde erir" gibi bir önerme oluşturulabilir; bu önerme deneyle sınanır.`,
    },
    {
      heading: 'Buharlaşma ve Yoğuşma',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Buharlaşma**, bir sıvının ısı alarak gaz hâline geçmesidir.
- **Yoğuşma**, bir gazın ısı vererek sıvı hâline geçmesidir.
- Islak zeminin güneş altında kuruması buharlaşmaya, soğuk bir bardağın dış yüzeyinde su damlacıkları oluşması yoğuşmaya örnektir.
- Buharlaşma her sıcaklıkta yavaşça gerçekleşebilirken, **kaynama** belirli bir sıcaklıkta hızlı buharlaşmadır.
- Gözleme dayalı bu bilgiler ile "sıvılar ısıtılınca her zaman hemen kaynar" gibi gözleme dayanmayan bir önerme karşılaştırıldığında, ikincisinin doğru olmadığı görülür.`,
    },
    {
      heading: 'Süblimleşme',
      matched_outcome_codes: ['c'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Süblimleşme**, bir katı maddenin sıvı hâle geçmeden doğrudan gaz hâline geçmesidir.
- Naftalinin zamanla küçülüp havaya karışması süblimleşmeye bir örnektir.
- Kuru buzun (katı karbondioksit) oda sıcaklığında sıvılaşmadan buharlaşması da süblimleşme ile açıklanır.
- Bu gözlemlerden yola çıkılarak "bazı katılar ısı alınca sıvı aşamasından geçmeden gaza dönüşebilir" sonucuna varılır.
- Süblimleşme, hâl değişimlerinin her zaman aynı sırayla (katı-sıvı-gaz) gerçekleşmeyebileceğini gösteren bir kanıttır.`,
    },
    {
      heading: 'Isı ile Hâl Değişimi Arasındaki İlişki',
      matched_outcome_codes: ['ç', 'd'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Bir maddenin hangi ısı miktarında hâl değiştireceği, önceki gözlemlerden yararlanılarak tahmin edilebilir.
- Örneğin bir maddenin ısıtıldığında eriyeceği, önceki erime gözlemlerine dayanılarak öngörülebilir.
- Bu tahminlerin geçerliği, gerçek deneyle test edilerek sorgulanır.
- Tahmin ile deney sonucu uyuşmuyorsa, tahminin dayandığı varsayımlar yeniden gözden geçirilir.
- Isı verilmesi maddeyi katıdan sıvıya, sıvıdan gaza; ısı alınması ise gazdan sıvıya, sıvıdan katıya doğru değiştirir.`,
    },
  ],
  cover: {
    subtitle: 'Erime, donma, buharlaşma, yoğuşma ve süblimleşmeyle maddenin ısı etkisiyle nasıl hâl değiştirdiğini inceliyoruz.',
    image_prompt:
      "An educational flat illustration for children showing a cycle diagram with ice, water and water vapor connected by arrows labeled with heat gain and heat loss, simple science diagram style, with Turkish labels reading 'Katı', 'Sıvı', 'Gaz', no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🧊', title: 'Erime', description: 'Katıdan sıvıya, ısı alarak' },
      { position: 'top-right', icon: '❄️', title: 'Donma', description: 'Sıvıdan katıya, ısı vererek' },
      { position: 'mid-left', icon: '💨', title: 'Buharlaşma', description: 'Sıvıdan gaza, ısı alarak' },
      { position: 'mid-right', icon: '💧', title: 'Yoğuşma', description: 'Gazdan sıvıya, ısı vererek' },
      { position: 'bottom-left', icon: '🌫️', title: 'Süblimleşme', description: 'Katıdan doğrudan gaza' },
    ],
  },
};
