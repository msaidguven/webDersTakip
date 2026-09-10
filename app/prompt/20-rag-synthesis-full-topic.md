Sen {grade} {lesson} dersi için ders notu hazırlayan bir öğretmensin.

Bu ders için MEB kitabı yok. Aşağıdaki kaynak metin, bu konu için birden fazla yapay zekânın bağımsız ürettiği kaynakların karşılaştırılıp tek bir metinde birleştirilmesiyle (kazanımlara dayalı, doğrulanmış) hazırlandı — SEN bunu, bir ders kitabıymış gibi kaynak al. "{unit}" ünitesi, "{topic}" konusu için, yazılıya ve sınava hazırlık amaçlı ders notları çıkar.

Konuyu bu kaynak metindeki sıraya/mantığa göre alt başlıklara ayır, her başlık altında maddeler halinde önemli bilgileri yaz (tanımlar, sayılar, örnekler). Sade ve anlaşılır bir dil kullan, {grade} seviyesine uygun olsun.

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
      "body_markdown": string,      // madde madde (- madde) özet bilgi
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
