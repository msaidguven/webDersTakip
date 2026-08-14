module.exports = {
  topicId: 438,
  title: 'Dijital Ortamlarda Gizlilik ve Güvenlik',
  sections: [
    {
      heading: 'Dijital Ortamlarda Gizlilik ve Güvenlik Riskleri',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a smartphone and laptop screen surrounded by warning risk icons: a broken padlock, a spider-like spyware bug, a fake email envelope with an exclamation mark, and a pin location icon with a question mark, bright friendly colors, with Turkish text labels reading 'Veri Sızıntısı', 'Kötü Amaçlı Yazılım' and 'Sahte Hesap' next to the relevant icons, no photorealism.",
      body_markdown: `- **Kişisel veri sızıntısı**: ad, adres ve telefon numarası gibi bilgilerin izinsiz olarak üçüncü kişilerin eline geçmesidir.
- **Zayıf parola riski**: "123456" veya doğum yılı gibi kısa ve tahmin edilebilir parolalar saniyeler içinde kırılabilir.
- **Kötü amaçlı yazılım**: virüs ve casus yazılım, cihaza gizlice bulaşarak kişisel bilgileri çalabilir.
- **Sahte hesap**: gerçek kimliği gizleyen profiller, dolandırıcılık veya bilgi toplama amacıyla kullanılabilir.
- **Canlı konum paylaşımı**: bazı uygulamalar kullanıcının o anki bulunduğu yeri tanımadığı kişilere gösterebilir.
- **Güvensiz kablosuz ağ**: şifresiz Wi-Fi ağlarında veri trafiği başka kişiler tarafından izlenebilir.
- **Aşırı bilgi paylaşımı**: tatil planı veya ev adresi gibi ayrıntıların paylaşılması hırsızlık riskini artırır.`,
    },
    {
      heading: 'Kişisel Veri ve Gizlilik Bileşenleri',
      matched_outcome_codes: ['c'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a large shield divided into three labeled sections, each with a small icon: a padlock, a checkmark, and a clock, bright friendly colors, with Turkish text labels reading 'Gizlilik', 'Bütünlük' and 'Erişilebilirlik' on each section of the shield, no photorealism.",
      body_markdown: `- **Kişisel veri**: ad-soyad, TC kimlik numarası, ev adresi, fotoğraf ve konum gibi bir kişiyi tanımlayan bilgilerdir.
- **Gizlilik ayarları**: paylaşımların "herkese açık", "arkadaşlar" veya "sadece ben" seçenekleriyle kimler tarafından görüleceğini belirler.
- **Uygulama izni**: bir oyun uygulamasının konuma erişim istemesi, o anki yerin uygulama sahibiyle paylaşılması anlamına gelir.
- **Hesap gizliliği**: "gizli" olarak ayarlanan bir profildeki paylaşımları yalnızca onaylanan takipçiler görebilir.
- **Şifreleme**: verinin özel bir kodla değiştirilip yalnızca doğru anahtara sahip kişi tarafından okunabilir hâle getirilmesidir.
- **Gizlilik politikası**: bir uygulamanın hangi verileri topladığını ve üçüncü kişilerle paylaşıp paylaşmadığını açıklayan metindir.
- **Bilgi güvenliğinin temel bileşenleri**: gizlilik (veriye kimin erişebileceği), bütünlük (verinin değiştirilmemesi) ve erişilebilirlik (veriye ihtiyaç anında ulaşılabilmesi) olmak üzere üçe ayrılır.`,
    },
    {
      heading: 'Güçlü Parola ve Hesap Güvenliği Önlemleri',
      matched_outcome_codes: ['b'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a smartphone screen with a password strength meter going from red to green, next to it a second phone displaying a six-digit verification code, bright friendly colors, with Turkish text labels reading 'Zayıf', 'Güçlü' and 'Doğrulama Kodu', no photorealism.",
      body_markdown: `- **Güçlü parola kuralı**: en az 8 karakter uzunluğunda olmalı, büyük-küçük harf, rakam ve özel karakter (@, #, !) içermelidir.
- **Parola çeşitliliği**: her hesapta farklı parola kullanılmalıdır; aynı parola birden fazla hesapta kullanılırsa tek bir sızıntı tüm hesapları riske atar.
- **İki adımlı doğrulama (2FA)**: parolaya ek olarak telefona gelen tek kullanımlık kod istenerek hesaba ikinci bir güvenlik katmanı eklenir.
- **Kişisel bilgi kullanmama**: doğum tarihi, isim veya okul adı gibi kolayca tahmin edilebilen bilgiler parolada kullanılmamalıdır.
- **Parola paylaşmama**: parola en yakın arkadaşla bile paylaşılmamalı, ekranda görünür şekilde not edilmemelidir.
- **Otomatik oturum kapatma**: ortak kullanılan bir bilgisayarda işlem bitince hesaptan çıkış yapılmalıdır, aksi hâlde sonraki kullanıcı hesaba erişebilir.
- **Şüpheli giriş bildirimi**: birçok platform, hesaba farklı bir cihazdan giriş yapıldığında kullanıcıya anında bildirim gönderir.`,
    },
    {
      heading: 'Oltalama (Phishing) ve Sahte Bağlantıları Tanıma',
      matched_outcome_codes: ['a', 'ç'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a smartphone screen with a fake message bubble containing a suspicious link and a fishing hook icon pulling at a small padlock, bright friendly colors, with Turkish text labels reading 'Tebrikler, 1000 TL Kazandınız!' inside the fake message bubble and 'Şüpheli Bağlantı' next to the hook, no photorealism.",
      body_markdown: `- **Oltalama (phishing)**: gerçek bir kurumu taklit eden sahte e-posta veya mesajlarla kişisel bilgi ya da parola çalma girişimidir.
- **Sahte bağlantı belirtisi**: web adresinin normalden farklı yazılması (ör. "instagrarn.com") veya "https" yerine "http" ile başlaması şüphe uyandırmalıdır.
- **Ödül tuzağı**: "1000 TL kazandınız, tıklayın" gibi mesajlar genellikle kişisel bilgi veya parola çalmayı hedefler.
- **Aciliyet baskısı**: "hesabınız 1 saat içinde kapatılacak" gibi ifadeler, kullanıcıyı düşünmeden tıklamaya yönlendirmek için kullanılır.
- **Bağlantı doğrulama adımı**: bilinmeyen bir bağlantıya tıklamadan önce gönderenin kimliği ve adresin doğruluğu kontrol edilmelidir.
- **Durum değerlendirmesi**: tanımadık bir numaradan gelen mesajda kişisel bilgi istenirse, bilgi paylaşılmadan önce mesajın kaynağı sorgulanmalıdır.
- **Bildirme adımı**: şüpheli bir bağlantı veya mesajla karşılaşıldığında platformun "şikayet et" ya da "bildir" seçeneği kullanılmalıdır.`,
    },
    {
      heading: 'Siber Zorbalığa Karşı Alınacak Önlemler',
      matched_outcome_codes: ['b', 'ç'],
      needs_image: true,
      image_prompt:
        "A simple flat educational illustration for children showing a smartphone screen with a chat app interface highlighting a 'block' button and a 'report' button, with a small shield icon protecting the phone, bright friendly colors, with Turkish text labels reading 'Engelle' and 'Şikayet Et' on the buttons, no photorealism.",
      body_markdown: `- **Siber zorbalık**: dijital ortamda tekrar eden şekilde rahatsız edici mesaj, alay veya tehdit gönderilmesidir.
- **Engelleme (block)**: rahatsız edici mesaj gönderen bir hesap, uygulamanın "engelle" seçeneğiyle bir daha iletişim kuramaz hâle getirilir.
- **Kanıt saklama**: rahatsız edici mesajların ekran görüntüsü alınarak platforma veya yetkili kişilere bildirim sırasında kullanılmak üzere saklanmalıdır.
- **Bildirme mekanizması**: sosyal medya platformlarının çoğunda "şikayet et" seçeneğiyle zorbalık içerikli hesap veya mesaj bildirilebilir.
- **Yetişkine haber verme**: yaşanan bir siber zorbalık durumu ebeveyne, öğretmene veya okul rehberlik servisine mutlaka bildirilmelidir.
- **Kişi listesi denetimi**: tanınmayan kişilerin arkadaş veya takipçi listesinden çıkarılması, istenmeyen iletişimi önleyen bir gizlilik önlemidir.
- **Durum değerlendirmesi**: bir mesajın tekrar edip etmediğine, rahatsızlık verip vermediğine ve kimden geldiğine bakılarak zorbalık olup olmadığına karar verilmelidir.`,
    },
  ],
  cover: {
    subtitle:
      'Dijital ortamlarda karşılaşılabilecek gizlilik ve güvenlik risklerini, bunlara karşı alınacak önlemleri keşfediyoruz.',
    image_prompt:
      "A bright, friendly flat educational illustration for children showing a child sitting safely at a laptop, surrounded by protective icons: a padlock, a shield, a warning triangle over a suspicious email icon, and a magnifying glass over a phone screen, simple classroom-style illustration, with Turkish text labels reading 'Parola', 'Gizlilik' and 'Güvenlik' next to the relevant icons, no photorealism.",
    highlights: [
      { position: 'top-left', icon: '🔒', title: 'Güçlü Parola', description: 'En az 8 karakter, harf+rakam+sembol' },
      { position: 'top-right', icon: '🎣', title: 'Oltalama', description: 'Sahte link ve mesajla bilgi çalma' },
      { position: 'mid-left', icon: '👤', title: 'Kişisel Veri', description: 'Ad, adres, fotoğraf, konum bilgisi' },
      { position: 'mid-right', icon: '📲', title: '2 Adımlı Doğrulama', description: 'Parolaya ek SMS/kod kontrolü' },
      { position: 'bottom-left', icon: '🚫', title: 'Siber Zorbalık', description: 'Tekrarlayan rahatsız edici mesajlar' },
      { position: 'bottom-right', icon: '⚙️', title: 'Gizlilik Ayarları', description: 'Paylaşımı görebilecekleri belirleme' },
    ],
  },
};
