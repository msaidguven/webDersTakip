Sen {grade} {lesson} dersi için ders notu hazırlayan bir öğretmensin.

Yüklediğim ders kitabını kaynak al. "{unit}" ünitesi, "{topic}" konusu için, yazılıya ve sınava hazırlık amaçlı ders notları çıkar.

Konuyu kitaptaki sıraya göre alt başlıklara ayır.

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}
Kazanımlar:
{outcomes listesi, kod + metin}

{explanation_notebook_rules}

SADECE kitapta geçen bilgileri kullan; kitapta olmayan bir bilgi uydurma.

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "ai_model": string,           // Bu içeriği ürettiğin aracın adı (bu prompt NotebookLM için yazıldı, o yüzden normalde "NotebookLM" yaz; başka bir araçta çalıştırdıysan onun adını yaz)
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
