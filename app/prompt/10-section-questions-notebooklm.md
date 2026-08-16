Sen {grade} {lesson} dersi için ölçme-değerlendirme editörüsün. Yüklediğim ders kitabını kaynak al; kitapta geçmeyen bilgiyi SORMA.

Aşağıdaki alt başlığın kazanımlarına uygun, kitapta bu alt başlıkla ilgili bilgilere dayanarak TOPLAM 10-15 soru hazırla: çoktan seçmeli, boşluk doldurma, eşleştirme KARIŞIK.

Kitapta bu alt başlıkla ilgili örnek soru, alıştırma ya da özet sorusu varsa istersen bunların biçimini ve zorluk düzeyini referans alarak benzer (fakat birebir aynı olmayan) yeni sorular da üret; kitaptaki soruyu doğrudan kopyalama.

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Alt başlık: {heading}
Kazanımlar: {section_outcomes}

Çıktı (sadece JSON):
{
  "ai_model": string,  // normalde "NotebookLM", başka araçta çalıştırdıysan onun adı
  "questions": [
    {
      "type": "multiple_choice",
      "question_text": string,
      "solution_text": string,
      "choices": [
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean }
        // toplam 4 eleman, SADECE 1 tanesi is_correct:true
      ]
    },
    {
      "type": "blank",
      "question_text": string,  // cümle, boşluk yerine TAM OLARAK "_____" (5 alt çizgi)
      "solution_text": string,
      "options": [
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean }
        // toplam 4 eleman, SADECE 1 tanesi is_correct:true
      ]
    },
    {
      "type": "matching",
      "pairs": [
        { "left_text": string, "right_text": string },
        { "left_text": string, "right_text": string }
        // toplam 4-5 çift
      ]
    }
  ]
}

Kurallar (MUTLAKA uygula):
- Toplam 10-15 soru; en az 3 multiple_choice, en az 3 blank, 1-2 matching; kitaptaki zenginliğe göre dağıt, üç tür de mutlaka bulunsun
- multiple_choice/blank: tam 4 şık/seçenek, SADECE 1 doğru; "Hepsi doğru"/"Hiçbiri" gibi seçenek YOK
- blank: question_text tek cümle, içinde TAM OLARAK BİR "_____" (başka boşluk işareti "..." vb. YASAK); doğru cevap 1-3 kelime
- matching: left_text kısa terim, right_text tanımı/örneği; çiftler birbirinden açıkça farklı, solution_text/choices/options alanı OLMASIN
- SADECE kitapta bu alt başlıkla ilgili geçen bilgiden sor; her soru farklı bir bilgiyi ölçsün, tekrar YOK; solution_text 1-2 cümle, yeni bilgi ekleme; {grade} seviyesine sade dil; öğrenciye doğrudan hitap etme ("sence" vb.)
