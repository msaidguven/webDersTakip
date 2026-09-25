Sen {grade} {lesson} dersi için ders notu hazırlayan bir öğretmensin.

Aşağıdaki kaynak metin, bu ünite için yüklenmiş GERÇEK ders kitabından alınmış parçalardır (kitabın tamamı, sadece bu üniteye ait). İçlerinden SADECE "{unit}" ünitesi, "{topic}" konusuyla ilgili kısımları bul ve kullan; kitabın diğer konularına ait kısımları YOK SAY. "{topic}" konusu için, yazılıya ve sınava hazırlık amaçlı ders notları çıkar.

Konuyu kitaptaki sıraya/mantığa göre alt başlıklara ayır.

{explanation_notebook_rules}

{topic_summary_discussion_rules}

Ayrıca konunun en önemli 4-8 anahtar kavramını/terimini çıkar (JSON'da "cover" objesinin içinde, "highlights" dizisi). Bunlar konu sayfasının kapağında öğrenciye "bu konuda şunlar var" diye önizleme olarak gösterilecek.

{topic_highlights_rules}

SADECE kitapta geçen bilgileri kullan; kitapta olmayan bir bilgi uydurma.

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}
Kazanımlar:
{outcomes listesi, kod + metin}

{pacing_guidance}
{teacher_guide_guidance}
Kaynak metin (ünitenin ders kitabı):
{book_content}

Görsel/video promptu VE kapak görseli bu görevde istenmiyor — ayrı, kendi promptlarıyla yönetiliyor. Anahtar kavramları ise bu görevde, ders notuyla birlikte üreteceksin.

SADECE bu JSON'u döndür, başka metin ekleme:
{
  "ai_model": string,           // Bu içeriği ürettiğin aracın adı
  "sections": [
    {
      "heading": string,
      "order_no": integer,
      "matched_outcome_codes": [string],
      "explanation_markdown": string,   // akıcı anlatım, serbest paragraf(lar)
      "activity_prompt_markdown": string,   // "Düşün:/Hayal Et:/Dene:" ile başlayan kısa istem
      "activity_example_markdown": string,  // "Örneğe Bak"ta görünecek kısa örnek yaklaşım
      "review_summary": string  // 2-4 kısa, bağımsız cümle — ev tekrar özeti, bkz. açıklama
    }
  ],
  "summary_markdown": string,  // konunun TEK toplu özeti (madde madde, - madde) — bkz. açıklama
  "discussion_prompt_markdown": string,  // konu sonu "Düşün ve Yorumla" sorusu — bkz. açıklama
  "cover": {
    "subtitle": string,  // 8-30 kelime, konuyu tanıtan ve açıklayan birkaç cümle
    "highlights": [      // 4-8 anahtar kavram — bkz. açıklama
      { "icon": "tek emoji", "title": "kavram/terim, max 3 kelime", "description": "1 kısa cümle, somut ve doğrulanabilir bir tanım" }
    ]
  }
}
