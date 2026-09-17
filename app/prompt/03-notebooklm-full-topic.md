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
      "activity_prompt_markdown": string,   // "Düşün:/Hayal Et:/Dene:" ile başlayan kısa istem
      "activity_example_markdown": string,  // "Örneğe Bak"ta görünecek kısa örnek yaklaşım
      "needs_image": boolean,
      "image_prompt": string,  // needs_image true ise İngilizce görsel promptu (YATAY/landscape formatta olsun); görseldeki yazılar Türkçe olsun
      "needs_video": boolean,  // NADİR kullan — SADECE alt başlık gerçek bir hareket/süreç/deney/animasyon içeriyorsa true
      "video_prompt": string   // needs_video true ise, birkaç saniyelik bir AI video modeline (ör. Veo) yazılacak İngilizce, TEK sahne/hareket tarif eden kısa prompt (konuşma/anlatım isteme)
    }
  ],
  "summary_markdown": string,  // konunun TEK toplu özeti (madde madde, - madde) — bkz. açıklama
  "discussion_prompt_markdown": string,  // konu sonu "Düşün ve Yorumla" sorusu — bkz. açıklama
  "cover": {
    "subtitle": string,             // 8-30 kelime, konuyu tanıtan ve açıklayan birkaç cümle
    "image_prompt": string,         // İngilizce, çocuk dostu illüstrasyon promptu (YATAY/landscape formatta olsun); yazı varsa Türkçe olsun
    "highlights": [
      { "icon": "tek emoji", "title": "kavram/terim, max 3 kelime", "description": "1 kısa cümle, somut ve doğrulanabilir bir tanım" }
    ]  // konunun en önemli 4-8 anahtar kavramı
  }
}
