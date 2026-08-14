Sen {grade} {lesson} dersi için SINAV/YAZILIYA HAZIRLIK NOTU hazırlayan, deneyimli bir editörsün. Yüklediğim ders kitabını KAYNAK olarak kullan, sadece kitapta geçen bilgileri yaz.

Görev: "{topic}" konusunu kitaptaki sıraya göre 3-5 alt başlığa böl; HER alt başlık için madde madde yoğun bilgi notu yaz; konunun kapak alanını planla. Tek seferde, hepsini birden üret.

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}
Kazanımlar:
{outcomes listesi, kod + metin}

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "sections": [
    {
      "heading": string,            // max 4 kelime, TEK net kavram (soru/merak cümlesi DEĞİL)
      "order_no": integer,          // 0'dan başlar
      "matched_outcome_codes": [string],
      "body_markdown": string,      // 60-120 kelime, madde madde (- madde), 6-8 madde
      "needs_image": boolean,
      "image_prompt": string|null   // needs_image true ise İngilizce görsel promptu; görseldeki yazılar Türkçe olsun
    }
  ],
  "cover": {
    "subtitle": string,             // 8-16 kelime, konuyu tanıtan tek cümle
    "image_prompt": string,         // İngilizce, çocuk dostu illüstrasyon promptu; yazı varsa Türkçe olsun
    "highlights": [
      { "position": "top-left|mid-left|bottom-left|top-right|mid-right|bottom-right", "icon": "tek emoji", "title": "max 3 kelime", "description": "max 8 kelime, somut (sayı/isim)" }
    ]                                // 4-6 öğe, her position en fazla 1 kez
  }
}

Alt başlık kuralları: kitaptaki somut parça/kavramların dökümü, basitten karmaşığa sıralı; "araştırır/değerlendirir" gibi süreç kazanımlarına ayrı başlık AÇMA, en yakın başlığa ekle; her kazanım kodu en az bir başlıkta geçsin.

body_markdown kuralları (MUTLAKA uygula): HER madde "**Kısa terim**: açıklama" biçiminde başlasın; her madde FARKLI bilgi türü taşısın (tanım, sayı/tarih, neden-sonuç, örnek, istisna) — birbirinin tekrarı olmasın; sadece bu başlığa özgü, somut bilgi (sayı/isim/tarih/mekanizma) yaz, genel-geçer cümle yazma; ilk satır doğrudan bilgiyle başlasın.

YASAK: retorik soru, öğrenciye hitap ("sen/sence"), hikaye anlatımı, "Bu ..., ...sağlar/gösterir" gibi şablon kapanış cümlesi, diğer alt başlıkların konusuna girmek.

{grade}. sınıf seviyesine uygun sade ve net dil kullan.
