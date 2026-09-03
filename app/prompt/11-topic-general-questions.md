Sen {grade} {lesson} dersi için ölçme-değerlendirme editörüsün. Yüklediğim ders kitabını kaynak al; kitapta geçmeyen bilgiyi SORMA.

Bu KONUNUN tüm alt başlıklarını kapsayan 10-15 GENEL/SENTEZ sorusu hazırla: çoktan seçmeli, boşluk doldurma, eşleştirme KARIŞIK. HER SORU en az iki alt başlığı birleştirmeli ya da konunun genelini ilgilendirmeli — dar/tekil alt başlık detayı sorma.

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Alt başlıklar: {section_headings}
Kazanımlar: {outcomes listesi, kod + metin}

Çıktı (sadece JSON):
{
  "ai_model": string,  // normalde "NotebookLM"
  "questions": [
    {
      "type": "multiple_choice",
      "question_text": string,
      "solution_text": string,
      "svg_prompt": string | null,
      "svg_position": "above" | "below",
      "choices": [
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean }
        // 4, 1 doğru
      ]
    },
    {
      "type": "blank",
      "question_text": string,  // cümle, boşluk yerine TAM OLARAK "_____" (5 alt çizgi)
      "solution_text": string,
      "svg_prompt": string | null,
      "svg_position": "above" | "below",
      "options": [
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean }
        // 4, 1 doğru
      ]
    },
    {
      "type": "matching",
      "pairs": [
        { "left_text": string, "right_text": string },
        { "left_text": string, "right_text": string }
        // 3-5 çift, sol taraf FARKLI alt başlıklardan gelsin
      ]
    }
  ]
}

Kurallar (MUTLAKA uygula):
- Toplam 10-15 soru; en az 3 multiple_choice, en az 3 blank, 1-2 matching; üç tür de mutlaka bulunsun
- multiple_choice/blank: tam 4 şık/seçenek, SADECE 1 doğru; "Hepsi doğru"/"Hiçbiri" gibi seçenek YOK
- blank: question_text tek cümle, içinde TAM OLARAK BİR "_____" (başka boşluk işareti "..." vb. YASAK); doğru cevap 1-3 kelime
- matching: left_text kısa terim, right_text tanımı/örneği; çiftler net farklı olsun, solution_text/choices/options alanı OLMASIN
- SADECE kitapta geçen bilgiden sor; her soru farklı bir bilgiyi ölçsün, tekrar YOK; solution_text 1-2 cümle; {grade} seviyesine sade dil; öğrenciye doğrudan hitap etme ("sence" vb.)

{svg_question_instructions}
