module.exports = {
  topicId: 283,
  title: 'Dijitalleşme ve Teknolojik Gelişmelerin Vatandaşlık Hak ve Sorumluluklarına Etkileri',
  sections: [
    {
      heading: 'Devlet Hizmetlerine Parmaklarının Ucuyla Erişim',
      matched_outcome_codes: ['a'],
      needs_image: true,
      image_prompt:
        'A simple, modern flat illustration for children showing a person using a smartphone to access a government services app, with icons like a document, a checkmark, and a digital ID card floating around the screen. Educational, friendly illustration style, bright colors, no text.',
      body_markdown: `- **Dijital vatandaşlık**, teknolojiyi bilinçli, güvenli ve sorumlu şekilde kullanabilme becerisidir.
- **e-Devlet kapısı** üzerinden öğrenci belgesi, nüfus kayıt örneği ve adli sicil kaydı gibi birçok resmî belge kolayca alınabilir.
- Vatandaşlar, kurumlara gitmeden randevu alabilir, başvuru yapabilir ve başvurusunun durumunu takip edebilir.
- E-imza ve dijital kimlik gibi uygulamalar, resmî işlemleri hızlandırıp güvenli hâle getirir.
- Teknolojik gelişmeler, devlet ile vatandaş arasındaki iletişimi hem hızlandırmış hem şeffaflaştırmıştır.`,
    },
    {
      heading: 'Dijital Ortamda Sahip Olduğumuz Haklar',
      matched_outcome_codes: ['b', 'c'],
      needs_image: false,
      image_prompt: null,
      body_markdown: `- İnternet ortamında da **ifade özgürlüğü**, **bilgiye erişim hakkı** ve **kişisel verilerin korunması hakkı** geçerlidir.
- **KVKK (Kişisel Verilerin Korunması Kanunu)**, ad, adres ve fotoğraf gibi bilgilerin izinsiz kullanılmasını engeller.
- Herkesin, güvenilir kaynaklardan bilgiye erişme ve görüşünü özgürce paylaşma hakkı vardır.
- Bir konu hakkında araştırma yaparken doğru sorular sormak, güvenilir bilgiye ulaşmayı kolaylaştırır.
- Bu haklar, dijital dünyada da kişilerin güvenliğini ve özgürlüğünü korumayı amaçlar.`,
    },
    {
      heading: 'Doğru Bilgiyle Sorumlu Bir Dijital Vatandaş Olmak',
      matched_outcome_codes: ['ç', 'd'],
      needs_image: true,
      image_prompt:
        'A simple, friendly flat illustration for children showing a smartphone screen protected by a shield icon, with small icons around it representing a lock (password) and a magnifying glass (checking facts). Educational illustration style, bright colors, no text.',
      body_markdown: `- İnternette paylaşılan bilgilerin **güncelliğini** ve **bilimselliğini** kontrol etmek her kullanıcının sorumluluğudur.
- Doğrulanmamış bir haberi hızlıca paylaşmak, yanlış bilginin (dezenformasyonun) kısa sürede yayılmasına yol açabilir.
- Şifreleri kimseyle paylaşmamak ve tanımadığın bağlantılara tıklamamak, temel siber güvenlik kurallarındandır.
- Başkalarına dijital ortamda da saygılı davranmak, siber zorbalığı önlemenin en etkili yoludur.
- Bir bilgiden doğru çıkarım yapabilmek için farklı kaynakları karşılaştırıp güvenilirliğini sorgulamak gerekir.`,
    },
  ],
  cover: {
    subtitle: "e-Devlet'ten KVKK'ya, dijitalleşmenin vatandaşlık haklarımızı ve internet sorumluluklarımızı nasıl etkilediğini anlatıyor.",
    image_prompt:
      'A warm, modern flat illustration for children showing a diverse group of people using phones and tablets connected to a central glowing digital network icon shaped like a government building, symbolizing digital citizenship. Educational illustration style, no photorealism, no text.',
    highlights: [
      { position: 'top-left', icon: '💻', title: 'E-Devlet', description: 'İşlemleri online yapma imkânı' },
      { position: 'top-right', icon: '🔒', title: 'KVKK', description: 'Kişisel verileri koruyan kanun' },
      { position: 'mid-left', icon: '🔍', title: 'Bilgiyi Doğrula', description: 'Güncel ve bilimsel mi kontrol et' },
      { position: 'mid-right', icon: '🛡️', title: 'Siber Güvenlik', description: 'Şifreni ve verini koru' },
    ],
  },
};
