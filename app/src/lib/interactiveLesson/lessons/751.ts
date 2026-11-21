// 5. Sınıf Sosyal Bilgiler · Demokrasi ve Cumhuriyet Kavramının Temel Nitelikleri (Konu #751)
// v2 Altın Örnek (PlayerV2): Her ekranda YALNIZCA 1 bilgi veya 1 oyun işlemi!
// Supabase yayındaki 3 kitap bölümüne (2013, 2014, 2015), anahtar kavramlara ve aktif havuz sorularına %100 sadıktır.
import type { LessonDefinitionV2 } from '../typesV2';

export const lesson751: LessonDefinitionV2 = {
  version: 2,
  topicId: 751,
  themeId: 'explorer-compass',
  adventureTitle: 'Demokrasi ve Cumhuriyet Yolculuğu',
  subtitle: '3 durakta halk yönetimini, temel ilkeleri ve cumhuriyeti keşfet!',
  badgeTitle: 'Demokrasi Kâşifi',
  courseLabel: '5. Sınıf Sosyal Bilgiler',
  guide: {
    intro: 'Merhaba! Ben Atom. Bugün Demokrasi ve Cumhuriyet kavramlarını adım adım oyunlarla keşfedeceğiz!',
    finish: 'Harikasın! Demokrasinin günlük yaşamdaki yerini, temel niteliklerini ve cumhuriyetle bağını başarıyla tamamladın!',
  },
  stops: [
    // =========================================================================
    // DURAK 1 — Section 2013: Demokrasi Kavramı ve Günlük Hayattaki Yansımaları
    // =========================================================================
    {
      sectionId: 2013,
      title: 'Demokrasi ve Günlük Yaşam',
      subtitle: '1. Durak • Aile, Okul ve Mahalle',
      color: '#0ea5e9',
      tint: '#e0f2fe',
      part: { emoji: '🧭', name: 'Katılım Pusulası', icon: 'compass' },
      steps: [
        {
          kind: 'story',
          emoji: '🏛️',
          badge: 'Demokrasi Nedir?',
          say: 'Demokrasi, halkın kendi kendini yönetmesi ve devlet yönetiminde söz sahibi olmasıdır. Yalnızca seçimlerle değil, aile, okul ve mahallede de yaşatılır.',
        },
        {
          kind: 'story',
          emoji: '🏫',
          badge: 'Aile ve Okulda',
          say: 'Evde ortak kararlarda herkesin fikrini almak, sınıfta kuralları birlikte oylamak ve sandık kurup sınıf başkanı seçmek günlük demokrasi örnekleridir.',
        },
        {
          kind: 'story',
          emoji: '🏘️',
          badge: 'Mahalle ve Dilekçe',
          say: 'Muhtarın afet toplanma alanını mahalle sakinlerine danışması veya vatandaşların park ve yol eksiklikleri için belediyeye dilekçe vermesi demokratik katılımdır.',
        },
        {
          kind: 'swipe_sort',
          say: 'Verilen örnekleri Demokratik Uygulama mı, Demokratik Değil mi diye ayır:',
          leftLabel: 'Demokratik',
          rightLabel: 'Demokratik Değil',
          hint: 'Ortak karar, oylama ve görüş alma demokratiktir; tek kişinin dayatması değildir.',
          items: [
            { text: 'Sınıf kurallarını öğrencilerin oylayarak belirlemesi', side: 'L' },
            { text: 'Grup kararını yalnızca tek bir kişinin alması', side: 'R' },
            { text: 'Mahalle parkı için belediyeye dilekçe verilmesi', side: 'L' },
            { text: 'Ailede kimsenin fikrini sormadan karar verilmesi', side: 'R' },
          ],
          feedback: 'Harika! Demokrasi evde, okulda ve mahallede herkesin söz hakkına sahip olmasıdır.',
        },
        {
          kind: 'kavram_avi',
          say: 'Harf çemberinden halkın kendi kendini yönetmesi anlamına gelen kavramı yakala!',
          word: 'DEMOKRASİ',
          highlightSlug: 'demokrasi',
          feedback: 'Süpersin! Demokrasi halkın yönetimde söz sahibi olmasıdır.',
        },
        { kind: 'pool_question', questionId: 8416 },
        { kind: 'pool_question', questionId: 8418 },
      ],
    },

    // =========================================================================
    // DURAK 2 — Section 2014: Demokrasinin Temel Nitelikleri
    // =========================================================================
    {
      sectionId: 2014,
      title: 'Demokrasinin Temel Nitelikleri',
      subtitle: '2. Durak • 6 Temel İlke',
      color: '#f59e0b',
      tint: '#fef3c7',
      part: { emoji: '🔑', name: 'Adalet Anahtarı', icon: 'key' },
      steps: [
        {
          kind: 'story',
          emoji: '🗳️',
          badge: 'Millî Egemenlik',
          say: 'Millî egemenlik, yönetme yetkisinin doğrudan millete ait olmasıdır. Halk bu iradesini seçimler yoluyla temsilcilerini belirleyerek gösterir.',
        },
        {
          kind: 'story',
          emoji: '🤝',
          badge: 'Katılım ve Çoğulculuk',
          say: 'Katılım, oy, dilekçe veya sivil toplum örgütleriyle süreçlerde yer almaktır. Çoğulculuk ise farklı görüşlerin ve birden fazla siyasi partinin temsil edilmesidir.',
        },
        {
          kind: 'story',
          emoji: '⚖️',
          badge: 'Özgürlük, Eşitlik, Hukuk',
          say: 'Özgürlük başkasına zarar vermeden karar alabilmektir; eşitlik yasalar önünde ayrıcalık olmamasıdır; hukukun üstünlüğü herkesin ve yöneticilerin yasalara uymasıdır.',
        },
        {
          kind: 'match',
          say: 'Demokrasinin temel niteliklerini doğru açıklamalarıyla eşleştir:',
          pairs: [
            ['Millî Egemenlik', 'Yönetme yetkisinin millete ait olması'],
            ['Çoğulculuk', 'Farklı görüş ve partilerin temsil edilmesi'],
            ['Hukukun Üstünlüğü', 'Herkesin ve yöneticilerin yasalara uyması'],
            ['Katılım', 'Oy ve dilekçeyle karar süreçlerinde yer alma'],
          ],
          feedback: 'Mükemmel! Demokrasinin temel ilkelerini eksiksiz eşleştirdin.',
        },
        {
          kind: 'kavram_avi',
          say: 'Farklı düşüncelerin ve siyasi partilerin yönetimde temsil edilmesini anlatan kavramı bul!',
          word: 'ÇOĞULCULUK',
          highlightSlug: 'cogulculuk',
          feedback: 'Harika! Çoğulculuk farklı fikirlerin mecliste ve seçimlerde yer bulmasıdır.',
        },
        { kind: 'pool_question', questionId: 8419 },
        { kind: 'pool_question', questionId: 8422 },
      ],
    },

    // =========================================================================
    // DURAK 3 — Section 2015: Cumhuriyet Yönetimi ve Demokrasi ile İlişkisi
    // =========================================================================
    {
      sectionId: 2015,
      title: 'Cumhuriyet ve Demokrasi',
      subtitle: '3. Durak • 29 Ekim 1923',
      color: '#10b981',
      tint: '#d1fae5',
      part: { emoji: '🛡️', name: 'Cumhuriyet Kalkanı', icon: 'shield' },
      steps: [
        {
          kind: 'story',
          emoji: '🇹🇷',
          badge: 'Cumhuriyetin İlanı',
          say: 'Cumhuriyet, milletin egemenliği kendi elinde tutup seçtiği temsilcilerle kullandığı devlet biçimidir. 23 Nisan 1920’de TBMM açıldı, 29 Ekim 1923’te cumhuriyet ilan edildi.',
        },
        {
          kind: 'story',
          emoji: '⭐',
          badge: 'Demokrasi ile İlişkisi',
          say: 'Atatürk, cumhuriyetin demokrasinin en çağdaş ve mantıklı uygulamasını sağlayan yönetim biçimi olduğunu belirtmiştir. İlk cumhurbaşkanımız Mustafa Kemal Atatürk’tür.',
        },
        {
          kind: 'story',
          emoji: '📜',
          badge: 'Eşitlik ve Gençliğe Emanet',
          say: '1930’lu yılların başlarında Türk kadınına seçme ve seçilme hakkı tanındı. Atatürk, Nutuk’taki Gençliğe Hitabe ile cumhuriyeti koruma görevini Türk gençliğine verdi.',
        },
        {
          kind: 'order',
          say: 'Ülkemizdeki demokratikleşme adımlarını tarihsel sıraya göre diz:',
          items: [
            '23 Nisan 1920: TBMM’nin açılması',
            'Saltanatın kaldırılması',
            '29 Ekim 1923: Cumhuriyetin ilan edilmesi',
            '1930’lar: Türk kadınına seçme ve seçilme hakkı',
          ],
          feedback: 'Bravo! Cumhuriyet tarihimizdeki adımları doğru sıraya dizdin.',
        },
        {
          kind: 'kavram_avi',
          say: 'Yöneticilerin halk oyuyla belirli süreler için seçildiği devlet biçimini çemberden çıkar!',
          word: 'CUMHURİYET',
          highlightSlug: 'cumhuriyet',
          feedback: 'Tebrikler! Cumhuriyet, demokrasinin uygulanabileceği en uygun devlet biçimidir.',
        },
        { kind: 'pool_question', questionId: 8423 },
        { kind: 'pool_question', questionId: 8425 },
      ],
    },
  ],
};
