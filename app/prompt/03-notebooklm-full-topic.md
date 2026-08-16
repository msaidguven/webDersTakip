Sen {grade} {lesson} dersi için ders notu hazırlayan bir öğretmensin.

Yüklediğim ders kitabını kaynak al. "{unit}" ünitesi, "{topic}" konusu için, yazılıya ve sınava hazırlık amaçlı ders notları çıkar.

Konuyu kitaptaki sıraya göre alt başlıklara ayır, her başlık altında maddeler halinde önemli bilgileri yaz (tanımlar, sayılar, örnekler). Sade ve anlaşılır bir dil kullan, {grade} seviyesine uygun olsun.

kitapta geçen bilgileri kullan.

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}
Kazanımlar:
{outcomes listesi, kod + metin}

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "sections": [
    {
      "heading": string,
      "order_no": integer,
      "matched_outcome_codes": [string],
      "body_markdown": string,      // madde madde (- madde) özet bilgi
      "needs_image": boolean,
      "image_prompt": string   // needs_image true ise İngilizce görsel promptu; görseldeki yazılar Türkçe olsun
    }
  ],
  "cover": {
    "subtitle": string,             // 8-30 kelime, konuyu tanıtan ve açıklayan birkaç cümle
    "image_prompt": string,         // İngilizce, çocuk dostu illüstrasyon promptu; yazı varsa Türkçe olsun
    "highlights": [
      { "icon": "tek emoji", "title": "kavram/terim, max 3 kelime", "description": "1 kısa cümle, somut ve doğrulanabilir bir tanım" }
    ]  // konunun en önemli 4-8 anahtar kavramı
  }
}