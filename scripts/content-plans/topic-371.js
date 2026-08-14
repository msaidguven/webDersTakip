module.exports = {
  topicId: 371,
  title: 'Hücre ve Organelleri',
  sections: [
    {
      heading: 'Hücre ve Temel Organelleri',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A clear educational biology illustration for children showing a generic cell cross-section with labeled parts: cell membrane, cytoplasm, nucleus, and mitochondria, flat illustration style, with Turkish labels reading 'Hücre Zarı', 'Sitoplazma', 'Çekirdek', 'Mitokondri', no photorealism.",
      body_markdown: `- **Hücre**, canlıların yapı ve görev bakımından en küçük birimidir.
- **Hücre zarı**, hücreyi çevreleyen ve madde giriş çıkışını kontrol eden ince bir yapıdır.
- **Sitoplazma**, hücre zarının içini dolduran, organelleri içinde barındıran jel kıvamındaki maddedir.
- **Çekirdek**, hücrenin yönetim merkezidir; kalıtım bilgisini taşır.
- **Mitokondri**, hücrenin enerji üretiminden sorumlu organelidir.`,
    },
    {
      heading: 'Bitki ve Hayvan Hücresinin Benzerlikleri',
      matched_outcome_codes: ['b'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Bitki ve hayvan hücrelerinin ikisinde de **hücre zarı** bulunur.
- Her iki hücre türünde de **sitoplazma** ve **çekirdek** yer alır.
- Her iki hücrede de **mitokondri** bulunur ve enerji üretimini sağlar.
- Her iki hücre de canlılık faaliyetlerini sürdürmek için benzer temel organellere sahiptir.
- Bu ortak yapılar, hem bitkilerin hem hayvanların hücreden oluştuğunu gösterir.`,
    },
    {
      heading: 'Bitki ve Hayvan Hücresinin Farklılıkları',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "An educational side-by-side comparison illustration for children showing a plant cell with a cell wall, chloroplasts and a large vacuole, next to an animal cell without these structures, flat illustration style, with Turkish labels reading 'Bitki Hücresi' and 'Hayvan Hücresi', no photorealism.",
      body_markdown: `- Bitki hücresinde **hücre çeperi** bulunur; bu sert yapı hücreye desteklik sağlar, hayvan hücresinde yoktur.
- Bitki hücresinde **kloroplast** bulunur ve fotosentez burada gerçekleşir; hayvan hücresinde kloroplast yoktur.
- Bitki hücresinde büyük bir **koful** bulunur; hayvan hücresindeki koful daha küçüktür.
- Bitki hücreleri genellikle köşeli ve sabit şekillidir, hayvan hücreleri daha esnek ve düzensiz şekillidir.
- Bu farklılıklar, bitkilerin kendi besinini üretebilmesiyle ilişkilidir.`,
    },
    {
      heading: 'Hücreden Organizmaya: Hiyerarşik Yapı',
      matched_outcome_codes: ['ç', 'd'],
      needs_image: true,
      image_prompt:
        "An educational flat illustration for children showing a step-by-step hierarchy diagram: a single cell, then a tissue made of cells, then an organ, then a system, then a complete organism, arranged left to right with arrows, with Turkish labels reading 'Hücre', 'Doku', 'Organ', 'Sistem', 'Organizma', no photorealism.",
      body_markdown: `- Benzer görevi yapan hücreler bir araya gelerek **doku**yu oluşturur.
- Farklı dokular bir araya gelerek belirli bir görevi yapan **organı** oluşturur.
- Aynı işlevi paylaşan organlar bir araya gelerek **sistemi** oluşturur.
- Sistemler bir araya gelerek bütün bir **organizmayı** meydana getirir.
- Bu sıralama, hücre → doku → organ → sistem → organizma şeklinde basamaklı bir yapı gösterir ve canlının bütün olarak nasıl işlediğini ortaya koyar.`,
    },
  ],
  cover: {
    subtitle: 'Hücrenin yapısını, bitki-hayvan hücresi farklarını ve hücreden organizmaya uzanan basamakları inceliyoruz.',
    image_prompt:
      "A colorful educational flat illustration for children showing a plant cell and an animal cell side by side with visible organelles, and below them a small diagram showing cells combining into tissue, organ, system and organism, no photorealism, no text.",
    highlights: [
      { position: 'top-left', icon: '🔬', title: 'Hücre', description: 'Canlının en küçük birimi' },
      { position: 'top-right', icon: '🌱', title: 'Kloroplast', description: 'Sadece bitki hücresinde' },
      { position: 'mid-left', icon: '🧱', title: 'Hücre Çeperi', description: 'Bitkiye destek sağlar' },
      { position: 'mid-right', icon: '⚡', title: 'Mitokondri', description: 'Enerji üretim merkezi' },
      { position: 'bottom-right', icon: '🧬', title: 'Hiyerarşi', description: 'Hücre-doku-organ-sistem-organizma' },
    ],
  },
};
