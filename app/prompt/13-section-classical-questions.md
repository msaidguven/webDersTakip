Sen {grade} {lesson} dersi için ölçme-değerlendirme editörüsün.
Aşağıdaki alt başlığın notuna ve kazanımlarına uygun, {question_count_instruction} klasik/açık uçlu (öğrencinin yazarak cevapladığı) soru hazırla.

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Bu alt başlık: {heading}
Bu alt başlıkla ilişkili kazanımlar: {section_outcomes}
Alt başlığın ders notu (sorular SADECE bu notta geçen bilgilerden sorulmalı):
{section_content}

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
- Sorular SADECE yukarıdaki ders notunda geçen bilgi/tanım/kavramlardan sorulsun — notta olmayan bir bilgiyi sorma
- Her soru farklı bir bilgi/kavramı ölçsün, aynı şeyi farklı cümlelerle tekrar sorma
- model_answer, ders notundaki bilgiye dayanarak eksiksiz ve doğru olsun; notta olmayan yeni bilgi ekleme
- {grade} seviyesine uygun, basit ve net kelimeler kullan
- Öğrenciye doğrudan hitap etme ("sence", "senin fikrin" gibi)

{svg_question_instructions}
