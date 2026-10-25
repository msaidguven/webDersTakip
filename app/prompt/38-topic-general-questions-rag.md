Sen {grade} {lesson} dersi için ölçme-değerlendirme editörüsün. Aşağıda verilen ders kitabı içeriğini kaynak al; kitapta geçmeyen bilgiyi SORMA.

Bu KONUNUN tüm alt başlıklarını kapsayan TOPLAM 10-15 GENEL/SENTEZ sorusu hazırla (çoktan seçmeli, boşluk doldurma, eşleştirme KARIŞIK). HER SORU en az iki alt başlığın bilgisini birleştirsin ya da konunun genelini ilgilendirsin; tek bir alt başlığın dar detayını sorma (o sorular zaten ayrıca yazıldı).

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Alt başlıklar: {section_headings}
Kazanımlar:
{topic_outcomes}
{existing_questions}

Ünitenin ders kitabı içeriği (SADECE "{topic}" konusuyla ilgili geçen kısımları kullan):
{book_content}

Çıktı (sadece JSON):
{
  "ai_model": string,
  "questions": [
    { "type": "multiple_choice", "question_text": string, "solution_text": string, "svg_prompt": string | null, "svg_position": "above" | "below",
      "choices": [ { "text": string, "is_correct": boolean } ] },   // tam 4 eleman, SADECE 1 doğru
    { "type": "blank", "question_text": string, "solution_text": string, "svg_prompt": string | null, "svg_position": "above" | "below",
      "options": [ { "text": string, "is_correct": boolean } ] },   // tam 4 eleman, SADECE 1 doğru
    { "type": "matching", "pairs": [ { "left_text": string, "right_text": string } ] }   // 3-5 çift
  ]
}

Kurallar (MUTLAKA uygula):
- Toplam 10-15 soru: en az 4 multiple_choice, en az 4 blank, 1-2 matching; kitaptaki bilgi yetmiyorsa tekrara düşmek yerine 10'un altında kal
- multiple_choice/blank: tam 4 şık/seçenek, SADECE 1 doğru; "Hepsi doğru"/"Hiçbiri" YOK
- blank: question_text tek cümle, içinde TAM OLARAK BİR "_____" (5 alt çizgi; "..." YASAK); doğru cevap 1-3 kelime
- matching: sol kısa terimler FARKLI alt başlıklardan, sağ tanım/örnek; solution_text/choices/options alanı YOK
- Her soru farklı bir bilgiyi ölçsün, tekrar YOK; solution_text 1-2 cümle, yeni bilgi ekleme; {grade} seviyesine sade dil; öğrenciye doğrudan hitap etme ("sence" vb.)
- Kitaptaki okuma parçası, hikâye ya da örnek olayda geçen kişi adlarını, olay ayrıntılarını ve sayıları SORMA (ör. "…olan kişi hangisidir?", şıkları isim). Soru, o metni okumamış ama konuyu bilen öğrencinin de çözebileceği şekilde kazanımı ölçsün; kitap örneğinden yararlanacaksan gereken bilgiyi soru kökünde ver.
{math_notation_guidance}
{test_question_quality_rules}
{passage_guidance}

{svg_question_instructions}
