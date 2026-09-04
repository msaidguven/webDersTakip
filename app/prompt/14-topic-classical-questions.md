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
      "model_answer": string,       // öğretmenin cevap anahtarı olarak kullanacağı TAM ve doğru cevap; sadece madde değil, düzgün cümle/paragraf halinde
      "key_terms": [string]         // cevapta geçmesi beklenen 2-5 anahtar kavram/terim, öğretmenin hızlı kontrolü için
    }
  ]
}

Kurallar (MUTLAKA uygula):
- question_text öğrenciyi yazarak, kendi cümleleriyle açıklamaya/karşılaştırmaya/yorumlamaya yönlendirsin — "evet/hayır" ya da tek kelimeyle cevaplanabilecek soru ÜRETME
- SADECE yukarıdaki ders notlarında geçen bilgiden sor, notta olmayan bilgi UYDURMA
- Her soru farklı bir bilgiyi ölçsün, tekrar YOK
- model_answer, ders notundaki bilgiye dayanarak eksiksiz ve doğru olsun; yeni bilgi ekleme
- {grade} seviyesine sade dil kullan
- Öğrenciye doğrudan hitap etme ("sence" vb.)

{svg_question_instructions}
