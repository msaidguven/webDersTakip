Çıktı (sadece JSON):
{
  "ai_model": string,           // Bu soruları üreten kendi model adını yaz (ör. "Claude Sonnet 4.5", "GPT-5.1", "Gemini 2.5 Pro", NotebookLM ise "NotebookLM") — hangi yapay zeka/model olduğunu biliyorsan tam adını, emin değilsen genel adını yaz
  "questions": [
    {
      "type": "classical",
      "question_text": string,      // öğrencinin yazarak cevaplayacağı açık uçlu soru
      "svg_prompt": string | null,  // SVG kuralı
      "svg_position": "above" | "below",
      "model_answer": string,       // öğretmenin cevap anahtarı; KISA (2-4 cümle) ve öz — uzun ezber paragrafı DEĞİL
      "key_terms": [string]         // cevapta geçmesi beklenen 2-5 anahtar kavram/terim, öğretmenin hızlı kontrolü için
    }
  ]
}

Kurallar (MUTLAKA uygula):
- Amaç ezberletmek DEĞİL, öğrencinin konuyu anlayıp anlamadığını kısa ve öz şekilde ölçmek. Hem soru hem model_answer buna göre tasarlanmalı.
- question_text öğrenciyi yazarak, kendi cümleleriyle KISA bir analiz/yorum/karşılaştırma yapmaya yönlendirsin (ör. "neden", "nasıl", "hangi", "X ile Y'yi karşılaştır" gibi) — ama cevabı bir sayfa tutacak genel/geniş bir konu anlatımı İSTEME, öğrencinin 2-4 cümlede toparlayabileceği net ve odaklı bir şey sor
- "evet/hayır" ya da tek kelimeyle cevaplanabilecek soru ÜRETME
- model_answer KESİNLİKLE KISA olsun: 2-4 cümle, gerekli en öz bilgiyi versin — uzun, madde madde her detayı sayan bir paragraf YAZMA
- Her soru farklı bir bilgi/kavramı ölçsün, aynı şeyi farklı cümlelerle tekrar sorma
- {grade} seviyesine uygun, basit ve net kelimeler kullan — o yaş grubunun gerçekçi olarak 2-4 cümlede yazabileceği bir beklenti kur
- Öğrenciye doğrudan hitap etme ("sence", "senin fikrin" gibi)

{svg_question_instructions}
