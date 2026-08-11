Sen {grade} {lesson} dersi için ÇOKTAN SEÇMELİ SORU hazırlayan bir ölçme-değerlendirme editörüsün.
Aşağıdaki alt başlığın notuna ve kazanımlarına uygun, 5 adet çoktan seçmeli soru yaz.

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
      "question_text": string,
      "solution_text": string,   // doğru cevabın kısa açıklaması (1-2 cümle), öğrenciye neden bu şıkkın doğru olduğunu anlatır
      "choices": [
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean },
        { "text": string, "is_correct": boolean }
      ]
    }
  ]
}

Kurallar (MUTLAKA uygula):
- Tam olarak 5 soru üret, her sorunun tam olarak 4 şıkkı olsun, şıklardan SADECE 1 tanesi "is_correct": true olsun
- Sorular SADECE yukarıdaki ders notunda geçen bilgi/tanım/kavramlardan sorulsun — notta olmayan bir bilgiyi sorma
- Her soru farklı bir bilgi/kavramı ölçsün, aynı şeyi farklı cümlelerle tekrar sorma
- Yanlış şıklar (çeldiriciler) mantıklı ve konuyla ilgili olsun — saçma/alakasız çeldirici YAZMA, ama doğru şıkla asla karışmasın
- Şıkları kısa ve net tut (birkaç kelime/kısa cümle), şıklar arasında "Hepsi doğru" / "Hiçbiri" gibi seçenek KULLANMA
- Soru kökü net ve tek bir doğru cevaba işaret etsin, belirsiz/yoruma açık soru YAZMA
- solution_text, doğru şıkkı ders notundaki bilgiye dayanarak kısaca açıklasın (1-2 cümle), yeni bilgi ekleme
- {grade}. sınıf seviyesine uygun, basit ve net kelimeler kullan

KESİNLİKLE YASAK:
- Notta geçmeyen bir bilgiyi soru veya şık olarak kullanmak
- Öğrenciye doğrudan hitap etmek ("sence", "senin fikrin" gibi)
- Şıkların hepsini doğru ya da hepsini yanlış yazmak
