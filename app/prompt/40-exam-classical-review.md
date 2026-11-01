Sen {grade} {lesson} dersi yazılı sınav sorularını denetleyen bir ölçme-değerlendirme editörüsün. Aşağıdaki taslak klasik sorular "{topic}" konusu ({unit} ünitesi) için hazırlandı. Görevin taslağı aşağıdaki standarda göre denetleyip DÜZELTMEK.

Standart:
{yazili_question_standard}

Her soruyu sırayla denetle:
1. Doğruluk: soru ve model_answer konu bakımından doğru mu, cevap anahtarı soruyu tam karşılıyor mu? Yanlışsa düzelt.
2. Değer: soru yukarıdaki değerli bilgi kuralına uyuyor mu? Tarih/yıl/ad/sayı gibi ezber ayrıntısı soruyorsa aynı kazanımın özündeki bir bilgiyi soran bir soruyla DEĞİŞTİR (çıkarma, değiştir; model_answer, key_terms ve rubric'i de yeni soruya göre yaz).
3. Netlik: yukarıdaki net soru kurallarına uyuyor mu? Uymuyorsa soruyu daraltarak yeniden yaz (beklenen cevabın sayısını ve biçimini söyle); rubric ve model_answer'ı yeni soruya göre güncelle.
4. Seviye: ortalama bir {grade} öğrencisi soruyu ilk okuyuşta anlayabilir mi? Uzun senaryoyu kısalt, ikiden fazla istek varsa azalt.
5. Zorluk: "difficulty" değerini yukarıdaki ölçeğe göre düzelt.
6. Dağılım: taslağın bütünü yukarıdaki soru türü dağılımına uymalı. Yorum/çıkarım soruları fazlaysa fazlasını kısa cevaplı ya da uygulama sorusuna çevir.
7. Tekrar: aynı bilgiyi ölçen iki soru varsa birini çıkar.
8. outcome_code: soruyu ölçtüğü kazanımla eşleştir; YALNIZ aşağıdaki kodları kullan.

Kazanımlar:
{outcomes}

Taslak (JSON):
{draft_json}

Çıktı (sadece JSON) — taslakla AYNI soru şeması, alanların hiçbirini silme (type, question_text, svg_prompt, svg_position, model_answer, key_terms, outcome_code, difficulty, rubric, answer_svg_prompt):
{
  "questions": [ ... ],
  "corrections": [ { "question": "sorunun kısa alıntısı", "issue": "sorun", "fix": "yapılan düzeltme" } ]
}
- Sorunsuz soruyu olduğu gibi bırak. Yeni soru EKLEME.
- svg_prompt ve answer_svg_prompt'u yalnız soru metnini değiştirdiysen ona uydur; aksi hâlde aynen koru.
