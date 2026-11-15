// 5. sınıf Bilişim · Dosya ve Klasör Yönetimi (konu 818) — etkileşimli dersin ikinci altın örneği.
// Görseller hazır bileşenlerle (kart, tablo, ağaç, akış, parçala); SVG yok. İçerik konu metninden
// (topic_content_sections 1387–1390); havuzda klasik soru olmadığı için "Konuyu anladık mı?" soruları derste yazıldı.
import type { LessonDefinition } from '../types';

export const lesson818: LessonDefinition = {
  topicId: 818,
  // Anlatıcı robotun bu derse özel hikâyesi (açılış/kapanış).
  guide: {
    intro: "Merhaba! Ben Atom. Hafızamdaki dosyalar karmakarışık oldu! Dosya ve klasörleri birlikte düzenleyelim mi?",
    finish: "Hafızam tertemiz oldu! Artık dosya ve klasörleri düzenlemeyi biliyorsun.",
  },
  // "Dosya" ve "klasör" neredeyse her cümlede geçer; otomatik bağlansa her açıklama mavi bağlantıyla dolar.
  autoLinkExclude: ['dosya', 'klasor'],
  // Anahtar kavramlarda olmayan kavram bağları (öncelik buradaki tanımda).
  terms: {
    'alt-klasor': { title: 'Alt klasör', description: 'Bir klasörün içinde yer alan klasördür.', icon: '📂' },
  },
  blocks: [
    {
      sectionId: 1387,
      title: 'Dosya ve uzantılar',
      steps: [
        {
          kind: 'anlatim',
          title: 'Dosya nedir?',
          body:
            'Bilgisayarda bilgi ve verilerin kaydedildiği, kendine ait **adı** ve [[uzantısı|dosya-uzantisi]] olan birime [[dosya]] denir. Metin belgeleri, fotoğraflar, ses kayıtları ve videolar birer dosyadır.\n\n' +
            'Dosyalar sabit disk, SSD, USB bellek veya hafıza kartı gibi depolama birimlerinde saklanır.',
          visual: {
            kind: 'parcala',
            parts: [
              { text: 'odev', label: 'Dosya adı', note: 'İçeriği hatırlatır' },
              { text: '.', label: 'Nokta', note: 'Adı ve uzantıyı ayırır' },
              { text: 'docx', label: 'Uzantı', note: 'Türünü ve açılacağı programı belirler', term: 'dosya-uzantisi' },
            ],
          },
        },
        {
          kind: 'anlatim',
          title: 'Belge ve medya dosyaları',
          visual: {
            kind: 'kartlar',
            cards: [
              { icon: 'FileText', title: 'Metin belgesi', tag: '.txt  .docx' },
              { icon: 'BookOpen', title: 'Taşınabilir belge', tag: '.pdf' },
              { icon: 'Image', title: 'Görsel', tag: '.jpg  .png' },
              { icon: 'Music', title: 'Ses', tag: '.mp3' },
              { icon: 'Clapperboard', title: 'Video', tag: '.mp4' },
            ],
          },
        },
        {
          kind: 'anlatim',
          title: 'Sunum, tablo, arşiv ve programlar',
          visual: {
            kind: 'kartlar',
            cards: [
              { icon: 'Presentation', title: 'Sunum', tag: '.pptx' },
              { icon: 'Sheet', title: 'Hesap tablosu', tag: '.xlsx' },
              { icon: 'Archive', title: 'Sıkıştırılmış arşiv', tag: '.zip  .rar  .7z' },
              { icon: 'Cog', title: 'Program', tag: '.exe', text: 'Kaynağı bilinmeyen programı çalıştırma!' },
            ],
          },
        },
        {
          kind: 'anlatim',
          title: 'Dosya adlandırma kuralları',
          misconception: {
            wrong: 'Dosya adında boşluk ve Türkçe harf kullanılamaz.',
            right: 'Kullanılabilir. Yasak olanlar yalnız * ? / \\ : " < > | sembolleridir.',
          },
          visual: {
            kind: 'kartlar',
            cards: [
              { icon: 'Pencil', title: 'Kısa ve anlamlı ad ver', text: 'Konu ve tarih içeren adlar aradığını hızla buldurur.', tag: 'fen-odevi-ekim.docx' },
              { icon: 'TriangleAlert', title: 'Bu semboller kullanılamaz', tag: '* ? / \\ : " < > |' },
              { icon: 'ShieldAlert', title: 'Uzantıya dokunma', text: 'Uzantısı bozulan dosya doğru programla açılamaz.' },
            ],
          },
        },
        {
          kind: 'eslestirme',
          prompt: 'Her uzantıyı dosya türüyle eşleştir.',
          targets: ['Metin belgesi', 'Görsel', 'Ses', 'Video', 'Sunum', 'Sıkıştırılmış arşiv', 'Program'],
          items: [
            { text: '.docx', target: 0 },
            { text: '.jpg', target: 1 },
            { text: '.mp3', target: 2 },
            { text: '.mp4', target: 3 },
            { text: '.pptx', target: 4 },
            { text: '.zip', target: 5 },
            { text: '.exe', target: 6 },
          ],
          explanation: 'Uzantı, dosyanın kimliğidir: hangi türde olduğunu ve hangi programla açılacağını söyler.',
        },
        {
          kind: 'coklu_secim',
          prompt: 'Hangi dosya adları Windows\'ta kullanılabilir? Hepsini seç.',
          options: [
            { text: 'fen_odevi.docx', icon: 'FileText', correct: true },
            { text: 'proje?.docx', icon: 'FileText', correct: false },
            { text: '2026-ekim-rapor.pdf', icon: 'BookOpen', correct: true },
            { text: 'sınıf/liste.xlsx', icon: 'Sheet', correct: false },
            { text: 'tatil fotoğrafı.jpg', icon: 'Image', correct: true },
            { text: 'not:1.txt', icon: 'FileText', correct: false },
          ],
          explanation: 'Dosya adında * ? / \\ : " < > | sembolleri kullanılamaz. Boşluk, tire, alt çizgi ve Türkçe harfler kullanılabilir.',
        },
        { kind: 'soru', questionId: 6695 },
        { kind: 'soru', questionId: 6698 },
        { kind: 'soru', questionId: 6702 },
        {
          kind: 'klasik',
          prompt: 'Bir arkadaşın "odev.docx" dosyasının adını değiştirirken yanlışlıkla "odev.mp3" yaptı. Dosyayı açmaya çalışınca ne olur? Nedenini açıkla.',
          modelAnswer:
            'Dosya doğru programla açılamaz. Çünkü uzantı dosyanın türünü ve hangi programla açılacağını belirler; bilgisayar dosyayı ses dosyası sanar. İçerik hâlâ bir metin belgesidir, uzantı yeniden .docx yapılmalıdır.',
        },
      ],
    },
    {
      sectionId: 1388,
      title: 'Klasörler, dosya yolu ve depolama',
      steps: [
        {
          kind: 'anlatim',
          title: 'Klasör ve alt klasör',
          body:
            'Birbiriyle ilişkili dosyaları ve diğer klasörleri bir arada tutan alana [[klasör]] denir. Bir klasörün içindeki klasörlere [[alt klasör|alt-klasor]] denir.\n\n' +
            'Klasör yapısı ana klasörden alt klasörlere dallanan bir ağaca benzer.',
          visual: {
            kind: 'agac',
            root: { label: 'Okul', icon: 'FolderOpen', term: 'klasor' },
            children: [
              { label: 'Bilişim', items: ['odev.docx', 'sunum.pptx'], term: 'alt-klasor' },
              { label: 'Fen', items: ['deney.jpg'], term: 'alt-klasor' },
              { label: 'Türkçe', items: ['kitap-ozeti.docx'], term: 'alt-klasor' },
            ],
          },
        },
        {
          kind: 'anlatim',
          title: 'Dosya yolu',
          body:
            'Bir dosyanın bilgisayardaki tam adresine **dosya yolu** denir. Yol, dosyaya ulaşmak için hangi klasörlerin içinden geçildiğini gösterir.\n\n' +
            'İşletim sisteminde **Masaüstü, Belgelerim, İndirilenler** ve **Resimler** gibi hazır klasörler de vardır.',
          visual: {
            kind: 'parcala',
            caption: 'C:\\Kullanıcılar\\Belgelerim\\Okul\\odev.docx',
            parts: [
              { text: 'C:', label: 'Sürücü' },
              { text: 'Kullanıcılar', label: 'Klasör' },
              { text: 'Belgelerim', label: 'Klasör' },
              { text: 'Okul', label: 'Alt klasör' },
              { text: 'odev.docx', label: 'Dosya' },
            ],
          },
        },
        {
          kind: 'anlatim',
          title: 'Depolama birimleri ve bulut',
          misconception: { wrong: 'Bulutta saklanan dosyalar her durumda güvendedir.', right: 'Bulut, güçlü şifre ve hesap güvenliği ister; şifren zayıfsa dosyaların da risktedir.' },
          body:
            'Dosyalar fiziksel aygıtlarda ya da internetteki sunucularda ([[bulut depolama|bulut-depolama]]) saklanabilir. Bulut, dosyalara farklı cihazlardan erişim sağlar; ama güçlü şifre ve hesap güvenliği ister.\n\n' +
            'Kapasite **bayt** ile ölçülür. Küçükten büyüğe: bayt, KB, MB, GB, TB. Her birim bir öncekinin yaklaşık 1000 (tam olarak 1024) katıdır.',
          visual: {
            kind: 'kartlar',
            cards: [
              { icon: 'HardDrive', title: 'Sabit disk / SSD' },
              { icon: 'Usb', title: 'USB bellek' },
              { icon: 'MemoryStick', title: 'Hafıza kartı' },
              { icon: 'Cloud', title: 'Bulut depolama', term: 'bulut-depolama' },
            ],
          },
        },
        {
          kind: 'eslestirme',
          prompt: 'Dosyaları doğru klasöre yerleştir.',
          visual: {
            kind: 'agac',
            root: { label: 'Belgelerim', icon: 'FolderOpen' },
            children: [{ label: 'Ödevler' }, { label: 'Resimler' }, { label: 'Müzikler' }],
          },
          targets: ['Ödevler', 'Resimler', 'Müzikler'],
          items: [
            { text: 'fen-raporu.docx', target: 0 },
            { text: 'tatil.jpg', target: 1 },
            { text: 'marş.mp3', target: 2 },
            { text: 'tarih-sunumu.pptx', target: 0 },
            { text: 'okul-gezisi.png', target: 1 },
            { text: 'ninni.mp3', target: 2 },
          ],
          explanation: 'Dosyaları türüne ve konusuna göre alt klasörlere ayırmak aradığını hızla bulmanı sağlar.',
        },
        {
          kind: 'siralama',
          prompt: 'Kapasite birimlerini küçükten büyüğe sırala.',
          items: ['Bayt', 'Kilobayt (KB)', 'Megabayt (MB)', 'Gigabayt (GB)', 'Terabayt (TB)'],
          explanation: 'Her birim bir öncekinin yaklaşık 1000 katıdır: bayt → KB → MB → GB → TB.',
        },
        { kind: 'soru', questionId: 6697 },
        { kind: 'soru', questionId: 6699 },
        { kind: 'soru', questionId: 6701 },
        {
          kind: 'klasik',
          prompt: 'Okul dosyalarını düzenli tutmak için nasıl bir klasör yapısı kurarsın? Bir ana klasör ve en az iki alt klasör yazarak açıkla.',
          modelAnswer:
            'Örneğin "Okul" adında bir ana klasör açılır. İçine "Bilişim", "Fen" gibi ders adlarıyla alt klasörler oluşturulur. Her dersin dosyaları kendi alt klasörüne kaydedilir; böylece dosyalar kolay bulunur.',
        },
      ],
    },
    {
      sectionId: 1389,
      title: 'Dosya ve klasör işlemleri',
      steps: [
        {
          kind: 'anlatim',
          title: 'Temel işlemler',
          body: 'Dosya ve klasör işlemleri Windows\'ta **Dosya Gezgini** ile yapılır. Çoğunu sağ tık menüsünden ya da kısayol tuşlarıyla yapabilirsin.',
          visual: {
            kind: 'kartlar',
            cards: [
              { icon: 'FolderPlus', title: 'Yeni klasör', tag: 'Ctrl + Shift + N', text: 'ya da sağ tık → Yeni' },
              { icon: 'Pencil', title: 'Yeniden adlandır', tag: 'F2' },
              { icon: 'Copy', title: 'Kopyala', tag: 'Ctrl + C → Ctrl + V', text: 'Asıl dosya yerinde kalır' },
              { icon: 'FolderInput', title: 'Taşı', tag: 'Ctrl + X → Ctrl + V', text: 'Dosyanın yeri değişir' },
              { icon: 'Trash2', title: 'Sil', tag: 'Delete', text: 'Geri Dönüşüm Kutusu\'na gider' },
              { icon: 'Undo2', title: 'Geri al', tag: 'Ctrl + Z', text: 'Son işlemi geri alır' },
            ],
          },
        },
        {
          kind: 'anlatim',
          title: 'Öge seçme yöntemleri',
          visual: {
            kind: 'tablo',
            columns: ['Yöntem', 'Ne seçer?'],
            rows: [
              ['Tek tık', 'Tek bir ögeyi'],
              ['Ctrl + tık', 'Birbirinden ayrı ögeleri tek tek'],
              ['Shift + tık', 'İlk ve son tıklanan arasındaki hepsini'],
              ['Ctrl + A', 'Klasördeki bütün ögeleri'],
            ],
          },
        },
        {
          kind: 'anlatim',
          title: 'Silme, geri yükleme ve arama',
          predict: { question: "Sence Delete tuşuyla sildiğin dosya nereye gider?", options: ['Tamamen yok olur', "Geri Dönüşüm Kutusu'na gider", 'Masaüstüne taşınır'], answer: 1 },
          misconception: { wrong: 'Delete ile silinen dosya bir daha kurtarılamaz.', right: "Geri Dönüşüm Kutusu'ndan geri yüklenebilir. Kalıcı silme Shift + Delete ile olur." },
          body:
            '**Shift + Delete** ya da [[Geri Dönüşüm Kutusu|geri-donusum-kutusu]]\'nu boşaltmak dosyayı **kalıcı** olarak siler.\n\n' +
            'Arama çubuğuna dosya adının bir kısmını ya da *.pdf gibi bir uzantı kalıbı yazarak hızlı arama yapılır. Sağ tık → **Özellikler** dosyanın boyutunu, türünü ve tarihini gösterir.',
          visual: {
            kind: 'akis',
            steps: [
              { label: 'Delete ile sil', icon: 'Trash2' },
              { label: 'Geri Dönüşüm Kutusu', icon: 'Recycle', term: 'geri-donusum-kutusu' },
              { label: 'Sağ tık → Geri Yükle', icon: 'Undo2' },
            ],
          },
        },
        {
          kind: 'eslestirme',
          prompt: 'Her kısayolu yaptığı işle eşleştir.',
          targets: ['Kopyala', 'Kes (taşı)', 'Yapıştır', 'Geri al', 'Tümünü seç', 'Yeniden adlandır', 'Kalıcı sil'],
          items: [
            { text: 'Ctrl + C', target: 0 },
            { text: 'Ctrl + X', target: 1 },
            { text: 'Ctrl + V', target: 2 },
            { text: 'Ctrl + Z', target: 3 },
            { text: 'Ctrl + A', target: 4 },
            { text: 'F2', target: 5 },
            { text: 'Shift + Delete', target: 6 },
          ],
          explanation: 'Kopyalamada asıl dosya yerinde kalır, kesip yapıştırmada (taşıma) yeri değişir. Shift + Delete Geri Dönüşüm Kutusu\'na uğramadan siler.',
        },
        {
          kind: 'dogru_yanlis',
          prompt: 'İfadeleri Doğru ya da Yanlış olarak işaretle.',
          statements: [
            { text: 'Kopyalama işleminde dosya eski yerinden kaldırılır.', correct: false, note: 'Kopyalamada asıl dosya yerinde kalır; yeri değişen işlem taşımadır.' },
            { text: 'Delete ile silinen dosya Geri Dönüşüm Kutusu\'ndan geri yüklenebilir.', correct: true, note: 'Sağ tık → Geri Yükle ile kurtarılır.' },
            { text: 'Shift + Delete ile silinen dosya Geri Dönüşüm Kutusu\'na gider.', correct: false, note: 'Shift + Delete dosyayı kalıcı olarak siler.' },
            { text: 'Arama çubuğuna *.pdf yazmak PDF dosyalarını bulur.', correct: true, note: 'Uzantı kalıbıyla aynı türdeki dosyalar aranabilir.' },
          ],
        },
        { kind: 'soru', questionId: 6705 },
        { kind: 'soru', questionId: 6707 },
        { kind: 'soru', questionId: 6708 },
        {
          kind: 'klasik',
          prompt: 'Kopyalama ile taşıma arasındaki farkı, dosyanın ilk bulunduğu yerde ne olduğunu düşünerek açıkla.',
          modelAnswer:
            'Kopyalamada dosya ilk yerinde kalır ve yeni konumda bir kopyası oluşur (Ctrl + C, Ctrl + V). Taşımada dosya ilk yerinden kaldırılıp yeni konuma aktarılır (Ctrl + X, Ctrl + V).',
        },
      ],
    },
    {
      sectionId: 1390,
      title: 'Sıkıştırma ve verimlilik',
      steps: [
        {
          kind: 'anlatim',
          title: 'Dosya sıkıştırma',
          predict: { question: 'Sence hangi dosya sıkıştırılınca daha çok küçülür?', options: ['Metin belgesi', 'Fotoğraf', 'Video'], answer: 0 },
          body:
            'Dosyaların kapladığı alanı küçültüp tek bir arşiv dosyasına dönüştürmeye [[sıkıştırma|dosya-sikistirma]] denir. Yaygın formatlar **.zip, .rar** ve **.7z**\'dir. Arşivi açmak için sağ tık → **Tümünü Ayıkla** seçilir. Arşive şifre de verilebilir.\n\n' +
            'Metin belgeleri ve hesap tabloları çok küçülür; resim, ses ve video dosyaları ise az küçülür.',
          visual: {
            kind: 'akis',
            steps: [
              { label: 'Dosyaları seç', icon: 'MousePointerClick' },
              { label: 'Sağ tık', icon: 'Mouse' },
              { label: 'Sıkıştırılmış klasöre gönder', icon: 'Archive', term: 'dosya-sikistirma' },
              { label: '.zip arşivi hazır', icon: 'Package' },
            ],
          },
        },
        {
          kind: 'anlatim',
          title: 'Sıkıştırma neden işe yarar?',
          body: 'Düzenli çalışırken **dijital etik** kurallarına da uy: başkasının dosyalarını izinsiz kopyalama, değiştirme ya da silme.',
          visual: {
            kind: 'kartlar',
            cards: [
              { icon: 'HardDrive', title: 'Depolama alanı', text: 'Diskte ve bulutta daha az yer kaplar.' },
              { icon: 'Zap', title: 'İletim hızı', text: 'İnternetten daha hızlı gider, veri kotası korunur.' },
              { icon: 'Package', title: 'Organizasyon', text: 'Onlarca dosya tek pakette, karmaşa yok.' },
            ],
          },
        },
        {
          kind: 'anlatim',
          title: 'Sıkıştırma ve tasarruf oranı',
          body:
            '**Sıkıştırma oranı** = sıkıştırılmış boyut ÷ özgün boyut × 100\n**Tasarruf oranı** = kazanılan alan ÷ özgün boyut × 100\n\n' +
            '100 MB\'lık bir klasör 60 MB\'a düşerse sıkıştırma oranı **%60**, kazanılan alan 40 MB olduğundan tasarruf oranı **%40** olur.',
          visual: {
            kind: 'tablo',
            columns: ['Örnek', 'Değer'],
            rows: [
              ['Özgün boyut', '100 MB'],
              ['Sıkıştırılmış boyut', '60 MB'],
              ['Sıkıştırma oranı', '%60'],
              ['Kazanılan alan', '40 MB'],
              ['Tasarruf oranı', '%40'],
            ],
          },
        },
        {
          kind: 'coklu_secim',
          prompt: 'Sıkıştırınca hangileri ÇOK küçülür? Hepsini seç.',
          options: [
            { text: 'rapor.docx', icon: 'FileText', correct: true },
            { text: 'tatil.jpg', icon: 'Image', correct: false },
            { text: 'notlar.txt', icon: 'FileText', correct: true },
            { text: 'şarkı.mp3', icon: 'Music', correct: false },
            { text: 'liste.xlsx', icon: 'Sheet', correct: true },
            { text: 'film.mp4', icon: 'Clapperboard', correct: false },
          ],
          explanation: 'Metin belgesi ve hesap tablosu çok küçülür. Resim, ses ve video zaten sıkıştırılmış biçimde olduğu için az küçülür.',
        },
        {
          kind: 'bosluk',
          prompt: '200 MB\'lık bir klasör sıkıştırılınca 50 MB oldu. Boşlukları doldur.',
          text: 'Sıkıştırma oranı {0} olur. Kazanılan alan 150 MB olduğu için tasarruf oranı {1} olur.',
          answers: ['%25', '%75'],
          distractors: ['%50', '%150'],
          explanation: '50 ÷ 200 × 100 = %25 sıkıştırma oranı; 150 ÷ 200 × 100 = %75 tasarruf oranı.',
        },
        { kind: 'soru', questionId: 6710 },
        { kind: 'soru', questionId: 6712 },
        { kind: 'soru', questionId: 6714 },
        {
          kind: 'klasik',
          prompt: 'Arkadaşına 30 belgeyi e-postayla göndereceksin. Dosyaları sıkıştırıp tek arşiv olarak göndermek sana hangi iki yönden fayda sağlar?',
          modelAnswer:
            'Organizasyon: 30 dosya tek bir pakette gider, karışıklık olmaz. İletim hızı: boyut küçüldüğü için daha hızlı gönderilir ve veri kotası korunur. (Depolama alanından tasarruf da kabul edilir.)',
        },
      ],
    },
  ],
};
