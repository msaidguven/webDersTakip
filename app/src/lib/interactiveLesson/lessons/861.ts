// Altın Örnek v2 — Konu #861: Sindirim Sistemi (7. Sınıf · Fen Bilimleri · Vücudumuzdaki Sistemler)
// Gerçek bölüm kimlikleri (1455, 1456, 1457, 1458), gerçek anahtar kavramlar (topic_content_highlights)
// ve aktif havuz soruları (10699, 10703, 10708, 10714) ile çalışır.
import type { LessonDefinitionV2 } from '../typesV2';

export const lesson861: LessonDefinitionV2 = {
  version: 2,
  topicId: 861,
  themeId: 'lab-capsule',
  adventureTitle: 'Mikro Kapsül Yolculuğu',
  subtitle: 'Sindirim sisteminin 4 durağını tamamla, Mikro Kapsülün tüm parçalarını topla!',
  badgeTitle: 'Sindirim Sistemi Kâşifi',
  courseLabel: '7. Sınıf • Fen Bilimleri',
  guide: {
    intro: 'Merhaba! Ben Atom. Mikro kapsülümüzle sindirim sisteminde harika bir yolculuğa çıkıyoruz!',
    finish: 'Mikro kapsül tamamlandı! Sindirim sisteminin tüm sırlarını ustaca çözdün!',
  },
  stops: [
    {
      sectionId: 1455,
      title: 'Sindirim Çeşitleri',
      subtitle: '1. Durak • Fiziksel & Kimyasal',
      color: '#f59e0b',
      tint: '#fff3d6',
      part: { emoji: '⚙️', name: 'Parçalama Dişlisi' },
      steps: [
        {
          kind: 'story',
          emoji: '🔬',
          badge: 'Görev 1',
          say: 'Mikro kapsülümüz yola çıkmaya hazır! Besinlerin kana geçebilecek kadar küçük parçalara ayrılmasına <b>sindirim</b> denir. İlk parça için sindirim çeşitlerini keşfedelim!',
        },
        {
          kind: 'slider',
          say: 'Sürgüyü sağa kaydır! Fiziksel ve kimyasal sindirim arasındaki farkı kendi gözlerinle gör:',
          leftTag: '◀ Fiziksel',
          rightTag: 'Kimyasal ▶',
          left: {
            label: 'Fiziksel (Mekanik) Sindirim',
            emoji: '🦷',
            text: 'Besinler çiğneme ve kas hareketleriyle kimyasal yapısı değişmeden küçük parçalara ayrılır; temas yüzeyi artar.',
          },
          right: {
            label: 'Kimyasal Sindirim',
            emoji: '🧪',
            text: 'Besinler enzim ve su yardımıyla hücre zarından geçebilecek yapı taşlarına ayrılır.',
          },
          feedback: 'Harika! Fiziksel sindirim yüzeyi büyütür, kimyasal sindirim ise enzimlerle yapı taşlarına ayırır.',
        },
        {
          kind: 'swipe_sort',
          say: 'Kartı kaydır veya dokun: Fiziksel sindirim mi, Kimyasal sindirim mi?',
          leftLabel: '🦷 Fiziksel',
          rightLabel: '🧪 Kimyasal',
          hint: 'Enzim varsa kimyasal, sadece parçalama veya kas hareketi varsa fizikseldir.',
          items: [
            { text: 'Dişlerle besinlerin çiğnenmesi', side: 'L' },
            { text: 'Tükürükteki enzimlerin karbonhidratı parçalaması', side: 'R' },
            { text: 'Mide kaslarının besinleri bulamaç hâline getirmesi', side: 'L' },
          ],
          feedback: 'Süpersin! Fiziksel ve kimyasal sindirimi hatasız ayırdın.',
        },
        {
          kind: 'pool_question',
          say: 'Kapsülün ilk parçasını kilitten çıkarmak için gerçek soruyu çöz:',
          questionId: 10699,
        },
      ],
    },
    {
      sectionId: 1456,
      title: 'Sindirim Kanalı',
      subtitle: '2. Durak • Organlar Rotası',
      color: '#0ea5e9',
      tint: '#e0f4ff',
      part: { emoji: '🧭', name: 'Kanal Radarı' },
      steps: [
        {
          kind: 'story',
          emoji: '🚀',
          badge: 'Görev 2',
          say: 'Şimdi kapsülle sindirim kanalının içindeyiz! Ağızdan başlayan yolculukta her organın kendine özel bir görevi var.',
        },
        {
          kind: 'kavram_avi',
          say: 'Kavram Avı! Harfleri birleştirip ince bağırsaktaki bu özel yapıyı yakala:',
          word: 'VİLLUS',
          highlightSlug: 'villus',
          feedback: 'Mükemmel! Villuslar ince bağırsakta emilim yüzeyini artırarak besinlerin kana geçmesini sağlar.',
        },
        {
          kind: 'order',
          say: 'Besin Rotası! Kapsülün izlediği organları <b>ağızdan başlayarak</b> sırayla dokunup diz:',
          slotPlaceholder: 'Sıradaki organı seç 👇',
          items: [
            '👄 Ağız',
            '🗣️ Yutak',
            '📏 Yemek Borusu',
            '🥣 Mide',
            '🌀 İnce Bağırsak',
            '🔄 Kalın Bağırsak',
          ],
          feedback: 'Kusursuz rota! Besinler tam olarak bu sırayı izler ve sindirim ince bağırsakta tamamlanır.',
        },
        {
          kind: 'hat',
          say: 'Hangi organda hangi besinin kimyasal sindirimi başlar? Doğru rozeti tak:',
          slotPrompt: 'Kimyasal sindirim rozetini seç 👇',
          rounds: [
            {
              scene: '👄',
              place: 'Ağız • Tükürük Salgısı',
              options: [
                { emoji: '🍞', label: 'Karbonhidrat' },
                { emoji: '🥩', label: 'Protein' },
                { emoji: '🧈', label: 'Yağ' },
              ],
              answer: 0,
              feedback: 'Doğru! Tükürükteki enzimlerle karbonhidratların kimyasal sindirimi ağızda başlar.',
            },
            {
              scene: '🥣',
              place: 'Mide • Mide Öz Suyu',
              options: [
                { emoji: '🥩', label: 'Protein' },
                { emoji: '🍞', label: 'Karbonhidrat' },
                { emoji: '💧', label: 'Su & Mineral' },
              ],
              answer: 0,
              feedback: 'Harika! Proteinlerin kimyasal sindirimi midede başlar.',
            },
          ],
        },
        {
          kind: 'pool_question',
          say: 'Kanal Radarını kazanmak için bu soruyu çöz:',
          questionId: 10703,
        },
      ],
    },
    {
      sectionId: 1457,
      title: 'Yardımcı Organlar',
      subtitle: '3. Durak • Karaciğer & Pankreas',
      color: '#10b981',
      tint: '#e2faef',
      part: { emoji: '🧪', name: 'Enzim Tüpü' },
      steps: [
        {
          kind: 'story',
          emoji: '🧬',
          badge: 'Görev 3',
          say: 'Besinler <b>karaciğer</b> ve <b>pankreasın</b> içinden geçmez; ama bu iki yardımcı organ salgılarını ince bağırsağa göndererek sindirimi tamamlar!',
        },
        {
          kind: 'kavram_avi',
          say: 'Kavram Avı! Karaciğerin ürettiği bu iki kelimelik salgıyı çemberden çıkar:',
          word: 'SAFRA SIVISI',
          highlightSlug: 'safra-sivisi',
          feedback: 'Harika! Safra sıvısı karaciğerde üretilir ve ince bağırsakta yağların fiziksel sindirimini sağlar.',
        },
        {
          kind: 'match',
          say: 'Hızlı Eşleştirme! Önce soldan organı, sonra sağdan onun görevini seç:',
          pairs: [
            ['Karaciğer', 'Safra sıvısını üretir'],
            ['Pankreas', 'Pankreas öz suyunu salgılar'],
            ['İnce Bağırsak', 'Villuslarla emilimi yapar'],
          ],
          feedback: 'Süper! Yardımcı organların ve ince bağırsağın görevlerini mükemmel eşleştirdin.',
        },
        {
          kind: 'spot_error',
          say: 'Hata Avcısı! Bu cümlede <b>tek bir bilimsel hata</b> var. Yanlış kelimeye dokun ve düzelt:',
          tokens: ['Karaciğerin', 'ürettiği', 'safra sıvısı,', 'yağların', 'kimyasal', 'sindirimini', 'sağlar.'],
          errorIndex: 4,
          correction: 'fiziksel',
          hint: 'Safra sıvısı enzim içermez; yağları sadece küçük damlacıklara ayırır.',
          feedback: 'Aferin! Safra sıvısı enzim içermez; bu yüzden yağların kimyasal değil, FİZİKSEL sindirimini sağlar.',
        },
        {
          kind: 'pool_question',
          say: 'Enzim Tüpünü kapsüle takmak için soruyu çöz:',
          questionId: 10708,
        },
      ],
    },
    {
      sectionId: 1458,
      title: 'Sindirim Sağlığı',
      subtitle: '4. Durak • Sağlık Kalkanı',
      color: '#7c5cff',
      tint: '#ede9ff',
      part: { emoji: '🛡️', name: 'Sağlık Kalkanı' },
      steps: [
        {
          kind: 'story',
          emoji: '🥗',
          badge: 'Final Görevi',
          say: 'Son duraktayız! Dengeli beslenme, yeterli su, yavaş çiğneme ve düzenli egzersiz sindirim sistemimizin en güçlü kalkanıdır.',
        },
        {
          kind: 'kavram_avi',
          say: 'Kavram Avı! Besinleri bulamaç hâline getiren bu ana organı çemberden çıkar:',
          word: 'MİDE',
          highlightSlug: 'mide',
          feedback: 'Tebrikler! Mide kas kasılmalarıyla besinleri bulamaç hâline getirir ve protein sindirimini başlatır.',
        },
        {
          kind: 'scenario',
          say: 'Senaryo Kararı! Günlük yaşamda sindirim sağlığını korumak için en doğru seçimi yap:',
          rounds: [
            {
              emoji: '🍽️',
              situation: 'Okuldan çok aç geldin ve sofrada sıcak yemek var. Sindirim sistemin için en sağlıklı davranış hangisi?',
              options: [
                { label: 'Oturarak, yavaşça ve iyice çiğneyerek yemek', feedback: 'Harika! İyi çiğnemek midenin yükünü azaltır ve sindirimi kolaylaştırır.' },
                { label: 'Ekran karşısında ayakta hızlıca atıştırmak', feedback: 'Hızlı ve ekran karşısında yemek yutmayı zorlaştırır, mideyi yorar.' },
                { label: 'Yemeği hiç çiğnemeden bol gazlı içecekle yutmak', feedback: 'Çiğnenmeden yutulan besinler ve gazlı içecekler mide rahatsızlıklarını tetikler.' },
              ],
              answer: 0,
            },
            {
              emoji: '🏃',
              situation: 'Reflü, gastrit ve obeziteden korunmak için haftalık alışkanlığını nasıl planlarsın?',
              options: [
                { label: 'Her gün bol baharatlı fast-food ve paketli gıda yemek', feedback: 'Aşırı yağlı, baharatlı ve paketli gıdalar reflü, gastrit ve obezite riskini artırır.' },
                { label: 'Dengeli beslenip yeterli su içmek ve düzenli egzersiz yapmak', feedback: 'Süper karar! Dengeli beslenme, su ve egzersiz bağırsak kaslarını destekler.' },
                { label: 'Gün boyu hiç su içmeden sadece öğün atlamak', feedback: 'Yetersiz su ve düzensiz öğünler sindirim düzenini bozar.' },
              ],
              answer: 1,
            },
          ],
        },
        {
          kind: 'swipe_sort',
          say: 'Son Karar! Sindirim sağlığı için Doğru mu, Yanlış mı?',
          leftLabel: '✅ Doğru',
          rightLabel: '❌ Yanlış',
          hint: 'Sindirim sistemini koruyan dengeli ve bilinçli alışkanlıkları seç.',
          items: [
            { text: 'Yeterli miktarda su içmek sindirimi kolaylaştırır.', side: 'L' },
            { text: 'Aşırı yağlı ve paketli gıdalar gastrit ve reflüye yol açabilir.', side: 'L' },
            { text: 'Yemekleri ekran karşısında hızlıca yemek faydalıdır.', side: 'R' },
          ],
          feedback: 'Mükemmel! Sindirim sistemini koruma kurallarını tamamen kavradın.',
        },
        {
          kind: 'pool_question',
          say: 'Sağlık Kalkanını tamamlamak için final sorusunu çöz:',
          questionId: 10714,
        },
      ],
    },
  ],
};
