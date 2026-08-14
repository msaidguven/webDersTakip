module.exports = {
  topicId: 288,
  title: 'Telif ve Patent Süreci',
  sections: [
    {
      heading: 'Emeğin Karşılığı: Telif Hakkı',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        'A simple, colorful flat illustration for children showing a painting on an easel and a music note, each with a small copyright symbol (©), representing protected creative works. Educational illustration style, bright colors, no text.',
      body_markdown: `- **Telif hakkı**, bir eseri (kitap, müzik, resim, yazılım vb.) üreten kişinin o eser üzerindeki haklarını korur.
- Örneğin bir ressamın çizdiği tabloyu izinsiz kopyalayıp satmak, telif hakkının açık bir ihlalidir.
- Telif hakkı sayesinde yazarlar, müzisyenler ve sanatçılar emeklerinin karşılığını alabilir.
- Türkiye'de telif hakları, **Fikir ve Sanat Eserleri Kanunu** ile güvence altına alınır.
- Bir eseri kaynak göstermeden veya izinsiz kullanmak, hem etik hem de yasal bir sorundur.`,
    },
    {
      heading: 'Bir Buluşu Koruyan Belge: Patent',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        'A simple, colorful flat illustration for children showing a young inventor presenting a simple new gadget invention next to a certificate document with an official stamp, representing a patent. Educational illustration style, bright colors, no text.',
      body_markdown: `- **Patent**, yeni bir buluş veya icadın sahibine belirli bir süre için kullanım hakkı tanıyan resmî belgedir.
- Patent almak isteyen kişi, buluşunun daha önce hiç yapılmamış, yeni bir şey olduğunu kanıtlamalıdır.
- **Türk Patent ve Marka Kurumu**, Türkiye'de patent başvurularını değerlendiren resmî kurumdur.
- Örneğin bir öğrencinin tasarladığı pratik bir alet, patent alınarak koruma altına alınabilir.
- Patentli bir ürünü izinsiz üretmek veya satmak, patent hakkının ihlali anlamına gelir.`,
    },
    {
      heading: 'Bu Hakları Neden Korumalıyız?',
      matched_outcome_codes: ['c'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Telif ve patent hakları, insanları yeni fikirler üretmeye teşvik eder.
- Bu haklar sayesinde emek verilen fikir ve eserler korunur; taklit ve haksız kullanım önlenir.
- Bu korumalar olmasaydı, kimse yeni bir şey icat etmek veya yaratmak için zaman harcamak istemeyebilirdi.
- Telif ve patent hakları, hem bireyin emeğini hem de toplumun yeniliğe olan güvenini korur.
- Bu nedenle bu haklara saygı göstermek, herkesin ortak sorumluluğudur.`,
    },
    {
      heading: 'Güvenilir Bilgiye Nasıl Ulaşılır?',
      matched_outcome_codes: ['ç'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- Telif ve patent süreçleriyle ilgili araştırma yaparken resmî kurum siteleri gibi **güvenilir kaynaklar** tercih edilmelidir.
- Toplanan bilgilerin doğruluğu, birden fazla kaynakla karşılaştırılarak kontrol edilmelidir.
- Doğrulanan bilgileri düzenli şekilde not almak, ileride tekrar başvurmayı ve paylaşmayı kolaylaştırır.
- Güvenilir olmayan bir kaynaktan alınan yanlış bilgi, bir başvuru sürecinde ciddi sorunlara yol açabilir.
- Kaynağın resmî bir kurum ya da uzman bir kişi olması, bilginin güvenilirliğine dair önemli bir ipucudur.`,
    },
  ],
  cover: {
    subtitle: "Bir ressamın tablosundan bir öğrencinin buluşuna, telif hakkı ve patent sürecini güvenilir araştırma yollarıyla anlatıyor.",
    image_prompt:
      'A warm, colorful flat illustration for children showing a young inventor holding a lightbulb-shaped idea with a small copyright symbol and a patent certificate nearby, symbolizing protected ideas and inventions. Educational illustration style, no photorealism, no text.',
    highlights: [
      { position: 'top-left', icon: '©️', title: 'Telif Hakkı', description: 'Eserleri koruyan hak' },
      { position: 'top-right', icon: '🔧', title: 'Patent', description: 'Buluşları koruyan belge' },
      { position: 'mid-left', icon: '🏛️', title: 'Türk Patent Kurumu', description: 'Başvuruları değerlendirir' },
      { position: 'mid-right', icon: '🔍', title: 'Güvenilir Kaynak', description: 'Resmî kurum sitelerini kullan' },
    ],
  },
};
