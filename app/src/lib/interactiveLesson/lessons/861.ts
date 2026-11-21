// 7. Sınıf Fen Bilimleri · Sindirim Sistemi (Konu #861)
// Yeni Nesil v3 Etkileşimli Ders: Tek-Bilgi Anlatım + Canlı Sindirim Sahnesi + Bölüm İçi Çok Turlu Kavram Avı.
// Supabase yayındaki 4 kitap bölümüne (topic_content_sections: 1455, 1456, 1457, 1458),
// tüm kazanımlara, uyarılara, etkinlik örneklerine, anahtar kavramlara ve aktif havuz sorularına %100 sadıktır.
import type { LessonDefinitionV3 } from '../typesV3';

export const lesson861: LessonDefinitionV3 = {
  version: 3,
  topicId: 861,
  courseLabel: '7. Sınıf Fen Bilimleri',
  sceneId: 'digestive-system',
  guide: {
    intro: 'Merhaba! Ben Atom. Sindirim Sisteminin tüm bilgilerini tek tek canlı sahnelerle öğrenecek, her bölüm sonunda Kavram Avı ve sorularla pekiştireceğiz.',
    finish: 'Tebrikler! Sindirim Sisteminin tüm organlarını, yardımcı salgılarını, kritik kurallarını ve sağlıklı yaşam ilkelerini eksiksiz tamamladın!',
  },
  sections: [
    // =========================================================================
    // BÖLÜM 1 — Section 1455: Sindirim Kavramı ve Sindirim Çeşitleri
    // =========================================================================
    {
      sectionId: 1455,
      tabLabel: '1. Sindirim Çeşitleri',
      title: 'Sindirim Kavramı ve Sindirim Çeşitleri',
      accent: 'sky',
      beats: [
        {
          id: 's1-sindirim',
          kicker: 'Sindirim Kavramı',
          title: 'Sindirim Nedir?',
          fact: 'Canlılar yaşamlarını sürdürmek ve büyümek için besinlerden enerji alır. Ağız yoluyla alınan besinlerin kana geçebilecek kadar küçük parçalara ayrılmasına sindirim denir.',
          focus: 'overview-digestion',
        },
        {
          id: 's1-fiziksel',
          kicker: 'Sindirim Çeşitleri',
          title: 'Fiziksel (Mekanik) Sindirim',
          fact: 'Besinlerin çiğneme, kas hareketleri ve çeşitli özel sıvılarla kimyasal yapısı bozulmadan küçük parçalara ayrılmasına fiziksel sindirim denir.',
          focus: 'physical-chewing',
          quickCheck: {
            prompt: 'Dişlerimizle ekmeği çiğneyerek küçük parçalara ayırmak hangi sindirim çeşididir?',
            options: ['Fiziksel (Mekanik) Sindirim', 'Kimyasal Sindirim'],
            answer: 0,
            okFeedback: 'Doğru! Dişlerle çiğneme besinin kimyasal yapısını değiştirmeden onu fiziksel olarak küçültür.',
            retryFeedback: 'Tekrar düşün: Çiğneme sırasında besinin kimyasal yapısı değişmez, yalnızca boyutu küçülür.',
          },
        },
        {
          id: 's1-yuzey',
          kicker: 'Fiziksel Sindirimin Amacı',
          title: 'Temas Yüzey Alanını Artırır',
          fact: 'Fiziksel sindirimin temel amacı besinlerin temas yüzey alanını artırmaktır. Toz şekerin bütün küp şekerden hızlı çözünmesi gibi, genişleyen yüzey kimyasal sindirimi hızlandırır.',
          focus: 'surface-area',
        },
        {
          id: 's1-kimyasal',
          kicker: 'Sindirim Çeşitleri',
          title: 'Kimyasal Sindirim',
          fact: 'Besinlerin su ve özel yapılar yardımıyla hücre zarından ve kana geçebilecek en küçük yapı taşlarına kadar parçalanmasına kimyasal sindirim denir.',
          focus: 'chemical-breakdown',
        },
        {
          id: 's1-enzim',
          kicker: 'Hızlandırıcı Yapılar',
          title: 'Enzimlerin Görevi',
          fact: 'Kimyasal sindirimde besinlerin parçalanma hızını artıran özel yapılara enzim adı verilir. Enzimler sayesinde karmaşık besin molekülleri temel yapı birimlerine ayrışır.',
          focus: 'enzyme-speed',
          quickCheck: {
            prompt: 'Enzimler hangi sindirim çeşidinde görev alır?',
            options: ['Yalnızca kimyasal sindirimde', 'Yalnızca fiziksel sindirimde'],
            answer: 0,
            okFeedback: 'Harika! Enzimler suyla birlikte yalnızca kimyasal sindirimde besinleri yapı taşlarına ayırır.',
            retryFeedback: 'Dikkat! Fiziksel sindirimde enzim kullanılmaz; enzimler yalnızca kimyasal sindirimde çalışır.',
          },
        },
        {
          id: 's1-fark',
          kicker: 'Kritik Uyarı',
          title: 'Fiziksel ve Kimyasal Farkı',
          fact: 'Unutma: Fiziksel sindirim besinin kimyasal yapısını değiştirmez (yalnızca küçültür); kimyasal sindirim ise besinleri kana geçebilecek yapı taşlarına dönüştürür.',
          focus: 'chemical-breakdown',
        },
      ],
      game: {
        kind: 'kavram_avi',
        title: 'Bölüm 1 — Kavram Avı',
        intro: '1. bölümün tüm bilgilerini öğrendin! Şimdi 3 temel kavramı harf çemberinden yakala.',
        rounds: [
          {
            word: 'SİNDİRİM',
            definition: 'Ağız yoluyla alınan besin maddelerinin kana geçebilecek kadar küçük parçalara ayrılmasıdır.',
            praise: 'Süper! Sindirim, besinlerin kana geçebilecek küçüklüğe ayrılmasıdır.',
          },
          {
            word: 'FİZİKSEL SİNDİRİM',
            highlightSlug: 'fiziksel-sindirim',
            praise: 'Harika! Fiziksel sindirim temas yüzey alanını artırarak kimyasal sindirimi hızlandırır.',
          },
          {
            word: 'ENZİM',
            definition: 'Kimyasal sindirim sürecinde besin maddelerinin parçalanma hızını artıran özel yapılardır.',
            praise: 'Mükemmel! Enzimler yalnızca kimyasal sindirimde besinleri yapı taşlarına ayırır.',
          },
        ],
      },
      checkQuestionIds: [10699, 10701],
    },

    // =========================================================================
    // BÖLÜM 2 — Section 1456: Sindirim Kanalı Yapı ve Organları
    // =========================================================================
    {
      sectionId: 1456,
      tabLabel: '2. Sindirim Kanalı',
      title: 'Sindirim Kanalı Yapı ve Organları',
      accent: 'amber',
      beats: [
        {
          id: 's2-agiz',
          kicker: '1. Durak • Ağız',
          title: 'Ağızda Sindirim Başlar',
          fact: 'Sindirim sisteminin başlangıcı ağızdır. Dişlerin çiğnemesiyle fiziksel sindirim, tükürük salgısındaki enzimlerle karbonhidratların kimyasal sindirimi burada başlar.',
          focus: 'mouth',
        },
        {
          id: 's2-yutak',
          kicker: '2. Durak • Yutak',
          title: 'Yutak: Sadece İletim',
          fact: 'Ağızdan sonra gelen yutak, besinleri ağız boşluğundan yemek borusuna iletir. Yutakta fiziksel veya kimyasal hiçbir sindirim olayı gerçekleşmez.',
          focus: 'pharynx',
        },
        {
          id: 's2-yemek-borusu',
          kicker: '3. Durak • Yemek Borusu',
          title: 'Yemek Borusu: Kaslı Taşıyıcı',
          fact: 'Yemek borusu, yapısındaki kasların kasılıp gevşeme hareketleriyle besinleri mideye taşır. Yemek borusunda da besinlerin sindirimi yapılmaz.',
          focus: 'esophagus',
          quickCheck: {
            prompt: 'Yutak ve yemek borusunda sindirim gerçekleşir mi?',
            options: ['Hayır, yalnızca besinleri iletirler', 'Evet, kimyasal sindirim olur'],
            answer: 0,
            okFeedback: 'Tam isabet! Yutak ve yemek borusu sadece taşıma yoludur; hiçbir sindirim olmaz.',
            retryFeedback: 'Unutma: Yutak ve yemek borusunda fiziksel ya da kimyasal sindirim gerçekleşmez.',
          },
        },
        {
          id: 's2-mide-fiziksel',
          kicker: '4. Durak • Mide (Fiziksel)',
          title: 'Mide Besinleri Bulamaç Yapar',
          fact: 'Sindirim kanalının genişlemiş bölümü olan mide, güçlü kas hareketleriyle besinleri çalkalayıp fiziksel olarak parçalar ve bulamaç (kimus) hâline getirir.',
          focus: 'stomach',
        },
        {
          id: 's2-mide-kimyasal',
          kicker: '4. Durak • Mide (Kimyasal)',
          title: 'Protein Sindirimi Midede Başlar',
          fact: 'Mide öz suyundaki enzimler yardımıyla proteinlerin kimyasal sindirimi ilk kez midede başlar. Böylece midede hem fiziksel hem kimyasal sindirim yürütülür.',
          focus: 'stomach',
        },
        {
          id: 's2-ince-bagirsak',
          kicker: '5. Durak • İnce Bağırsak',
          title: 'İnce Bağırsak: Sindirim Tamamlanır',
          fact: 'Sindirim kanalının en uzun bölümü olan ince bağırsakta yağların kimyasal sindirimi ilk kez başlar. Karbonhidrat, protein ve yağların tüm sindirimi burada sona erer.',
          focus: 'small-intestine',
        },
        {
          id: 's2-besin-ozet',
          kicker: 'Büyük Özet',
          title: 'Besinler Nerede Başlar ve Biter?',
          fact: 'Kimyasal sindirim karbonhidratlarda (ekmek) ağızda, proteinlerde (et) midede, yağlarda ise ince bağırsakta başlar; hepsinin sindirimi ince bağırsakta tamamlanır.',
          focus: 'small-intestine',
        },
        {
          id: 's2-villus',
          kicker: 'Emilim Yüzeyi • Villus',
          title: 'Villuslar ile Kana Geçiş',
          fact: 'İnce bağırsağın iç yüzeyinde emilim alanını katlarca artıran villus isimli parmak benzeri kıvrımlar vardır. Parçalanan besin yapı taşları villuslardan kana geçer.',
          focus: 'villus-zoom',
          quickCheck: {
            prompt: 'İnce bağırsaktaki villusların temel görevi nedir?',
            options: ['Emilim yüzeyini artırıp besinleri kana geçirmek', 'Besinleri mekanik olarak çalkalamak'],
            answer: 0,
            okFeedback: 'Harika! Villuslar emilim yüzeyini katlarca artırarak besin yapı taşlarının kana geçmesini sağlar.',
            retryFeedback: 'Tekrar düşün: Villuslar ince bağırsağın içindeki emilim kıvrımlarıdır, besinleri kana geçirir.',
          },
        },
        {
          id: 's2-kalin-bagirsak',
          kicker: '6. Durak • Kalın Bağırsak',
          title: 'Kalın Bağırsak: Geri Emilim',
          fact: 'Kalın bağırsakta sindirim gerçekleşmez; sindirilmeyen posa geçici olarak depolanır. Kalan su, mineral ile B ve K vitaminlerinin geri emilimi burada tamamlanır.',
          focus: 'large-intestine',
          quickCheck: {
            prompt: 'Kalın bağırsağın temel görevi nedir?',
            options: ['Su, mineral ile B ve K vitaminlerini geri emmek', 'Yağların kimyasal sindirimini başlatmak'],
            answer: 0,
            okFeedback: 'Süpersin! Kalın bağırsakta sindirim olmaz; su, mineral ve B-K vitaminleri geri emilir.',
            retryFeedback: 'Yağların sindirimi ince bağırsakta olur; kalın bağırsak su, mineral ve B-K vitaminlerini geri emer.',
          },
        },
        {
          id: 's2-anus',
          kicker: '7. Durak • Anüs',
          title: 'Anüs: Atıkların Atılması',
          fact: 'Sindirim kanalının son kısmı olan anüs, vücut tarafından kullanılamayan sindirilmemiş atık maddelerin dış ortama atılmasını sağlar.',
          focus: 'anus',
        },
      ],
      game: {
        kind: 'kavram_avi',
        title: 'Bölüm 2 — Kavram Avı',
        intro: 'Sindirim kanalının 7 organını eksiksiz tanıdın! Şimdi 4 önemli organ ve yapıyı Kavram Avı ile pekiştir.',
        rounds: [
          {
            word: 'MİDE',
            highlightSlug: 'mide',
            praise: 'Harika! Mide besinleri kimus (bulamaç) yapar ve protein sindirimini başlatır.',
          },
          {
            word: 'VİLLUS',
            highlightSlug: 'villus',
            praise: 'Bravo! Villus kıvrımları ince bağırsakta emilim yüzeyini katlarca artırır.',
          },
          {
            word: 'YUTAK',
            definition: 'Besinleri ağız boşluğundan yemek borusuna ileten ve sindirim yapmayan organdır.',
            praise: 'Doğru! Yutak sindirim yapmadan besinleri yemek borusuna iletir.',
          },
          {
            word: 'ANÜS',
            definition: 'Sindirim kanalının son kısmıdır; sindirilmeyen atıkların dışarı atılmasını sağlar.',
            praise: 'Mükemmel! Sindirim kanalının tamamını başarıyla pekiştirdin.',
          },
        ],
      },
      checkQuestionIds: [10703, 10706],
    },

    // =========================================================================
    // BÖLÜM 3 — Section 1457: Sindirime Yardımcı Organlar
    // =========================================================================
    {
      sectionId: 1457,
      tabLabel: '3. Yardımcı Organlar',
      title: 'Sindirime Yardımcı Organlar',
      accent: 'emerald',
      beats: [
        {
          id: 's3-yardimci-giris',
          kicker: 'Yardımcı Organlar',
          title: 'Besinler İçinden Geçmez',
          fact: 'Karaciğer ve pankreas, besinlerin içinden doğrudan geçmediği yardımcı organlardır. Her ikisi de ürettiği salgıları özel kanallarla ince bağırsağa ulaştırır.',
          focus: 'accessory-overview',
        },
        {
          id: 's3-karaciger',
          kicker: 'Karaciğer & Safra Kesesi',
          title: 'En Büyük İç Organ: Karaciğer',
          fact: 'Vücudun en büyük iç organı olan karaciğer, sindirim için safra sıvısı üretir. Üretilen bu sıvı safra kesesinde depolanır ve bir kanalla ince bağırsağa dökülür.',
          focus: 'liver-gallbladder',
        },
        {
          id: 's3-safra',
          kicker: 'Kritik Bilgi • Safra Sıvısı',
          title: 'Safra: Enzimsiz Fiziksel Sindirim',
          fact: 'Safra sıvısı büyük yağ damlacıklarını küçük damlacıklara ayırarak yağların fiziksel sindirimini yapar. Safra enzim içermediğinden kimyasal sindirim yapmaz.',
          focus: 'bile-physical',
          quickCheck: {
            prompt: 'Safra sıvısı yağların hangi sindirimini gerçekleştirir?',
            options: ['Fiziksel (Mekanik) Sindirim', 'Kimyasal Sindirim'],
            answer: 0,
            okFeedback: 'Harika! Safra enzim içermez; bu yüzden yağların yalnızca fiziksel sindirimini yapar.',
            retryFeedback: 'Çok sık düşülen tuzak! Safra sıvısında enzim yoktur; yağları mekanik (fiziksel) olarak parçalar.',
          },
        },
        {
          id: 's3-safra-tikanma',
          kicker: 'Neden - Sonuç',
          title: 'Safra Kanalı Tıkanırsa Ne Olur?',
          fact: 'Safra ince bağırsağa ulaşamazsa yağlar küçük damlacıklara ayrılamaz. Temas yüzeyi genişleyemediği için pankreas enzimleri zorlanır ve yağların kimyasal sindirimi yavaşlar.',
          focus: 'bile-physical',
        },
        {
          id: 's3-pankreas',
          kicker: 'Pankreas',
          title: 'Pankreas Öz Suyu',
          fact: 'Midenin arka alt kısmında yer alan pankreas, sindirim enzimleri açısından çok zengin olan pankreas öz suyunu salgılar ve bir kanalla ince bağırsağa döker.',
          focus: 'pancreas-overview',
        },
        {
          id: 's3-pankreas-gorev',
          kicker: 'Kimyasal Sindirim Tamamlanır',
          title: 'Tüm Besinlere Kimyasal Sindirim',
          fact: 'Pankreas öz suyunun içindeki enzimler ince bağırsakta karbonhidratların, proteinlerin ve yağların kimyasal sindirimini tamamlar.',
          focus: 'pancreas-chemical',
          quickCheck: {
            prompt: 'Pankreas öz suyu hangi besinlerin kimyasal sindirimini tamamlar?',
            options: ['Karbonhidrat, protein ve yağların hepsini', 'Yalnızca yağların fiziksel sindirimini'],
            answer: 0,
            okFeedback: 'Mükemmel! Pankreas öz suyu enzimce zengindir ve üç besin grubunun da kimyasal sindirimini tamamlar.',
            retryFeedback: 'Yağların fiziksel sindirimini safra yapar; pankreas öz suyu tüm besinlerin kimyasal sindirimini bitirir.',
          },
        },
      ],
      game: {
        kind: 'kavram_avi',
        title: 'Bölüm 3 — Kavram Avı',
        intro: 'Yardımcı organları ve salgılarını öğrendin! Şimdi Karaciğer, Safra Sıvısı ve Pankreas kavramlarını yakala.',
        rounds: [
          {
            word: 'KARACİĞER',
            definition: 'Vücudun en büyük iç organıdır; yağların fiziksel sindirimi için safra sıvısı üretir.',
            praise: 'Harika! Karaciğer safra üretir ve salgı safra kesesinde depolanır.',
          },
          {
            word: 'SAFRA SIVISI',
            highlightSlug: 'safra-sivisi',
            praise: 'Süper! Safra sıvısı enzim içermez, yağları küçük damlacıklara ayırarak fiziksel sindirir.',
          },
          {
            word: 'PANKREAS',
            definition: 'Midenin arka alt kısmında yer alır; tüm besinlerin kimyasal sindirimini tamamlayan öz suyu salgılar.',
            praise: 'Mükemmel! Pankreas öz suyu kanalla ince bağırsağa dökülür ve kimyasal sindirimi bitirir.',
          },
        ],
      },
      checkQuestionIds: [10708, 10710],
    },

    // =========================================================================
    // BÖLÜM 4 — Section 1458: Sindirim Sisteminin Sağlığı
    // =========================================================================
    {
      sectionId: 1458,
      tabLabel: '4. Sindirim Sağlığı',
      title: 'Sindirim Sisteminin Sağlığı',
      accent: 'rose',
      beats: [
        {
          id: 's4-dengeli',
          kicker: 'Dengeli Beslenme',
          title: '6 Besin Grubu ve Düzenli Su',
          fact: 'Karbonhidrat, protein, yağ, vitamin, mineral ve su yeterli ve dengeli tüketilmelidir. Doğru besin dengesi bağışıklığı destekler, düzenli su içmek organların çalışmasını kolaylaştırır.',
          focus: 'health-balanced',
        },
        {
          id: 's4-cigneme',
          kicker: 'Yeme Alışkanlığı',
          title: 'Oturarak ve Yavaş Çiğne',
          fact: 'Besinlerin oturarak, yavaş ve yeterince çiğnenerek tüketilmesi ağızda fiziksel sindirimi artırır. Böylece mide ve bağırsakların iş yükü azalır.',
          focus: 'health-chewing',
        },
        {
          id: 's4-zararli',
          kicker: 'Sindirim Rahatsızlıkları',
          title: 'Reflü, Gastrit ve Obezite Riski',
          fact: 'Aşırı yağlı, fazla baharatlı, paketli gıdalar ile hazır ve ayaküstü (fast-food) besinler reflü, gastrit ve obezite gibi rahatsızlıklara yol açabilir.',
          focus: 'health-risks',
        },
        {
          id: 's4-egzersiz',
          kicker: 'Aktif Yaşam',
          title: 'Egzersiz Bağırsakları Hareketlendirir',
          fact: 'Düzenli egzersiz bağırsak kaslarının hareketliliğini uyarır, kan akışını ve metabolizmayı hızlandırır. Ayrıca sindirim organlarını bozan stresi azaltır.',
          focus: 'health-exercise',
        },
        {
          id: 's4-hareketsizlik',
          kicker: 'Teknoloji Bağımlılığı',
          title: 'Hareketsizlik ve Öne Eğilme Baskısı',
          fact: 'Teknoloji bağımlılığı nedeniyle uzun süre hareketsiz kalmak bağırsak hareketlerini yavaşlatır. Ekran karşısında öne eğilerek oturmak sindirim organlarına baskı yapar.',
          focus: 'health-screen',
        },
        {
          id: 's4-ekran-yemek',
          kicker: 'Ekran Başında Yemek',
          title: 'Tokluk Hissini Fark Edememe',
          fact: 'Ekran başında vakit geçirirken dikkat dağıldığı için tokluk hissi fark edilemez. Bu durum lokmaları az çiğneyerek hızlı ve aşırı yemeye veya öğün atlamaya yol açar.',
          focus: 'health-screen',
          quickCheck: {
            prompt: 'Yemek yerken ekrana bakmak neden sindirime zarar verir?',
            options: [
              'Dikkat dağıldığı için tokluk fark edilmez, hızlı ve az çiğneyerek yenir',
              'Mide öz suyunun üretimi tamamen durur',
            ],
            answer: 0,
            okFeedback: 'Çok doğru! Dikkat dağıldığı için tokluk fark edilmez, lokmalar yeterince çiğnenmeden yutulur ve mide yorulur.',
            retryFeedback: 'Tekrar bakalım: Ekran başında dikkat dağılır, tokluk hissi fark edilmez ve hızlı/aşırı yeme görülür.',
          },
        },
      ],
      game: {
        kind: 'kavram_avi',
        title: 'Bölüm 4 — Kavram Avı',
        intro: 'Son bölümün oyununa geldin! Sindirim sağlığıyla ilgili 3 önemli rahatsızlık kavramını yakala.',
        rounds: [
          {
            word: 'REFLÜ',
            definition: 'Aşırı yağlı, baharatlı ve paketli gıdaların sık tüketimiyle tetiklenebilen mide rahatsızlıklarından biridir.',
            praise: 'Doğru! Dengeli beslenme ve yavaş çiğneme reflü riskini azaltır.',
          },
          {
            word: 'GASTRİT',
            definition: 'Fast-food, aşırı baharatlı ve paketli gıdaların sık tüketilmesiyle ortaya çıkabilen bir mide rahatsızlığıdır.',
            praise: 'Harika! Düzenli su içmek ve sağlıklı beslenmek mideyi korur.',
          },
          {
            word: 'OBEZİTE',
            definition: 'Dengesiz beslenme, fast-food tüketimi ve hareketsiz yaşam sonucunda ortaya çıkabilen sağlık sorunudur.',
            praise: 'Mükemmel! Egzersiz ve dengeli beslenme sağlıklı yaşamın anahtarıdır.',
          },
        ],
      },
      checkQuestionIds: [10714, 10716],
    },
  ],
};
