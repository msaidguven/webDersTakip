module.exports = [
  {
    topicId: 274,
    title: 'Ülkemizin, Kıtaların ve Okyanusların Konum Özellikleri',
    sections: [
      {
        heading: 'Mutlak Konum',
        matched_outcome_codes: ['a'],
        needs_image: true,
        image_prompt:
          "A simple, clear educational map illustration for children showing a stylized world grid with latitude and longitude lines, highlighting Turkey's location with a marker, in a flat, colorful, non-photorealistic map illustration style, with Turkish text labels reading 'Enlem' and 'Boylam' near the respective grid lines.",
        body_markdown: `- **Mutlak konum**: bir yerin enlem ve boylam çizgileriyle belirlenen, değişmeyen kesin konumudur.
- **Enlem**: Ekvator'a göre kuzey-güney konumu; **boylam**: başlangıç meridyenine göre doğu-batı konumudur.
- Türkiye, yaklaşık 36°-42° kuzey enlemleri ile 26°-45° doğu boylamları arasında yer alır.
- Mutlak konum, bir yerin haritada tam olarak nerede olduğunu gösterir ve zamanla değişmez.
- Coğrafi koordinatlar sayesinde dünyanın herhangi bir noktası kesin olarak tarif edilebilir.`,
      },
      {
        heading: 'Göreceli Konum',
        matched_outcome_codes: ['b'],
        needs_image: true,
        image_prompt:
          "A simple, colorful flat-style map illustration for children showing Turkey and its neighboring countries and surrounding seas (Black Sea to the north, Mediterranean Sea to the south, Aegean Sea to the west), in an educational map illustration style, with Turkish text labels reading 'Karadeniz', 'Akdeniz', and 'Ege Denizi' next to the seas.",
        body_markdown: `- **Göreceli konum**: bir yerin başka yerlere, ülkelere veya bölgelere göre tarif edilen konumudur.
- Türkiye; kuzeyde Karadeniz, güneyde Akdeniz, batıda Ege Denizi ile çevrilidir.
- Komşu ülkeler (Yunanistan, Bulgaristan, Gürcistan, Ermenistan, İran, Irak, Suriye), Türkiye'nin göreceli konumunu belirler.
- Türkiye, Asya ile Avrupa kıtaları arasında bir köprü konumundadır.
- Göreceli konum, ulaşım, ticaret ve kültürel ilişkiler açısından büyük önem taşır.`,
      },
      {
        heading: 'Kıtalar ve Okyanuslar',
        matched_outcome_codes: ['c'],
        needs_image: true,
        image_prompt:
          'A simple, colorful flat-style world map illustration for children clearly showing the seven continents and five oceans in different pastel colors, educational cartoon map style, with Turkish text labels for each continent and ocean name.',
        body_markdown: `- Dünya üzerinde 7 kıta bulunur: **Asya**, **Avrupa**, **Afrika**, **Kuzey Amerika**, **Güney Amerika**, **Avustralya**, **Antarktika**.
- Dünya üzerindeki 5 büyük okyanus: **Büyük Okyanus**, **Atlas Okyanusu**, **Hint Okyanusu**, **Güney Okyanusu**, **Kuzey Buz Okyanusu**.
- Kıtalar ve okyanuslar, birbirlerine göre konumlarıyla dünya haritasının temelini oluşturur.
- Türkiye topraklarının büyük kısmı Asya kıtasında, küçük bir kısmı Avrupa kıtasındadır.
- Kıta ve okyanusların konumu, iklim, ticaret yolları ve ulaşım imkânlarını doğrudan etkiler.`,
      },
    ],
    cover: {
      subtitle: "Türkiye'nin mutlak ve göreceli konumunu, dünyadaki kıtaları ve okyanusları haritalarla tanıtıyor.",
      image_prompt:
        'A bright, colorful flat-style illustration for children showing a simplified world map with Turkey highlighted and marked with a small star, surrounded by small icons of a compass, a globe, and ocean waves. Educational illustration style, no photorealism, no text.',
      highlights: [
        { position: 'top-left', icon: '📍', title: 'Mutlak Konum', description: 'Enlem ve boylamla belirlenir' },
        { position: 'top-right', icon: '🧭', title: 'Göreceli Konum', description: 'Komşulara göre tarif edilir' },
        { position: 'mid-left', icon: '🌍', title: '7 Kıta', description: 'Dünyanın büyük kara parçaları' },
        { position: 'mid-right', icon: '🌊', title: '5 Okyanus', description: 'Dünyanın büyük su kütleleri' },
        { position: 'bottom-left', icon: '🇹🇷', title: "Türkiye'nin Yeri", description: 'Asya ile Avrupa arasında köprü' },
      ],
    },
  },
  {
    topicId: 275,
    title: 'Doğal ve Beşerî Çevre Özellikleri Arasındaki İlişki',
    sections: [
      {
        heading: 'Doğal Çevre Özelliklerimiz',
        matched_outcome_codes: ['a'],
        needs_image: true,
        image_prompt:
          "A simple, colorful flat illustration for children showing a landscape cross-section with a mountain, a plain, a river, and a lake, each with a small Turkish text label ('Dağ', 'Ova', 'Akarsu', 'Göl'). Educational, non-photorealistic illustration style, bright natural colors.",
        body_markdown: `- **Doğal çevre**: insan eliyle değil, doğa tarafından oluşan yeryüzü şekilleri ve varlıklardır.
- Türkiye'de dağlar, ovalar, platolar, akarsular, göller ve farklı iklim tipleri doğal çevreyi oluşturur.
- **Yer şekilleri** (dağ, ova, plato), bir bölgenin yüksekliğini ve yüzey biçimini belirler.
- **İklim**, bir bölgedeki sıcaklık ve yağış koşullarının uzun dönemli ortalamasıdır.
- Doğal çevre özellikleri bölgeden bölgeye farklılık gösterir; kıyı, iç bölge ve dağlık alanlar birbirinden ayrılır.`,
      },
      {
        heading: 'Beşerî Çevre Özelliklerimiz',
        matched_outcome_codes: ['a'],
        needs_image: true,
        image_prompt:
          'A simple, colorful flat illustration for children showing a small town scene with houses, a road, a farm field, and a small factory, representing the human-made environment. Educational illustration style, bright colors, no text.',
        body_markdown: `- **Beşerî çevre**: insanların doğa üzerinde meydana getirdiği yerleşim, faaliyet ve yapılardır.
- Şehirler, köyler, yollar, fabrikalar ve tarım alanları beşerî çevrenin örnekleridir.
- İnsanlar; barınma, ulaşım, üretim ve ticaret ihtiyaçları için çevrelerini şekillendirir.
- Nüfus yoğunluğu, sanayileşme ve tarım faaliyetleri beşerî çevrenin önemli göstergeleridir.
- Beşerî çevre, doğal çevrenin sunduğu imkânlara göre zaman içinde değişip gelişir.`,
      },
      {
        heading: 'Doğal ve Beşerî Çevre Arasındaki İlişki',
        matched_outcome_codes: ['b'],
        needs_image: false,
        image_prompt: null,
        body_markdown: `- Doğal çevre özellikleri, insanların nerede ve nasıl yaşayacağını doğrudan etkiler.
- Verimli ovalarda tarım, akarsu kenarlarında yerleşim, düz arazilerde ise sanayi daha çok gelişir.
- Dağlık ve engebeli alanlarda yerleşim ve ulaşım genellikle daha zor ve sınırlıdır.
- İklim koşulları; giyim, konut yapısı ve yetiştirilen tarım ürünlerini etkiler.
- Doğal çevre insan faaliyetlerini şekillendirirken, insan faaliyetleri de zamanla doğal çevreyi değiştirebilir.`,
      },
    ],
    cover: {
      subtitle: 'Ülkemizdeki dağ, ova ve iklim gibi doğal özelliklerin; yerleşim ve tarım gibi beşerî faaliyetlerle ilişkisini anlatıyor.',
      image_prompt:
        'A warm, colorful flat illustration for children showing a split landscape: one half with natural features like mountains, a river, and a lake, the other half with a small town, farmland, and roads, connected by a winding path to show their relationship. Educational illustration style, no photorealism, no text.',
      highlights: [
        { position: 'top-left', icon: '⛰️', title: 'Doğal Çevre', description: 'Dağ, ova, iklim, sular' },
        { position: 'top-right', icon: '🏘️', title: 'Beşerî Çevre', description: 'Yerleşim, tarım, sanayi' },
        { position: 'mid-left', icon: '🌾', title: 'Verimli Ovalar', description: 'Tarıma elverişli düz alanlar' },
        { position: 'mid-right', icon: '🔗', title: 'Karşılıklı Etki', description: 'Doğa insanı, insan doğayı etkiler' },
      ],
    },
  },
  {
    topicId: 276,
    title: 'Ülkemizin Türk Dünyasıyla Kültürel İş birlikleri',
    sections: [
      {
        heading: 'Türk Dünyası Nedir?',
        matched_outcome_codes: ['a'],
        needs_image: true,
        image_prompt:
          'A simple, colorful flat-style map illustration for children highlighting Turkey and the Turkic-speaking countries of Central Asia (Azerbaijan, Kazakhstan, Uzbekistan, Kyrgyzstan, Turkmenistan) in a matching color, connected by soft dashed lines to show cultural connection. Educational map illustration style, no text.',
        body_markdown: `- **Türk dünyası**: Türkçenin farklı lehçeleriyle konuşulduğu, ortak tarih ve kültüre sahip ülke ve toplulukların tümüdür.
- Azerbaycan, Kazakistan, Özbekistan, Kırgızistan ve Türkmenistan, Türk dünyasının önemli ülkeleridir.
- Bu ülkelerin çoğu, tarihte aynı coğrafyadan (Türkistan) farklı yönlere göç etmiş Türk topluluklarından gelir.
- Ortak dil kökü, benzer gelenekler ve tarihî bağlar, Türk dünyası ülkelerini birbirine yakınlaştırır.
- Türkiye, Türk dünyasıyla siyasi, ekonomik ve özellikle kültürel alanlarda yakın ilişkiler kurar.`,
      },
      {
        heading: 'Kültürel İş Birliği Örnekleri',
        matched_outcome_codes: ['b'],
        needs_image: true,
        image_prompt:
          'A warm, colorful flat illustration for children showing a cultural festival scene with performers in traditional Central Asian and Turkish costumes, a stage with flags of different Turkic countries, and an audience enjoying music and dance. Educational, friendly illustration style, no photorealism, no text.',
        body_markdown: `- **TÜRKSOY**, Türk dünyası ülkeleri arasında kültür ve sanat alanında iş birliğini geliştiren uluslararası bir kurumdur.
- Ortak film, müzik ve tiyatro festivalleri, Türk dünyası ülkelerinin kültürlerini bir araya getirir.
- Öğrenci ve öğretmen değişim programları, gençlerin birbirinin kültürünü tanımasını sağlar.
- Ortak tarih ve edebiyat kitapları, kültürel mirasın birlikte kayıt altına alınmasına katkı sunar.
- "Türk Dünyası Kültür Başkenti" gibi projeler, şehirleri kültürel iş birliğinin merkezi hâline getirir.`,
      },
      {
        heading: 'Bu İş Birliklerinin Önemi',
        matched_outcome_codes: ['c'],
        needs_image: false,
        image_prompt: null,
        body_markdown: `- Kültürel iş birlikleri, Türk dünyası ülkeleri arasındaki dostluk ve dayanışmayı güçlendirir.
- Ortak kültürel etkinlikler, gelecek nesillerin ortak tarih ve değerleri tanımasını sağlar.
- Bu iş birlikleri, dil ve kültürün yok olmadan yaşatılmasına katkıda bulunur.
- Kültürel yakınlaşma, ülkeler arasındaki ekonomik ve siyasi iş birliğine de zemin hazırlar.
- Türk dünyasıyla kurulan bu bağlar, Türkiye'nin uluslararası alandaki etkisini de güçlendirir.`,
      },
    ],
    cover: {
      subtitle: "Türkiye'nin Azerbaycan'dan Kazakistan'a Türk dünyası ülkeleriyle kurduğu kültürel bağları ve iş birliklerini tanıtıyor.",
      image_prompt:
        'A bright, colorful flat illustration for children showing children in traditional costumes from different Turkic countries holding hands in a circle, with small flags of Turkey, Azerbaijan, Kazakhstan, and Uzbekistan around them. Educational, friendly illustration style, no photorealism, no text.',
      highlights: [
        { position: 'top-left', icon: '🌏', title: 'Türk Dünyası', description: 'Ortak dil ve kültüre sahip ülkeler' },
        { position: 'top-right', icon: '🎭', title: 'TÜRKSOY', description: 'Kültür ve sanatta iş birliği' },
        { position: 'mid-left', icon: '🎓', title: 'Değişim Programları', description: 'Öğrenciler kültürleri tanır' },
        { position: 'mid-right', icon: '🤝', title: 'Dostluk ve Dayanışma', description: 'Ülkeleri birbirine yakınlaştırır' },
      ],
    },
  },
];
