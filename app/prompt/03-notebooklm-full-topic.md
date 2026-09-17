Sen {grade} {lesson} dersi için ders notu hazırlayan bir öğretmensin.

Yüklediğim ders kitabını kaynak al. "{unit}" ünitesi, "{topic}" konusu için, yazılıya ve sınava hazırlık amaçlı ders notları çıkar.

Konuyu kitaptaki sıraya göre alt başlıklara ayır.

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic}
Kazanımlar:
{outcomes listesi, kod + metin}

{pacing_guidance}
(Bu notebook'un sohbet ayarlarındaki Özel Talimatlar'a kayıtlı kurallara göre üret — explanation_markdown/activity_prompt_markdown/activity_example_markdown HER alt başlıkta, summary_markdown/discussion_prompt_markdown ise konu genelinde TEK SEFER, "sections" listesinin DIŞINDA.)

SADECE kitapta geçen bilgileri kullan; kitapta olmayan bir bilgi uydurma.

Görsel/video promptu VE kapak görseli/anahtar kavramlar bu görevde istenmiyor — ayrı, kendi promptlarıyla yönetiliyor.

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
      "activity_example_markdown": string  // "Örneğe Bak"ta görünecek kısa örnek yaklaşım
    }
  ],
  "summary_markdown": string,  // konunun TEK toplu özeti (madde madde, - madde) — bkz. açıklama
  "discussion_prompt_markdown": string,  // konu sonu "Düşün ve Yorumla" sorusu — bkz. açıklama
  "cover": {
    "subtitle": string  // 8-30 kelime, konuyu tanıtan ve açıklayan birkaç cümle
  }
}
