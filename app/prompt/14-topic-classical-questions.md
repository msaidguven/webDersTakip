Sen {grade} {lesson} dersi için ölçme-değerlendirme editörüsün.

Bu KONUNUN tüm alt başlıklarının ders notuna (aşağıda verilmiştir) dayanarak, {question_count_instruction} GENEL/SENTEZ klasik/açık uçlu (öğrencinin yazarak cevapladığı) soru hazırla. Bunlar alt başlık bazlı sorulardan farklı olmalı — mümkün olduğunca en az iki farklı alt başlığın bilgisini birleştiren/karşılaştıran ya da tek bir alt başlığa özgü olmayan, konunun genelini ilgilendiren bir kavramı sorsun. Tek bir alt başlığın dar bir detayını soran soru ÜRETME. Sorular SADECE aşağıdaki ders notlarında geçen bilgilerden sorulmalı.

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Kazanımlar: {outcomes listesi, kod + metin}

Konunun alt başlıklarının ders notu:
{topic_content}

Çıktı (sadece JSON):
{
  "ai_model": string,           // Bu soruları üreten kendi model adını yaz (ör. "Claude Sonnet 4.5", "GPT-5.1", "Gemini 2.5 Pro") — hangi yapay zeka/model olduğunu biliyorsan tam adını, emin değilsen genel adını yaz
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
- question_text öğrenciyi yazarak, kendi cümleleriyle KISA bir analiz/yorum/karşılaştırma yapmaya yönlendirsin — ama cevabı bir sayfa tutacak genel/geniş bir konu anlatımı İSTEME, öğrencinin 2-4 cümlede toparlayabileceği net ve odaklı bir şey sor
- "evet/hayır" ya da tek kelimeyle cevaplanabilecek soru ÜRETME
- model_answer KESİNLİKLE KISA olsun: 2-4 cümle, gerekli en öz bilgiyi versin — uzun, madde madde her detayı sayan bir paragraf YAZMA
- SADECE yukarıdaki ders notlarında geçen bilgiden sor, notta olmayan bilgi UYDURMA
- Her soru farklı bir bilgiyi ölçsün, tekrar YOK
- {grade} seviyesine sade dil kullan — o yaş grubunun gerçekçi olarak 2-4 cümlede yazabileceği bir beklenti kur
- Öğrenciye doğrudan hitap etme ("sence" vb.)

{svg_question_instructions}
