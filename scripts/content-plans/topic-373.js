module.exports = {
  topicId: 373,
  title: "Işığın Yayılması",
  sections: [
    {
      heading: 'Işık Kaynakları',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple educational flat illustration for children showing natural light sources like the Sun and a candle flame on one side, and artificial light sources like a light bulb and a flashlight on the other side, bright colors, no photorealism, with Turkish labels reading 'Doğal Kaynak' and 'Yapay Kaynak'.",
      body_markdown: `- **Işık kaynağı**, kendisi ışık üreten her cisimdir.
- **Doğal ışık kaynakları**na örnek olarak Güneş, yıldızlar ve ateş verilebilir.
- **Yapay ışık kaynakları**na örnek olarak ampul, mum ve el feneri verilebilir.
- Ay, kendi ışığını üretmediği için ışık kaynağı değildir; Güneş ışığını yansıtır.
- Bir kaynaktan çıkan ışığın izlediği yol gözlemlenerek onun düz mü yoksa eğri mi ilerlediği belirlenebilir.`,
    },
    {
      heading: 'Işığın Doğrusal Yayılması',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "An educational classroom experiment illustration for children showing a flashlight shining through three cards each with a small hole, all holes aligned in a straight line, with a straight light beam passing through them, flat illustration style, no photorealism, no text.",
      body_markdown: `- Delikli kartlarla yapılan bir deneyde, ışık kaynağı ile göz arasına konan kartlardaki delikler aynı hizaya getirildiğinde ışık gözlemlenebilir.
- Delikler farklı hizaya getirildiğinde ışık gözlemlenemez.
- Bu gözlem, ışığın **düz bir çizgi (doğru)** boyunca ilerlediğini gösterir.
- Işığın izlediği bu düz yola **ışın** denir.
- Deney sonuçları çizim veya not olarak kaydedilerek ışığın yayılma yolu hakkında kanıt oluşturulur.`,
    },
    {
      heading: 'Işığın Her Yönde Doğrusal Yayılması',
      matched_outcome_codes: ['c'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Işık, bir kaynaktan çıktığında yalnızca tek bir yönde değil, **her yönde doğrusal** bir yol izleyerek yayılır.
- Güneş ışığının bulutlar arasından huzmeler hâlinde düz çizgiler şeklinde görünmesi bu duruma bir örnektir.
- Lazer ışığının düz bir çizgi hâlinde ilerlemesi de ışığın doğrusal yayıldığının bir kanıtıdır.
- Işığın önüne opak bir cisim konduğunda gölge oluşması, ışığın o noktadan sonra ilerleyemediğini ve düz yol izlediğini gösterir.
- Bu özellik, ışığın engellerin arkasına dolanamamasının temel nedenidir.`,
    },
  ],
  cover: {
    subtitle: 'Işık kaynaklarını tanıyor, ışığın her yönde düz bir çizgi hâlinde nasıl yayıldığını gözlemliyoruz.',
    image_prompt:
      "A bright educational flat illustration for children showing a flashlight in a dark room with clearly visible straight light rays spreading outward in multiple directions, illustrating the straight-line propagation of light, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '☀️', title: 'Doğal Kaynak', description: 'Güneş, ateş, yıldızlar' },
      { position: 'top-right', icon: '💡', title: 'Yapay Kaynak', description: 'Ampul, mum, fener' },
      { position: 'mid-left', icon: '📏', title: 'Işın', description: 'Işığın izlediği düz yol' },
      { position: 'mid-right', icon: '🕳️', title: 'Delikli Kart Deneyi', description: 'Doğrusal yayılmayı kanıtlar' },
    ],
  },
};
