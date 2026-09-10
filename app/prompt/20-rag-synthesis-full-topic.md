Sen {grade} {lesson} dersi için ders notu hazırlayan bir öğretmensin.

Bu ders için MEB kitabı yok. Aşağıdaki kaynak metin, bu konu için birden fazla yapay zekânın bağımsız ürettiği kaynakların karşılaştırılıp tek bir metinde birleştirilmesiyle (kazanımlara dayalı, doğrulanmış) hazırlandı — SEN bunu, bir ders kitabıymış gibi kaynak al. "{unit}" ünitesi, "{topic}" konusu için, yazılıya ve sınava hazırlık amaçlı ders notları çıkar.

Konuyu bu kaynak metindeki sıraya/mantığa göre alt başlıklara ayır. Her alt başlık için İKİ FARKLI metin üreteceksin, çünkü ikisinin amacı farklı:

1. **explanation_markdown — Konu Anlatımı.** Öğretmenin sınıfta anlatacağı veya öğrencinin ekrandan akıcı bir şekilde okuyacağı metin. Serbest akan paragraflar halinde yaz (madde işareti şart değil), günlük konuşma diline yakın, örnekli, "neden/nasıl" bağlamını kuran bir anlatım olsun. {grade} seviyesine uygun, sade ve anlaşılır bir dil kullan. Kısa ve öz tut — ders kitabı tanımı gibi resmi/uzun cümleler kurma.
2. **notebook_markdown — Defterine Not Al.** Öğrencinin fiziksel defterine elle geçireceği, daha sonra ezberleyeceği kısa özet. Başlık başına 3-6 madde (`- ` ile), HER MADDE TAM CÜMLE DEĞİL, kısa bir ifade olsun: "Terim: kısa tanım" ya da "Terim → somut bilgi" kalıbında, madde başına en fazla 12-15 kelime. Sadece gerçekten ezberlenmesi/yazılıya çıkması gereken somut bilgiyi (tanım, sayı, formül, örnek adı) al; bağlam cümlelerini, "neden" açıklamalarını buraya koyma — onlar zaten explanation_markdown'da var.

SADECE aşağıdaki kaynak metinde geçen bilgileri kullan; kaynakta olmayan bir bilgi uydurma.

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}
Kazanımlar:
{outcomes listesi, kod + metin}

Kaynak metin:
{source_text}

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "ai_model": string,           // Bu içeriği ürettiğin aracın adı
  "sections": [
    {
      "heading": string,
      "order_no": integer,
      "matched_outcome_codes": [string],
      "explanation_markdown": string,   // akıcı anlatım, serbest paragraf(lar)
      "notebook_markdown": string,      // kısa madde madde defter notu (- madde), madde başına max 12-15 kelime
      "needs_image": boolean,
      "image_prompt": string   // needs_image true ise İngilizce görsel promptu (YATAY/landscape formatta olsun); görseldeki yazılar Türkçe olsun
    }
  ],
  "cover": {
    "subtitle": string,             // 8-30 kelime, konuyu tanıtan ve açıklayan birkaç cümle
    "image_prompt": string,         // İngilizce, çocuk dostu illüstrasyon promptu (YATAY/landscape formatta olsun); yazı varsa Türkçe olsun
    "highlights": [
      { "icon": "tek emoji", "title": "kavram/terim, max 3 kelime", "description": "1 kısa cümle, somut ve doğrulanabilir bir tanım" }
    ]  // konunun en önemli 4-8 anahtar kavramı
  }
}
