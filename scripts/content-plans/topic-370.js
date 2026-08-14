module.exports = {
  topicId: 370,
  title: 'Sürtünme Kuvveti',
  sections: [
    {
      heading: 'Sürtünme Kuvveti Nedir?',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple educational flat illustration for children showing a wooden block being pushed across a rough surface with small zig-zag arrows at the contact point indicating resistance, bright colors, no photorealism, no text.",
      body_markdown: `- **Sürtünme kuvveti**, birbirine temas eden iki yüzey arasında harekete karşı ortaya çıkan kuvvettir.
- Bu kuvvet, hareket eden bir cismi yavaşlatır veya durdurur.
- Sürtünme, yüzeylerin pürüzlülüğünden kaynaklanır; pürüzlü yüzeylerde sürtünme daha fazladır.
- Bisiklet fren yaparken, top yerde yuvarlanırken yavaşça durduğunda sürtünme kuvveti etkilidir.
- Günlük yaşamdaki gözlemler, hareket eden her cismin bir süre sonra sürtünme nedeniyle yavaşladığını gösterir.`,
    },
    {
      heading: 'Sürtünmenin Ortamlara Göre Etkisi',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Sürtünme kuvveti, cismin bulunduğu ortama göre farklı şiddette etki eder.
- **Buz** gibi pürüzsüz yüzeylerde sürtünme azdır, cisimler kolay kayar.
- **Halı** veya **kum** gibi pürüzlü yüzeylerde sürtünme fazladır, hareket zorlaşır.
- **Su** ve **hava** içinde hareket eden cisimler de bu ortamların direnciyle karşılaşır.
- Farklı ortamlardaki gözlemler bir araya getirildiğinde, yüzey pürüzlülüğü arttıkça sürtünmenin de arttığı genellemesine ulaşılır.`,
    },
    {
      heading: 'Sürtünmeyi Azaltan ve Artıran Etkenler',
      matched_outcome_codes: [],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Sürtünmeyi azaltan** etkenler: yüzeyin cilalanması, yağ veya yağlayıcı kullanılması, tekerlek ya da bilye eklenmesi.
- **Sürtünmeyi artıran** etkenler: yüzeyin pürüzlü olması, cisme uygulanan basıncın (ağırlığın) artması.
- Araçların lastiklerindeki desenler, yolla temas yüzeyinde sürtünmeyi artırarak kaymayı önler.
- Makine parçalarına yağ sürülmesi ise sürtünmeyi azaltarak aşınmayı engeller.
- Sürtünme, bazen istenmeyen bir etkiyken (enerji kaybı) bazen de gerekli bir etkidir (yürüme, tutunma).`,
    },
    {
      heading: 'Sürtünme Deneyiyle Model Geliştirme',
      matched_outcome_codes: ['c', 'ç'],
      needs_image: true,
      image_prompt:
        "An educational science experiment illustration for children showing a wooden block being pulled with a spring scale across different surfaces: sandpaper, a smooth board, and a surface with marbles underneath, comparing friction, flat illustration style, no photorealism, no text.",
      body_markdown: `- Sürtünmeyi artıran ve azaltan durumları gözlemlemek için basit bir düzenek **model** olarak önerilebilir.
- Örneğin aynı cisim, dinamometre ile farklı yüzeyler (zımpara, cam, üzerine bilye konmuş yüzey) üzerinde çekilerek gereken kuvvet karşılaştırılır.
- İlk deneyde beklenmeyen bir sonuç çıkarsa (ör. yüzey temiz değilse) model gözden geçirilir.
- Yeni gözlemler ışığında düzenekteki yüzey türü veya cismin ağırlığı değiştirilerek model geliştirilir.
- Geliştirilen model, hangi etkenlerin sürtünmeyi arttırıp azalttığını daha net biçimde ortaya koyar.`,
    },
  ],
  cover: {
    subtitle: 'Sürtünme kuvvetinin nasıl oluştuğunu, ortamlara göre değiştiğini ve nasıl kontrol edilebildiğini keşfediyoruz.',
    image_prompt:
      "A bright educational flat illustration for children showing three side-by-side scenes: a sled sliding easily on ice, a box being pushed with difficulty on a carpet, and a toy car rolling smoothly on wheels, illustrating different friction levels, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '🧲', title: 'Sürtünme Kuvveti', description: 'Harekete karşı ortaya çıkar' },
      { position: 'top-right', icon: '🧊', title: 'Pürüzsüz Yüzey', description: 'Az sürtünme, kolay kayma' },
      { position: 'mid-left', icon: '🧶', title: 'Pürüzlü Yüzey', description: 'Fazla sürtünme, zor hareket' },
      { position: 'mid-right', icon: '🛞', title: 'Tekerlek ve Yağ', description: 'Sürtünmeyi azaltan önlemler' },
      { position: 'bottom-left', icon: '🔬', title: 'Deney Düzeneği', description: 'Yüzeyleri karşılaştıran model' },
    ],
  },
};
