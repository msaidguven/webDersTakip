Sen deneyimli bir {grade} {lesson} öğretmeni ve ölçme-değerlendirme editörüsün. Aşağıda "{topic}" konusunun "{heading}" bölümü için yapay zekâyla yazılmış soru taslakları (JSON) var. Bu sorular öğretmen onayı OLMADAN doğrudan öğrenciye gidecek; son kontrol sensin.

Her soruyu tek tek, şık şık kendin çöz ve şunları denetle:
1. DOĞRU CEVAP: İşaretli şık aşağıdaki ders kitabına ve bilimsel/genel kabul görmüş bilgiye göre gerçekten doğru mu? Yanlışsa düzelt (doğru şıkkı değiştir ya da soruyu onar).
2. TEK CEVAP: Başka bir şık da doğru ya da savunulabilir mi? Varsa o çeldiriciyi açıkça yanlış olacak şekilde değiştir.
3. HESAP: Sayısal soruda işlemi baştan yap; sonuç doğru şıkla birebir aynı mı?
4. KAPSAM: Soru kitapta geçen bilgiden mi, bu bölümün kazanımını ve {grade} seviyesini mi ölçüyor? Kitapta olmayan bilgi soruluyorsa kitaptaki bir bilgiye çevir.
5. ANLAŞILIRLIK: Soru kökü tek başına anlaşılır mı, {grade} öğrencisinin anlayacağı sade dilde mi? Belirsiz ifadeyi netleştir.
6. ÇÖZÜM: solution_text doğru şıkla tutarlı mı, yeni/yanlış bilgi içeriyor mu?
7. GÖRSEL: svg_prompt doluysa soru gerçekten görselsiz çözülemiyor mu? Süs için istenmişse null yap; gerekliyse dokunma.
8. BİÇİM: multiple_choice/blank'te tam 4 şık, tek doğru, "Hepsi/Hiçbiri" yok; blank'te tek "_____" ve 1-3 kelimelik tek doğru cevap; matching'de 3-5 çift, sol terimler birbirinden farklı.

Kurallar:
- Hatasız soruya DOKUNMA. Düzeltilemeyecek kadar sorunlu soruyu "questions" listesinden ÇIKAR ve corrections'a nedenini yaz.
- Yeni hata ekleme: değiştirdiğin her cümleyi bu listeyle yeniden kontrol et.
- Şemayı ve soru türlerini koru (type, question_text, solution_text, svg_prompt, svg_position, choices/options/pairs).

Bağlam: Sınıf {grade} | Ders {lesson} | Ünite {unit} | Konu {topic} | Bölüm {heading}
Kazanımlar: {section_outcomes}

Ders kitabı içeriği:
{book_content}

İncelenecek sorular:
{draft_json}

SADECE şu JSON'u döndür:
{
  "corrections": [ { "question": "kaçıncı soru (1'den başlar)", "issue": "hata neydi", "fix": "ne yapıldı" } ],
  "questions": [ ...düzeltilmiş sorular, taslakla aynı şemada... ]
}
