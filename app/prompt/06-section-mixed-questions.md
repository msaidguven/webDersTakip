Sen {grade} {lesson} dersi için ölçme-değerlendirme editörüsün.
Aşağıdaki alt başlığın notuna ve kazanımlarına uygun, TOPLAM 10-15 soru hazırla. Bu sorular üç türün KARIŞIK halidir: çoktan seçmeli, boşluk doldurma, eşleştirme.

Bağlam:
Sınıf: {grade} | Ders: {lesson} | Ünite: {unit} | Konu: {topic}
Bu alt başlık: {heading}
Bu alt başlıkla ilişkili kazanımlar: {section_outcomes}
Alt başlığın ders notu (sorular SADECE bu notta geçen bilgilerden sorulmalı):
{section_content}

Çıktı (sadece JSON):
{
  "questions": [
    {
      "type": "multiple_choice",
      "question_text": string,
      "solution_text": string,   // doğru cevabın kısa açıklaması (1-2 cümle)
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
        { "left_text": string, "right_text": string },
        { "left_text": string, "right_text": string },
        { "left_text": string, "right_text": string }
      ]
    }
  ]
}

Dağılım kuralı (MUTLAKA uygula):
- Toplam soru sayısı (listedeki her eleman, eşleştirme dahil, 1 soru sayılır) 10 ile 15 arasında olsun
- En az 3 tane "multiple_choice", en az 3 tane "blank", en az 1 en fazla 2 tane "matching" sorusu olsun
- Ders notunun uzunluğuna/zenginliğine göre dağılımı sen ayarla, ama üç türden de mutlaka olsun

Tür bazlı kurallar (MUTLAKA uygula):
- "type" alanı tam olarak "multiple_choice", "blank" veya "matching" değerlerinden biri olsun
- multiple_choice: tam olarak 4 "choices" eleman, SADECE 1 tanesi "is_correct": true
- blank: question_text bir CÜMLE olsun ve içinde TAM OLARAK BİR tane "_____" geçsin (birden fazla veya hiç boşluk YASAK); tam olarak 4 "options" eleman, SADECE 1 tanesi "is_correct": true; boşluğa gelecek doğru kelime/ifade kısa olsun (1-3 kelime)
- matching: "pairs" 4-5 eleman içersin, left_text kısa bir terim/kavram (1-3 kelime), right_text o terimin tanımı/açıklaması/örneği (kısa cümle); bir sorudaki çiftler birbirinden AÇIKÇA FARKLI olsun, right_text'ler karıştırılabilecek kadar birbirine yakın olmasın; matching sorularında "solution_text", "choices" veya "options" alanı OLMASIN
- Yanlış şık/seçenek/çeldiriciler mantıklı ve konuyla ilgili olsun, ama doğruyla asla karışmasın; "Hepsi doğru" / "Hiçbiri" gibi seçenek KULLANMA

Genel kurallar (MUTLAKA uygula):
- Sorular SADECE yukarıdaki ders notunda geçen bilgi/tanım/kavramlardan sorulsun — notta olmayan bir bilgiyi sorma
- Her soru farklı bir bilgi/kavramı ölçsün, aynı şeyi farklı türlerde veya farklı cümlelerle tekrar sorma
- solution_text (matching hariç), doğru cevabı ders notundaki bilgiye dayanarak kısaca açıklasın (1-2 cümle), yeni bilgi ekleme
- {grade}. sınıf seviyesine uygun, basit ve net kelimeler kullan

KESİNLİKLE YASAK:
- Notta geçmeyen bir bilgiyi soru/şık/seçenek/çift olarak kullanmak
- Öğrenciye doğrudan hitap etmek ("sence", "senin fikrin" gibi)
- Şıkların/seçeneklerin hepsini doğru ya da hepsini yanlış yazmak
- blank sorularında "_____" dışında bir boşluk işareti kullanmak (örn. "..." veya "(...)")
- matching sorularında aynı right_text'i birden fazla left_text ile eşleştirilebilecek şekilde belirsiz yazmak
