Sen {grade} {lesson} dersi için ölçme-değerlendirme editörüsün.
Aşağıdaki alt başlığın notuna ve kazanımlarına uygun, TOPLAM 3-7 soru hazırla. Bu sorular üç türün KARIŞIK halidir: çoktan seçmeli, boşluk doldurma, eşleştirme.

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
      "type": "multiple_choice",
      "question_text": string,
      "solution_text": string,   // doğru cevabın kısa açıklaması (1-2 cümle)
      "svg_prompt": string | null,  // bkz. SVG prompt kuralı
      "svg_position": "above" | "below",
      "choices": [
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean }
      ]
    },
    {
      "type": "blank",
      "question_text": string,   // cümle içinde eksik olan tek kelime/kısa ifadenin yerine TAM OLARAK "_____" (5 alt çizgi) konur
      "solution_text": string,   // doğru cevabın kısa açıklaması (1-2 cümle)
      "svg_prompt": string | null,  // bkz. SVG prompt kuralı
      "svg_position": "above" | "below",
      "options": [
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean }
      ]
    },
    {
      "type": "matching",
      "pairs": [
        { "left_text": string, "right_text": string },
        { "left_text": string, "right_text": string }
        // toplam 2-4 çift
      ]
    }
  ]
}

Dağılım kuralı (MUTLAKA uygula):
- Toplam soru sayısı (listedeki her eleman, eşleştirme dahil, 1 soru sayılır) 3 ile 7 arasında olsun
- Ders notunun uzunluğuna/zenginliğine göre üç tür arasında dağıt; mümkünse üçü de bulunsun, içerik dar bir alt başlıkta iki türle (hatta tek türle) yetinmek de doğrudur — sayıyı tutturmak için tekrara düşecek/zorlama soru ÜRETME
- matching kullanacaksan en az 2 çift olsun

Tür bazlı kurallar (MUTLAKA uygula):
- "type" alanı tam olarak "multiple_choice", "blank" veya "matching" değerlerinden biri olsun
- multiple_choice: tam olarak 4 "choices" eleman, SADECE 1 tanesi "is_correct": true
- blank: question_text bir CÜMLE olsun ve içinde TAM OLARAK BİR tane "_____" geçsin (birden fazla veya hiç boşluk YASAK); tam olarak 4 "options" eleman, SADECE 1 tanesi "is_correct": true; boşluğa gelecek doğru kelime/ifade kısa olsun (1-3 kelime)
- matching: "pairs" 2-4 eleman içersin, left_text kısa bir terim/kavram (1-3 kelime), right_text o terimin tanımı/açıklaması/örneği (kısa cümle); bir sorudaki çiftler birbirinden AÇIKÇA FARKLI olsun, right_text'ler karıştırılabilecek kadar birbirine yakın olmasın; matching sorularında "solution_text", "choices" veya "options" alanı OLMASIN
- Yanlış şık/seçenek/çeldiriciler mantıklı ve konuyla ilgili olsun, ama doğruyla asla karışmasın; "Hepsi doğru" / "Hiçbiri" gibi seçenek KULLANMA

Genel kurallar (MUTLAKA uygula):
- Sorular SADECE yukarıdaki ders notunda geçen bilgi/tanım/kavramlardan sorulsun — notta olmayan bir bilgiyi sorma
- Her soru farklı bir bilgi/kavramı ölçsün, aynı şeyi farklı türlerde veya farklı cümlelerle tekrar sorma
- solution_text (matching hariç), doğru cevabı ders notundaki bilgiye dayanarak kısaca açıklasın (1-2 cümle), yeni bilgi ekleme
- {grade} seviyesine uygun, basit ve net kelimeler kullan

KESİNLİKLE YASAK:
- Notta geçmeyen bir bilgiyi soru/şık/seçenek/çift olarak kullanmak
- Öğrenciye doğrudan hitap etmek ("sence", "senin fikrin" gibi)
- Şıkların/seçeneklerin hepsini doğru ya da hepsini yanlış yazmak
- blank sorularında "_____" dışında bir boşluk işareti kullanmak (örn. "..." veya "(...)")
- matching sorularında aynı right_text'i birden fazla left_text ile eşleştirilebilecek şekilde belirsiz yazmak

{svg_question_instructions}
