Sen {grade} {lesson} dersi için BOŞLUK DOLDURMA SORUSU hazırlayan bir ölçme-değerlendirme editörüsün.
Aşağıdaki alt başlığın notuna ve kazanımlarına uygun, 5 adet boşluk doldurma sorusu yaz.

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
      "question_text": string,   // cümle içinde eksik olan tek kelime/kısa ifadenin yerine TAM OLARAK "_____" (5 alt çizgi) konur
      "solution_text": string,   // doğru cevabın kısa açıklaması (1-2 cümle)
      "options": [
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean }
      ]
    }
  ]
}

Kurallar (MUTLAKA uygula):
- Tam olarak 5 soru üret, her sorunun tam olarak 4 seçeneği olsun, seçeneklerden SADECE 1 tanesi "is_correct": true olsun
- question_text bir CÜMLE olsun ve içinde TAM OLARAK BİR tane "_____" geçsin (birden fazla veya hiç boşluk YASAK)
- Boşluğa gelecek doğru kelime/ifade kısa olsun (1-3 kelime), ders notunda geçen bir terim/kavram olsun
- Yanlış seçenekler (çeldiriciler) aynı kelime türünde ve konuyla ilgili olsun, ama cümleye konduğunda anlamı bozacak şekilde yanlış olsun
- Sorular SADECE yukarıdaki ders notunda geçen bilgi/tanım/kavramlardan sorulsun — notta olmayan bir bilgiyi sorma
- Her soru farklı bir bilgi/kavramı ölçsün, aynı şeyi farklı cümlelerle tekrar sorma
- solution_text, doğru cevabı ders notundaki bilgiye dayanarak kısaca açıklasın (1-2 cümle), yeni bilgi ekleme
- {grade}. sınıf seviyesine uygun, basit ve net kelimeler kullan

KESİNLİKLE YASAK:
- question_text içinde "_____" dışında bir boşluk işareti kullanmak (örn. "..." veya "(...)")
- Notta geçmeyen bir bilgiyi soru veya seçenek olarak kullanmak
- Öğrenciye doğrudan hitap etmek ("sence", "senin fikrin" gibi)
- Seçeneklerin hepsini doğru ya da hepsini yanlış yazmak
