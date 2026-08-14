module.exports = {
  topicId: 286,
  title: 'Tasarlanan Bir Ürünün Yatırım ve Pazarlama Süreci',
  sections: [
    {
      heading: 'Bir Ürün Fikrinden Girişime',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        'A simple, colorful flat illustration for children showing a young student presenting a small recycled-material pencil case product idea with a lightbulb icon above their head, and a small chart representing investment and marketing nearby. Educational illustration style, bright colors, no text.',
      body_markdown: `- **Girişimci**, yeni bir ürün veya hizmet fikri geliştirip bunu hayata geçiren kişidir.
- Örneğin geri dönüştürülmüş malzemeden kalemlik tasarlayan bir öğrenci de küçük ölçekte bir girişimcidir.
- **Yatırım**, bir ürünü hayata geçirmek için gereken para, malzeme ve emeğin ayrılmasıdır.
- **Pazarlama**, bu ürünün tanıtılıp doğru müşteriye ulaştırılması sürecidir.
- İyi bir ürün fikri bile, ancak doğru yatırım ve pazarlama planıyla gerçek bir başarıya dönüşebilir.`,
    },
    {
      heading: 'Riskleri Görüp Karar Vermek',
      matched_outcome_codes: ['b', 'c'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Risk**, bir projenin beklenmedik şekilde zarara uğramasına yol açabilecek her türlü durumdur.
- Kalemlik örneğinde olası riskler: malzeme maliyetinin artması, yeterli talep olmaması veya benzer ürünlerin çokluğudur.
- Gözlem ve küçük anketlerle, ürüne ne kadar ilgi olacağı konusunda tahmin yürütülebilir.
- Riskler değerlendirildikten sonra, en uygun yatırım ve pazarlama yolu gerekçeleriyle birlikte seçilir.
- Riskleri önceden düşünmek, olası kayıpları en aza indirmeye yardımcı olur.`,
    },
    {
      heading: 'Sınırlı Kaynakları Doğru Kullanmak',
      matched_outcome_codes: ['ç'],
      needs_image: true,
      image_prompt:
        'A simple, colorful flat illustration for children showing icons representing resource management: a clock (time), a coin stack (budget), and recycled craft materials, balanced on a scale. Educational illustration style, bright colors, no text.',
      body_markdown: `- Bir projeyi hayata geçirmek için **bütçe**, **zaman** ve **malzeme** gibi kaynaklar dikkatle yönetilmelidir.
- Kaynaklar sınırlı olduğu için, önce en gerekli olan ihtiyaçlara öncelik verilmelidir.
- Bütçe planlaması, harcamaların elde edilecek gelirle dengeli olmasını sağlar.
- Zamanın iyi yönetilmesi, ürünün belirlenen sürede tamamlanıp pazara sunulmasına yardımcı olur.
- Kaynak yönetimi başarısız olursa, iyi bir fikir bile hayata geçirilemeden kalabilir.`,
    },
    {
      heading: 'Fikri Bir Rapora Dönüştürmek',
      matched_outcome_codes: ['d'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- **Proje öneri raporu**, bir ürünün yatırım ve pazarlama planını özetleyen yazılı bir belgedir.
- Rapor; ürünün tanıtımını, hedef kitlesini, tahmini maliyetini ve pazarlama yöntemini içermelidir.
- İyi bir rapor, olası riskleri ve bunlara karşı alınacak önlemleri de açıkça belirtir.
- Rapor, fikri öğretmenlere, ailelere veya olası destekçilere anlatmak için önemli bir araçtır.
- Açık ve düzenli hazırlanan bir proje raporu, fikrin ciddiye alınma ihtimalini artırır.`,
    },
  ],
  cover: {
    subtitle: 'Geri dönüşümlü bir kalemlik fikri üzerinden, yatırım, pazarlama, risk değerlendirme ve proje raporu hazırlama sürecini anlatıyor.',
    image_prompt:
      'A warm, colorful flat illustration for children showing a young entrepreneur at a small desk with a recycled-material product prototype, a chart, a clock, and a report document, symbolizing the investment and marketing planning process. Educational illustration style, no photorealism, no text.',
    highlights: [
      { position: 'top-left', icon: '💡', title: 'Ürün Fikri', description: 'Girişimciliğin ilk adımı' },
      { position: 'top-right', icon: '📈', title: 'Yatırım ve Pazarlama', description: 'Fikri hayata geçirme' },
      { position: 'mid-left', icon: '⚠️', title: 'Riskleri Değerlendir', description: 'Olası zararları öngör' },
      { position: 'mid-right', icon: '🗂️', title: 'Kaynakları Yönet', description: 'Bütçe, zaman, malzeme' },
      { position: 'bottom-left', icon: '📄', title: 'Proje Raporu', description: 'Planı yazılı hâle getir' },
    ],
  },
};
